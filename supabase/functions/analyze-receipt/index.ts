import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const requestPayload = {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this receipt/invoice image. Extract the following information and return it as a JSON object using the tool provided.
                - title: A short description of the expense (e.g. "Achat peinture Leroy Merlin")
                - amount: The total amount (number, without currency symbol)
                - tva_amount: The TVA/tax amount if visible (number, 0 if not found)
                - category: One of: "materials" (matériaux), "tools" (outils), "transport" (transport/carburant), "food" (repas/alimentation), "office" (bureau/fournitures), "insurance" (assurance), "telecom" (téléphone/internet), "other" (autre)
                - date: The date on the receipt in YYYY-MM-DD format (or today if not visible)
                - notes: Any additional relevant info (store name, address, etc.)

                If you cannot read the image clearly, make your best guess and add a note about uncertainty.`
            },
            {
              type: "image_url",
              image_url: { url: imageBase64 }
            }
          ]
        }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_receipt_data",
            description: "Extract structured data from a receipt image",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                amount: { type: "number" },
                tva_amount: { type: "number" },
                category: { type: "string", enum: ["materials", "tools", "transport", "food", "office", "insurance", "telecom", "other"] },
                date: { type: "string" },
                notes: { type: "string" }
              },
              required: ["title", "amount", "tva_amount", "category", "date"],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "extract_receipt_data" } }
    };

    const callGateway = async (model: string) => {
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, ...requestPayload }),
      });
    };

    let response = await callGateway("google/gemini-2.5-flash");

    if (!response.ok) {
      const firstErrorText = await response.text();
      const canFallback = response.status === 400 && firstErrorText.includes("Unable to process input image");

      if (canFallback) {
        response = await callGateway("openai/gpt-5-mini");
      } else {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Service busy, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Payment required." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("AI gateway error:", response.status, firstErrorText);
        throw new Error("AI analysis failed");
      }
    }

    if (!response.ok) {
      const t = await response.text();
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Service busy, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.error("AI gateway fallback error:", response.status, t);
      const today = new Date().toISOString().slice(0, 10);
      return new Response(JSON.stringify({
        title: "Dépense reçue",
        amount: 0,
        tva_amount: 0,
        category: "other",
        date: today,
        notes: "Analyse automatique indisponible pour cette image. Vérifiez et complétez manuellement.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const extracted = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(extracted), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify({
      title: "Dépense reçue",
      amount: 0,
      tva_amount: 0,
      category: "other",
      date: today,
      notes: "Aucune donnée lisible détectée. Vérifiez et complétez manuellement.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-receipt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
