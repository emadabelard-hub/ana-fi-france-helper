import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageBase64, mimeType, pdfText } = await req.json();
    if (!imageBase64 && !pdfText) {
      return new Response(JSON.stringify({ error: "imageBase64 or pdfText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Tu es un expert en extraction de données de devis et factures du BTP en France.

Analyse l'image fournie et extrais TOUTES les données suivantes.
Traduis en français tout texte en arabe ou darija.

Données à extraire :
- clientName : nom du client
- clientAddress : adresse complète du client
- clientPhone : téléphone du client
- description : objet / description générale du devis
- items : tableau des lignes avec designation (en français), quantity, unit, unitPrice
- totalHT : total hors taxes
- tva : montant TVA
- totalTTC : total TTC

Si une donnée n'est pas visible, laisse la chaîne vide ou 0.
N'invente RIEN. Extrais uniquement ce qui est visible sur le document.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyse cette image de devis et extrais toutes les données." },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_quote_data",
              description: "Extract structured quote/invoice data from image",
              parameters: {
                type: "object",
                properties: {
                  clientName: { type: "string" },
                  clientAddress: { type: "string" },
                  clientPhone: { type: "string" },
                  description: { type: "string" },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        designation: { type: "string" },
                        quantity: { type: "number" },
                        unit: { type: "string" },
                        unitPrice: { type: "number" },
                      },
                      required: ["designation", "quantity", "unit", "unitPrice"],
                    },
                  },
                  totalHT: { type: "number" },
                  tva: { type: "number" },
                  totalTTC: { type: "number" },
                },
                required: ["items"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_quote_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error(`[${VERSION}] AI error:`, response.status, errText);
      throw new Error(`AI service error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== "extract_quote_data") {
      throw new Error("Extraction échouée");
    }

    let extracted: any;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Impossible de parser les données extraites");
    }

    // Normalize
    const normalized = {
      source: "image_quote_to_invoice",
      clientName: extracted.clientName || "",
      clientAddress: extracted.clientAddress || "",
      clientPhone: extracted.clientPhone || "",
      description: extracted.description || "",
      items: (extracted.items || []).map((it: any, i: number) => ({
        designation: it.designation || `Article ${i + 1}`,
        quantity: Number(it.quantity) || 1,
        unit: it.unit || "forfait",
        unitPrice: Number(it.unitPrice) || 0,
      })),
      totalHT: Number(extracted.totalHT) || 0,
      tva: Number(extracted.tva) || 0,
      totalTTC: Number(extracted.totalTTC) || 0,
    };

    console.log(`[${VERSION}] Extracted ${normalized.items.length} items for user ${user.id}`);

    return new Response(JSON.stringify({ success: true, data: normalized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
