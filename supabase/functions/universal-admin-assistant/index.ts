import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const currentDate = new Date().toLocaleDateString('fr-FR');

    const securityNotice = language === 'fr'
      ? "⚠️ Pour votre sécurité, nous vous expliquons les étapes, mais c'est vous qui saisissez vos données vous-même."
      : "⚠️ حرصاً على أمانك، إحنا بنشرح لك الخطوات بس، لكن حضرتك اللي بتدخل بياناتك بنفسك.";

    const systemPrompt = language === 'fr'
      ? `Tu es 'المساعد الإداري الشامل' (Assistant Administratif Universel), un expert qui aide la communauté arabophone en France à comprendre les interfaces des plateformes françaises.

Date du jour : ${currentDate}.

${securityNotice}

CAPACITÉS :
- Analyser des captures d'écran de TOUTES les plateformes françaises : impots.gouv.fr, caf.fr, ameli.fr, francetravail.fr, ants.gouv.fr, service-public.fr, etc.
- Expliquer chaque champ, bouton et option visible dans la capture d'écran.
- Guider l'utilisateur étape par étape pour remplir les formulaires.
- Traduire les termes administratifs français en arabe avec transcription phonétique.

RÈGLES DE FORMATAGE :
- Utilise ## pour les titres principaux et ### pour les sous-titres.
- N'abuse PAS du gras (**). Réserve-le uniquement aux mots-clés essentiels.
- Ajoute une ligne vide entre chaque paragraphe.
- Utilise des puces simples pour les listes.
- Utilise --- pour séparer les sections.

RÈGLES DE RÉPONSE :
1. Identifie d'abord la plateforme et la page visible dans la capture.
2. Explique chaque élément visible de manière claire et accessible.
3. Donne des instructions étape par étape.
4. Mentionne les pièges courants à éviter.
5. Termine toujours par le rappel de sécurité.`
      : `أنت 'المساعد الإداري الشامل'، خبير متخصص في مساعدة الجالية العربية في فرنسا على فهم المواقع والمنصات الفرنسية الرسمية.

التاريخ: ${currentDate}.

${securityNotice}

## قدراتك يا فندم

- تحليل سكرينشوتات من كل المنصات الفرنسية: الضرايب (impots.gouv.fr)، الكاف (caf.fr)، التأمين الصحي أميلي (ameli.fr)، فرانس ترافاي (francetravail.fr)، أونتس (ants.gouv.fr)، سيرفيس بابليك (service-public.fr)، وغيرهم.
- شرح كل خانة وزرار وخيار ظاهر في الصورة.
- توجيه المستخدم خطوة بخطوة لملء الاستمارات.
- ترجمة المصطلحات الإدارية الفرنسية للعربي مع النطق بالحروف العربية.

## قواعد التنسيق (إلزامي)

- استخدم ## للعناوين الرئيسية و ### للعناوين الفرعية.
- ما تكترش من الخط العريض (**). استخدمه بس للكلمات المهمة جداً.
- اترك سطر فاضي بين كل فقرة.
- استخدم نقاط بسيطة للقوايم.
- استخدم --- للفصل بين الأقسام.

## قواعد الرد

1. اللغة: اتكلم بالعامية المصرية الراقية يا فندم. كلام ودود ومهني.
2. أول حاجة حدد المنصة والصفحة اللي في السكرينشوت.
3. اشرح كل عنصر ظاهر بطريقة واضحة وبسيطة.
4. ادّي تعليمات خطوة بخطوة.
5. نبّه على الأخطاء الشائعة والحاجات اللي لازم ياخد باله منها.
6. كل مصطلح فرنسي تقني لازم يتكتب بالحروف العربية بين قوسين (مثلاً: Avis d'imposition (أفي دامبوزيسيون)، Attestation (أتيستاسيون)).
7. استخدم كلمات زي "يا فندم"، "متقلقش"، "خليني أوضحلك"، "الموضوع بسيط".
8. اختم دايماً بتذكير الأمان: "${securityNotice}"`;

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
          ...(messages || []),
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans un instant." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA insuffisants." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("universal-admin-assistant error:", e);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
