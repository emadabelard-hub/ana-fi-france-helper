import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { items } = await req.json() as {
      items: Array<{
        id: string;
        designation_fr: string;
        designation_ar: string;
        unit: string;
        quantity: number;
        laborOnly: boolean;
      }>;
    };

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const itemDescriptions = items.map((item, i) =>
      `Item ID="${item.id}" : "${item.designation_fr}" (${item.designation_ar}) — unité: ${item.unit}, qté: ${item.quantity}, ${item.laborOnly ? 'MAIN D\'OEUVRE SEULE (pas de fourniture)' : 'FOURNITURE ET POSE (matériaux + main d\'oeuvre)'}`
    ).join("\n");

    const systemPrompt = `Tu es شبيك لبيك, l'expert métreur/chiffreur BTP qui représente l'Artisan (المعلم). Tu connais parfaitement les prix du marché français 2024-2025 pour tous les corps de métier du bâtiment. Ton objectif est que les devis soient techniquement parfaits et rentables pour l'artisan.

RÈGLES STRICTES :
- Donne des prix réalistes du marché français (prix artisan, pas prix grand public)
- Pour "main d'oeuvre seule" : donne UNIQUEMENT le coût de la main d'oeuvre sans matériaux
- Pour "fourniture et pose" : donne le prix total incluant matériaux + main d'oeuvre
- Réponds UNIQUEMENT avec un JSON valide, pas de texte avant ni après
- Format: { "prices": [ { "id": "<EXACT ITEM ID FROM INPUT>", "unitPrice": 35, "unit": "m²" } ] }
- CRITICAL: The "id" field must be the EXACT same string as the Item ID provided in the input. Do NOT use the description or any other value.
- Arrondis au nombre entier le plus proche
- Si une tâche est un forfait, donne le prix forfaitaire total

💰 INTELLIGENCE DES PRIX :
- Évalue la complexité réelle (accès, hauteur, état de dégradation) et ajuste les tarifs en conséquence.
- RÈGLE PETITES SURFACES : Pour tout chantier de moins de 10 m², applique systématiquement une tarification au forfait ou un prix unitaire plus élevé pour couvrir les frais fixes.

✍️ VOCABULAIRE NOBLE : Utilise les termes techniques précis (ex: "Ratissage", "Impression hydrofuge", "Dégrossissage").

Références marché France (indicatif) :
- Peinture murs : 22-35€/m² (F+P), 12-18€/m² (MO)
- Carrelage sol : 40-65€/m² (F+P), 25-45€/m² (MO)
- Enduit / Ratissage : 15-25€/m² (F+P), 8-14€/m² (MO)
- Plomberie WC : 250-500€/u (F+P), 100-200€/u (MO)
- Électricité prise : 80-150€/u (F+P), 40-80€/u (MO)
- Nettoyage chantier : 5-15€/m²
- Démolition mur : 30-60€/m²
- Impression hydrofuge : 8-15€/m²
- Dégrossissage : 12-22€/m²`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Estime les prix unitaires pour ces prestations BTP :\n\n${itemDescriptions}\n\nRéponds UNIQUEMENT en JSON.` },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Service surchargé, réessayez dans un instant." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA indisponibles." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erreur estimation IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    // Also try to find raw JSON object
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];

    let parsed: { prices: Array<{ id: string; unitPrice: number; unit?: string }> };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI price response:", rawContent);
      return new Response(JSON.stringify({ error: "Réponse IA invalide", raw: rawContent }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("estimate-price error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
