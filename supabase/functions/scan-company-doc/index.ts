import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMAS: Record<string, any> = {
  kbis: {
    name: "extract_kbis",
    description: "Extract company info from a French Kbis document",
    parameters: {
      type: "object",
      properties: {
        company_name: { type: "string", description: "Dénomination sociale" },
        siret: { type: "string", description: "SIRET 14 digits, digits only" },
        company_address: { type: "string", description: "Adresse du siège" },
        code_naf: { type: "string", description: "Code NAF / APE" },
        capital_social: { type: "string", description: "Capital social with currency, e.g. '10 000 €'" },
        ville_immatriculation: { type: "string", description: "Ville du RCS" },
      },
      required: [],
      additionalProperties: false,
    },
  },
  rib: {
    name: "extract_rib",
    description: "Extract IBAN and BIC from a French RIB",
    parameters: {
      type: "object",
      properties: {
        iban: { type: "string", description: "IBAN, uppercase, no spaces" },
        bic: { type: "string", description: "BIC / SWIFT code, uppercase" },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const instruction = docType === "kbis"
      ? `Analyse ce document Kbis français. Extrais les champs demandés via l'outil fourni. Si un champ est absent, omets-le. SIRET = 14 chiffres uniquement.`
      : `Analyse ce RIB français. Extrais IBAN (sans espaces, majuscules) et BIC/SWIFT via l'outil fourni.`;

    const userContent: any[] = [{ type: "text", text: instruction }];
    if (imageBase64) {
      userContent.push({ type: "image_url", image_url: { url: imageBase64 } });
    } else {
      userContent.push({ type: "text", text: `Contenu extrait du PDF :\n${text}` });
    }

    const payload = {
      messages: [{ role: "user", content: userContent }],
      tools: [{ type: "function", function: schema }],
      tool_choice: { type: "function", function: { name: schema.name } },
    };

    const callGateway = (model: string) =>
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, ...payload }),
      });

    let response = await callGateway("google/gemini-2.5-flash");
    if (!response.ok && response.status === 400) {
      response = await callGateway("openai/gpt-5-mini");
    }

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Service busy" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI analysis failed");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const extracted = toolCall?.function?.arguments ? JSON.parse(toolCall.function.arguments) : {};
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
