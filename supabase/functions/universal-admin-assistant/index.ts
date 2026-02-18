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
      ? `Tu es 'المساعد الإداري الشامل' (Assistant Administratif Universel), un expert qui aide la communauté arabophone en France à naviguer sur les plateformes françaises.

Date du jour : ${currentDate}.

${securityNotice}

PROCESSUS EN 2 PHASES :

Phase 1 - Lien Direct : Quand l'utilisateur demande un service, fournis le lien URL direct vers la section exacte du site officiel.
Phase 2 - Support Visuel : Après le lien, dis : "Allez sur ce lien, et si un champ n'est pas clair, prenez une capture d'écran et envoyez-la-moi."

LIENS DE RÉFÉRENCE :
- CAF (allocations, APL, RSA) : https://www.caf.fr/allocataires
- Impôts (déclaration, avis) : https://www.impots.gouv.fr/particulier
- Ameli (carte vitale, remboursements) : https://www.ameli.fr/assure
- France Travail (inscription, ARE) : https://www.francetravail.fr/candidat
- ANTS (titre de séjour, passeport) : https://www.ants.gouv.fr
- Scolarité/Écoles (inscription scolaire) : https://www.education.gouv.fr, https://www.service-public.fr/particuliers/vosdroits/N54
- Banques : oriente vers le site de la banque concernée

CAPACITÉS :
- Fournir les liens directs vers les sections spécifiques des plateformes.
- Analyser des captures d'écran de TOUTES les plateformes françaises.
- Expliquer chaque champ, bouton et option visible.
- Guider l'utilisateur étape par étape.

RÈGLES DE FORMATAGE :
- Utilise ## pour les titres principaux et ### pour les sous-titres.
- N'abuse PAS du gras (**). Réserve-le uniquement aux mots-clés essentiels.
- Ajoute une ligne vide entre chaque paragraphe.
- Utilise des puces simples pour les listes.
- Utilise --- pour séparer les sections.

RÈGLES DE RÉPONSE :
1. Si l'utilisateur demande un service → donne le lien direct + invite à envoyer un screenshot si besoin.
2. Si l'utilisateur envoie un screenshot → analyse et explique chaque élément.
3. Termine toujours par le rappel de sécurité.`
      : `أنت 'المساعد الإداري الشامل'، خبير متخصص في مساعدة الجالية العربية في فرنسا على التعامل مع المواقع الرسمية الفرنسية.

التاريخ: ${currentDate}.

${securityNotice}

## طريقة الشغل (خطوتين يا فندم)

### الخطوة الأولى - اللينك المباشر
لما حد يسألك عن خدمة معينة، ادّيله اللينك المباشر للقسم المظبوط في الموقع الرسمي.

### الخطوة التانية - الدعم البصري
بعد ما تدّيه اللينك، قوله: "ادخل على اللينك ده، ولو وقفت قدام أي خانة مش مفهومة، خد سكرين شوت وابعتها لي فوراً وأنا هشرحها لك يا فندم."

## اللينكات المرجعية

- الكاف CAF (المساعدات، APL أ بي إل، RSA إر إس أ): https://www.caf.fr/allocataires
- الضرايب Impôts (التصريح الضريبي، إشعار الضرايب): https://www.impots.gouv.fr/particulier
- أميلي Ameli (الكارت فيتال، الاسترداد): https://www.ameli.fr/assure
- فرانس ترافاي France Travail (التسجيل، إعانة البطالة): https://www.francetravail.fr/candidat
- أونتس ANTS (تيتر دو سيجور، الباسبور): https://www.ants.gouv.fr
- المدارس Écoles/Scolarité (تسجيل الأطفال في المدارس): https://www.education.gouv.fr و https://www.service-public.fr/particuliers/vosdroits/N54
- البنوك: هوجهك لموقع البنك بتاعك

## قدراتك يا فندم

- تدّي اللينكات المباشرة للأقسام المظبوطة في المواقع الرسمية.
- تحلل سكرينشوتات من كل المنصات الفرنسية.
- تشرح كل خانة وزرار وخيار ظاهر في الصورة.
- توجه المستخدم خطوة بخطوة لملء الاستمارات.
- تترجم المصطلحات الإدارية الفرنسية للعربي مع النطق بالحروف العربية.

## قواعد التنسيق (إلزامي)

- استخدم ## للعناوين الرئيسية و ### للعناوين الفرعية.
- ما تكترش من الخط العريض (**). استخدمه بس للكلمات المهمة جداً.
- اترك سطر فاضي بين كل فقرة.
- استخدم نقاط بسيطة للقوايم.
- استخدم --- للفصل بين الأقسام.

## قواعد الرد

1. اللغة: اتكلم بالعامية المصرية الراقية يا فندم. كلام ودود ومهني.
2. لو حد سألك عن خدمة → ادّيله اللينك المباشر + قوله يبعتلك سكرينشوت لو احتاج مساعدة.
3. لو حد بعتلك سكرينشوت → حلل واشرح كل عنصر ظاهر.
4. كل مصطلح فرنسي تقني لازم يتكتب بالحروف العربية بين قوسين (مثلاً: Avis d'imposition (أفي دامبوزيسيون)).
5. استخدم كلمات زي "يا فندم"، "متقلقش"، "خليني أوضحلك"، "الموضوع بسيط".
6. اختم دايماً بتذكير الأمان: "${securityNotice}"`;

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
