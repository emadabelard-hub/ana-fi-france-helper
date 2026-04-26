// BTP Translator: Arabic (Egyptian) <-> French with construction vocabulary
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BTP_GLOSSARY = `
Glossaire BTP obligatoire (terminologie chantier France, à respecter strictement):
- دهان / بوية → peinture acrylique
- معجون → enduit de lissage
- بلاط / سيراميك → carrelage
- سقف مستعار → faux plafond
- كهربا / كهرباء → installation électrique conforme NF
- سباكة → plomberie sanitaire
- هدم → travaux de démolition
- عزل → travaux d'isolation
- نجارة → menuiserie
- جبس / جبصين → plaque de plâtre (BA13)
- شبابيك → fenêtres / menuiseries extérieures
- باب / أبواب → portes / blocs-portes
- أرضية → sol / revêtement de sol
- حيطة / حائط → mur / cloison
- سقف → plafond
- أسمنت → ciment
- رمل → sable
- مونة → mortier
- ترميم → rénovation
- ورشة → chantier
- مقاول → artisan / entrepreneur
- صنفرة → ponçage
- سوسكوش → sous-couche
- كارلاج → carrelage
- فايونس → faïence
- جوانت → joint
- روبيني → robinet
- شوفاج → chauffage
- بالون ديو → chauffe-eau
- بيتون → béton
- بارباين → parpaing
- دالاج → dallage
- بلاكو → placo
- متر مربع / م² → mètre carré (m²)
- متر طولي / م.ط → mètre linéaire (ml)
- مان دوفر → main-d'œuvre
- ماتيريو → matériaux / fournitures
- فورنيتور → fournitures
- دوفي → devis
- فاتورة → facture
`;

interface TranslateRequest {
  text: string;
  sourceLang: "ar" | "fr";
  targetLang: "ar" | "fr";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as TranslateRequest;
    const text = (body.text || "").trim();
    const sourceLang = body.sourceLang;
    const targetLang = body.targetLang;

    if (!text) {
      return new Response(JSON.stringify({ error: "Empty text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["ar", "fr"].includes(sourceLang) || !["ar", "fr"].includes(targetLang)) {
      return new Response(JSON.stringify({ error: "Invalid languages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const direction =
      sourceLang === "ar"
        ? "Arabe Égyptien (Ammiya) parlé sur chantier vers Français professionnel BTP de chantier en France"
        : "Français professionnel BTP de chantier en France vers Arabe Égyptien (Ammiya) clair, naturel et compréhensible par un ouvrier BTP";

    const systemPrompt = `Tu es un traducteur expert spécialisé BTP (bâtiment et travaux publics) opérant sur des chantiers en France.
Ton rôle: traduire fidèlement et professionnellement entre artisans et clients/maîtres d'ouvrage.

Direction: ${direction}.

Contexte impératif:
- Le contexte est TOUJOURS un chantier BTP en France (rénovation, second œuvre, gros œuvre, finitions).
- L'auteur est un artisan, un chef de chantier, un client ou un maître d'œuvre.
- La traduction doit être naturelle, fluide, professionnelle — comme un vrai chef de chantier bilingue.

Règles strictes:
1. Traduction directe, naturelle, professionnelle. JAMAIS de mot-à-mot maladroit.
2. Utiliser SYSTÉMATIQUEMENT le vocabulaire technique BTP français standard (DTU, NF, terminologie chantier).
3. Aucun commentaire, aucune explication, AUCUNE balise, AUCUN guillemet superflu. Retourne UNIQUEMENT la traduction finale.
4. Pour l'arabe: utiliser EXCLUSIVEMENT l'égyptien (Ammiya) clair et professionnel, JAMAIS le darija marocain ni l'arabe littéraire (fusha).
5. Préserver à l'identique: chiffres, mesures (m², ml, kg, m³), pourcentages, références produits, noms propres, marques.
6. Si le texte source contient un terme du glossaire ci-dessous, utiliser OBLIGATOIREMENT la traduction officielle indiquée.
7. Respecter le registre: formel pour devis/facture, oral et direct pour échanges chantier.

${BTP_GLOSSARY}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit, réessaie dans un instant." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Translation service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResponse.json();
    const translated = (data?.choices?.[0]?.message?.content || "").trim();

    return new Response(JSON.stringify({ translated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("btp-translate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
