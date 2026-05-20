import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-supabase-client-platform, apikey, content-type",
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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    console.log("[scan-company-doc] ANTHROPIC_API_KEY present:", !!ANTHROPIC_API_KEY);
    console.log("[scan-company-doc] LOVABLE_API_KEY present:", !!LOVABLE_API_KEY);
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const instruction = docType === "kbis"
      ? `Analyse ce document Kbis français. Extrais les champs via l'outil fourni. Si un champ est absent, omets-le. SIRET = 14 chiffres uniquement.`
      : `Analyse ce RIB français. Extrais IBAN (sans espaces, majuscules) et BIC/SWIFT via l'outil fourni.`;

    const userContent: any[] = [{ type: "text", text: instruction }];
    if (imageBase64) {
      const { mediaType, data } = parseDataUrl(imageBase64);
      console.log("[scan-company-doc] Image mediaType:", mediaType, "dataLength:", data.length);
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data },
      });
    } else {
      console.log("[scan-company-doc] Using PDF text, length:", text.length);
      userContent.push({ type: "text", text: `Contenu extrait du PDF :\n${text}` });
    }

    console.log("[scan-company-doc] Calling Anthropic API...");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        tools: [schema],
        tool_choice: { type: "tool", name: schema.name },
        messages: [{ role: "user", content: userContent }],
      }),
    });

    console.log("[scan-company-doc] Anthropic HTTP status:", response.status, response.statusText);

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[scan-company-doc] Anthropic error body:", errBody);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Service busy" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Anthropic API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    console.log("[scan-company-doc] Anthropic response shape:", JSON.stringify({
      id: data.id,
      type: data.type,
      role: data.role,
      model: data.model,
      stop_reason: data.stop_reason,
      contentTypes: Array.isArray(data.content) ? data.content.map((c: any) => c.type) : null,
      usage: data.usage,
    }));

    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    const extracted = toolUse?.input ?? {};
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

