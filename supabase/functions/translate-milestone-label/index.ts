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

function containsArabic(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

function containsLatin(s: string): boolean {
  return /[A-Za-zÀ-ÿ]/.test(s);
}

async function aiTranslate(text: string, direction: "ar-to-fr" | "fr-to-ar", apiKey: string): Promise<string> {
  const systemPrompt = direction === "ar-to-fr"
    ? `Tu es un traducteur professionnel spécialisé dans le BTP en France (devis et factures).
Tu reçois un libellé d'échéance de paiement en arabe (dialecte égyptien Ammiya, darija ou arabe standard).
Tu DOIS produire UNE phrase courte en FRANÇAIS PROFESSIONNEL, claire et naturelle, utilisable directement dans un devis ou une facture française.

RÈGLES ABSOLUES:
- Réponds UNIQUEMENT par la traduction française, sans guillemets, sans explication, sans préfixe, sans suffixe.
- INTERDIT: recopier le texte arabe. INTERDIT: laisser des caractères arabes dans la réponse.
- INTERDIT: traduction mot à mot. Produis une formulation BTP naturelle.
- Style attendu: court, professionnel, type "Acompte à la commande", "Paiement au début des travaux", "Paiement à la livraison", "Fin de gros œuvre", "Remise des clés", "Solde à réception", "Paiement à mi-chantier".
- Commence par une majuscule. Pas de point final.
- Si le texte est vide ou incompréhensible, réponds par une chaîne vide.

EXEMPLES:
- "دفعة مقدمة" → "Acompte à la commande"
- "عند بداية الأشغال" → "Paiement au début des travaux"
- "عند التسليم" → "Paiement à la livraison"
- "نص الشانتي" → "Paiement à mi-chantier"
- "الدفعة الأخيرة" → "Solde final"
- "تسليم المفاتيح" → "Remise des clés"`
    : `Tu es un traducteur professionnel. Traduis ce libellé d'échéance de paiement français vers l'arabe égyptien dialectal (Ammiya) compréhensible par un artisan.
Réponds UNIQUEMENT par la traduction, sans guillemets ni explication. Ne recopie jamais le texte source.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      stream: false,
      temperature: 0.2,
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

    // Safety: for ar-to-fr, the result MUST NOT still contain Arabic.
    let safe = translation;
    if (direction === "ar-to-fr" && containsArabic(safe)) {
      console.warn("translate-milestone-label: AI returned Arabic — discarded");
      safe = "";
    }

    return new Response(JSON.stringify({ translation: safe, source: "ai" }), {
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
