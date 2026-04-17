import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Local dictionary for instant zero-latency translation of common cases.
const FR_TO_AR: Record<string, string> = {
  "acompte à la commande": "دفعة مقدمة عند الطلب",
  "acompte": "دفعة مقدمة",
  "acompte de démarrage": "دفعة بداية الشغل",
  "début des travaux": "بداية الشغل",
  "fin de gros œuvre": "نهاية الأشغال الكبرى",
  "fin de second œuvre": "نهاية الأشغال الثانوية",
  "milieu de chantier": "نص الشانتي",
  "réception des travaux": "استلام الشغل",
  "remise des clés": "تسليم المفاتيح",
  "solde final": "الدفعة الأخيرة",
  "solde": "الدفعة الأخيرة",
  "paiement final": "الدفعة الأخيرة",
  "livraison": "التسليم",
  "signature du devis": "توقيع الديفي",
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const AR_TO_FR: Record<string, string> = Object.entries(FR_TO_AR).reduce(
  (acc, [fr, ar]) => {
    acc[normalize(ar)] = fr.charAt(0).toUpperCase() + fr.slice(1);
    return acc;
  },
  {} as Record<string, string>,
);

function tryDictionary(text: string, direction: "ar-to-fr" | "fr-to-ar"): string | null {
  const key = normalize(text);
  if (!key) return null;
  if (direction === "ar-to-fr") return AR_TO_FR[key] ?? null;
  return FR_TO_AR[key] ?? null;
}

async function aiTranslate(text: string, direction: "ar-to-fr" | "fr-to-ar", apiKey: string): Promise<string> {
  const targetLang = direction === "ar-to-fr" ? "français professionnel BTP (chantier France)" : "arabe égyptien dialectal (Ammiya) compréhensible par un artisan";
  const sourceLang = direction === "ar-to-fr" ? "arabe (dialecte ou littéraire)" : "français";

  const systemPrompt = `Tu es un traducteur spécialisé dans le vocabulaire de chantier (BTP) et des étapes de paiement (échéancier de devis/facture).
Traduis le texte donné depuis ${sourceLang} vers ${targetLang}.

Règles strictes:
- Réponds UNIQUEMENT par la traduction, sans guillemets, sans explication, sans préfixe.
- Garde une formulation courte et naturelle, adaptée à un libellé d'échéance de paiement.
- Pour le français: style professionnel BTP (ex: "Acompte à la commande", "Fin de gros œuvre", "Remise des clés", "Solde final").
- Pour l'arabe: dialecte égyptien (Ammiya), pas de fusha rigide (ex: "دفعة مقدمة عند الطلب", "نهاية الأشغال الكبرى", "تسليم المفاتيح", "الدفعة الأخيرة").
- Ne JAMAIS recopier le texte source. Toujours produire la langue cible.
- Si le texte est vide ou incompréhensible, réponds par une chaîne vide.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      stream: false,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("translate-milestone-label AI error:", response.status, errText);
    throw new Error(`AI translation failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  return content.replace(/^["'`]+|["'`]+$/g, "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const direction = body?.direction === "fr-to-ar" ? "fr-to-ar" : "ar-to-fr";

    if (!text) {
      return new Response(JSON.stringify({ translation: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Try local dictionary first — instant, zero cost
    const dictHit = tryDictionary(text, direction);
    if (dictHit) {
      return new Response(JSON.stringify({ translation: dictHit, source: "dictionary" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fallback to AI for free-form text
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Translation service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const translation = await aiTranslate(text, direction, apiKey);
    return new Response(JSON.stringify({ translation, source: "ai" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("translate-milestone-label error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
