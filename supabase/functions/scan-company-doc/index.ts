import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMAS: Record<string, any> = {
  kbis: {
    name: "extract_kbis",
    description: "Extract company info from a French Kbis document",
    input_schema: {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Dénomination sociale" },
        siret: { type: "string", description: "SIRET 14 chiffres uniquement" },
        company_address: { type: "string", description: "Adresse du siège" },
        code_naf: { type: "string", description: "Code NAF / APE" },
        capital_social: { type: "string", description: "Capital social avec devise" },
        ville_immatriculation: { type: "string", description: "Ville du RCS" },
      },
    },
  },
  rib: {
    name: "extract_rib",
    description: "Extract IBAN and BIC from a French RIB",
    input_schema: {
      type: "object",
      properties: {
        iban: { type: "string", description: "IBAN, majuscules, sans espaces" },
        bic: { type: "string", description: "BIC / SWIFT, majuscules" },
      },
    },
  },
};

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (m) return { mediaType: m[1], data: m[2] };
  return { mediaType: "image/jpeg", data: dataUrl };
}

function extractJsonObject(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return {};
    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("[scan-company-doc] Request received:", req.method);
    const { imageBase64, text, docType } = await req.json();
    console.log("[scan-company-doc] docType:", docType, "hasImage:", !!imageBase64, "hasText:", !!text, "imageBase64Length:", imageBase64?.length ?? 0);

    const schema = SCHEMAS[docType];
    if (!schema) {
      console.error("[scan-company-doc] Invalid docType:", docType);
      return new Response(JSON.stringify({ error: "Invalid docType" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!imageBase64 && !text) {
      console.error("[scan-company-doc] No content provided");
      return new Response(JSON.stringify({ error: "No content provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    console.log("[scan-company-doc] LOVABLE_API_KEY present:", !!LOVABLE_API_KEY);
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const instruction = docType === "kbis"
      ? `Analyse ce document Kbis français. Extrais uniquement les champs visibles. SIRET = 14 chiffres uniquement. Réponds avec un JSON strict.`
      : `Analyse ce RIB français. Extrais uniquement IBAN sans espaces en majuscules et BIC/SWIFT. Réponds avec un JSON strict.`;

    const userContent: any[] = [{ type: "text", text: instruction }];
    if (imageBase64) {
      const { mediaType, data } = parseDataUrl(imageBase64);
      console.log("[scan-company-doc] Image mediaType:", mediaType, "dataLength:", data.length);
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mediaType};base64,${data}` },
      });
    } else {
      console.log("[scan-company-doc] Using PDF text, length:", text.length);
      userContent.push({ type: "text", text: `Contenu extrait du PDF :\n${text}` });
    }

    console.log("[scan-company-doc] Calling Lovable AI Gateway...");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: userContent }],
        response_format: { type: "json_object" },
        tools: [{
          type: "function",
          function: {
            name: schema.name,
            description: schema.description,
            parameters: schema.input_schema,
          },
        }],
        tool_choice: { type: "function", function: { name: schema.name } },
      }),
    });

    console.log("[scan-company-doc] Gateway HTTP status:", response.status, response.statusText);

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[scan-company-doc] Gateway error body:", errBody);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Service busy" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message ?? {};
    console.log("[scan-company-doc] Gateway response shape:", JSON.stringify({
      id: data.id,
      model: data.model,
      finish_reason: data.choices?.[0]?.finish_reason,
      hasToolCalls: Array.isArray(message.tool_calls),
      usage: data.usage,
    }));

    const args = message.tool_calls?.[0]?.function?.arguments;
    const extracted = args ? extractJsonObject(args) : extractJsonObject(message.content ?? "{}");
    console.log("[scan-company-doc] Extracted fields:", Object.keys(extracted));

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[scan-company-doc] Fatal error:", e instanceof Error ? e.stack || e.message : e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

