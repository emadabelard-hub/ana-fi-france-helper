import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { imageBase64, text, docType } = await req.json();
    const schema = SCHEMAS[docType];
    if (!schema) {
      return new Response(JSON.stringify({ error: "Invalid docType" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!imageBase64 && !text) {
      return new Response(JSON.stringify({ error: "No content provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const instruction = docType === "kbis"
      ? `Analyse ce document Kbis français. Extrais les champs via l'outil fourni. Si un champ est absent, omets-le. SIRET = 14 chiffres uniquement.`
      : `Analyse ce RIB français. Extrais IBAN (sans espaces, majuscules) et BIC/SWIFT via l'outil fourni.`;

    const userContent: any[] = [{ type: "text", text: instruction }];
    if (imageBase64) {
      const { mediaType, data } = parseDataUrl(imageBase64);
      userContent.push({
        type: "image",
        source: { type: "base64", media_type: mediaType, data },
      });
    } else {
      userContent.push({ type: "text", text: `Contenu extrait du PDF :\n${text}` });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        tools: [schema],
        tool_choice: { type: "tool", name: schema.name },
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Service busy" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use");
    const extracted = toolUse?.input ?? {};
    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-company-doc error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
