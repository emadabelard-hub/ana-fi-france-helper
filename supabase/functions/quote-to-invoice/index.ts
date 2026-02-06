import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Version for deployment tracking
const VERSION = "v1.0.1";
const DEPLOYED_AT = new Date().toISOString();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ExtractedData {
  clientName?: string;
  clientAddress?: string;
  workSiteAddress?: string;
  items: Array<{
    designation_fr: string;
    designation_ar?: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  notes?: string;
}

serve(async (req) => {
  console.log(`[${VERSION}] quote-to-invoice function called at ${new Date().toISOString()}`);
  console.log(`[${VERSION}] Deployed at: ${DEPLOYED_AT}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { document, mimeType, fileName } = await req.json();

    if (!document) {
      return new Response(
        JSON.stringify({ error: "Document is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log(`Processing document: ${fileName}, type: ${mimeType}`);

    // Prepare the prompt for extraction
    const systemPrompt = `Tu es un assistant expert en extraction de données de documents commerciaux français (devis, factures).

Ta mission:
1. Extraire TOUTES les informations du document fourni
2. Traduire EN FRANÇAIS tout texte en arabe, darija, ou autre langue
3. Retourner les données structurées pour pré-remplir une facture

IMPORTANT - Format de sortie:
Tu DOIS appeler la fonction extract_invoice_data avec les données extraites.

Règles d'extraction:
- clientName: Nom complet du client (personne ou entreprise)
- clientAddress: Adresse complète du client
- workSiteAddress: Adresse du chantier si différente
- items: Liste des prestations/articles avec:
  - designation_fr: Description EN FRANÇAIS (traduire si nécessaire)
  - designation_ar: Description originale si en arabe (optionnel)
  - quantity: Nombre (défaut: 1)
  - unit: Unité (m², U, h, F, etc.)
  - unitPrice: Prix unitaire HT en euros

Si un texte est en arabe/darija, traduis-le en français professionnel.
Exemples de traduction:
- "تركيب أبواب" → "Installation de portes"
- "صباغة" → "Peinture"
- "كهرباء" → "Électricité"`;

    const userPrompt = `Analyse ce document (${fileName}) et extrais toutes les données pour créer une facture.
    
Le document est encodé en base64 au format ${mimeType}.

IMPORTANT: Traduis tout texte arabe en français professionnel.`;

    // Call Lovable AI with vision capability
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
              { type: "text", text: userPrompt },
              { 
                type: "image_url", 
                image_url: { 
                  url: `data:${mimeType};base64,${document}` 
                } 
              }
            ]
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              description: "Extract and structure invoice data from the document",
              parameters: {
                type: "object",
                properties: {
                  clientName: {
                    type: "string",
                    description: "Client name (person or company)"
                  },
                  clientAddress: {
                    type: "string",
                    description: "Client full address"
                  },
                  workSiteAddress: {
                    type: "string",
                    description: "Work site address if different from client"
                  },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        designation_fr: {
                          type: "string",
                          description: "Item description in French (translated if needed)"
                        },
                        designation_ar: {
                          type: "string",
                          description: "Original Arabic description if applicable"
                        },
                        quantity: {
                          type: "number",
                          description: "Quantity"
                        },
                        unit: {
                          type: "string",
                          description: "Unit (m², U, h, F, etc.)"
                        },
                        unitPrice: {
                          type: "number",
                          description: "Unit price in euros HT"
                        }
                      },
                      required: ["designation_fr", "quantity", "unit", "unitPrice"]
                    },
                    description: "List of line items"
                  },
                  notes: {
                    type: "string",
                    description: "Any additional notes or conditions"
                  }
                },
                required: ["items"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez dans quelques secondes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits insuffisants. Veuillez recharger votre compte." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI service error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response received");

    // Extract the function call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== "extract_invoice_data") {
      throw new Error("Failed to extract data from document");
    }

    let extractedData: ExtractedData;
    try {
      extractedData = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error("Parse error:", parseError);
      throw new Error("Failed to parse extracted data");
    }

    // Validate and clean the data
    if (!extractedData.items || !Array.isArray(extractedData.items)) {
      extractedData.items = [];
    }

    // Ensure all items have required fields with defaults
    extractedData.items = extractedData.items.map((item, index) => ({
      designation_fr: item.designation_fr || `Article ${index + 1}`,
      designation_ar: item.designation_ar || undefined,
      quantity: Number(item.quantity) || 1,
      unit: item.unit || 'U',
      unitPrice: Number(item.unitPrice) || 0,
    }));

    console.log(`[${VERSION}] Successfully extracted ${extractedData.items.length} items`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        extractedData,
        message: `Extraction réussie: ${extractedData.items.length} articles trouvés`,
        _version: VERSION
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Quote-to-invoice error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
