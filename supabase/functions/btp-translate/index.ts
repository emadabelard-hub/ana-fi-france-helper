// BTP Translator: Arabic (Egyptian) <-> French with construction vocabulary
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

  // Auth check (paid API endpoint — require authenticated user)
  const _authHeader = req.headers.get("Authorization");
  if (!_authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const _authClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
  const { data: { user: _authUser }, error: _authError } = await _authClient.auth.getUser(_authHeader.replace("Bearer ", ""));
  if (_authError || !_authUser || _authUser.is_anonymous) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
    let sourceLang = body.sourceLang;
    let targetLang = body.targetLang;

    // BUG 2 — Auto-detect Arabic vs French from Unicode ratio (>30% arabic chars → 'ar')
    if (text) {
      const arabicMatches = text.match(/[\u0600-\u06FF]/g);
      const arabicCount = arabicMatches ? arabicMatches.length : 0;
      const letterMatches = text.match(/[\p{L}]/gu);
      const letterCount = letterMatches ? letterMatches.length : 0;
      if (letterCount > 0) {
        const arabicRatio = arabicCount / letterCount;
        // Certitude ≥80% : on override le bouton sélectionné
        if (arabicRatio >= 0.8) {
          sourceLang = "ar";
          targetLang = "fr";
        } else if (arabicRatio < 0.05 && letterCount >= 3) {
          // Texte clairement non arabe → français
          sourceLang = "fr";
          targetLang = "ar";
        } else if (arabicRatio > 0.3) {
          sourceLang = "ar";
          targetLang = "fr";
        }
      }
    }

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

    const stream = body && typeof body === "object" && (body as any).stream === true;

    const sourceLabel = sourceLang === "ar" ? "Arabe Égyptien (Ammiya) BTP" : "Français BTP";
    const targetLabel = targetLang === "ar" ? "Arabe Égyptien (Ammiya) BTP" : "Français BTP";

    // CORRECTION 4 — explicit client instruction takes precedence to lock the source language
    const explicitInstruction = typeof (body as any).instruction === "string"
      ? String((body as any).instruction).trim()
      : "";
    const directionLine = explicitInstruction
      || `Traduis du ${sourceLabel} vers le ${targetLabel}.`;

    // Prompt strict minimal (selon spec utilisateur)
    const userPrompt = `${directionLine} Réponds uniquement avec la traduction sans explication, en une seule phrase naturelle et professionnelle. Phrase : ${text}`;

    // Glossaire en system court pour garder précision BTP
    const systemPrompt = `Traducteur BTP. Vocabulaire pro NF/DTU. Arabe = Égyptien Ammiya uniquement.
${BTP_GLOSSARY}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 1000,
        stream,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
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

    // Streaming: forward SSE directly
    if (stream && aiResponse.body) {
      return new Response(aiResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
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
