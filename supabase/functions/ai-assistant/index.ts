import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const currentDate = new Date().toLocaleDateString('fr-FR');

    const systemPrompt = language === 'fr'
      ? `Vous êtes un conseiller expert pour les artisans, indépendants et la communauté en France. Vous répondez en français, de manière claire, professionnelle et très détaillée. Vos domaines d'expertise : démarches administratives, droits sociaux, fiscalité, travail, logement, immigration, création d'entreprise, auto-entrepreneur, aides sociales (CAF, RSA, APL), sécurité sociale, retraite.

Date du jour : ${currentDate}.

RÈGLES DE RÉPONSE :
- Fournissez des réponses LONGUES, DÉTAILLÉES et PÉDAGOGIQUES.
- Structurez TOUJOURS vos réponses avec des listes à puces et des étapes numérotées (1, 2, 3...).
- Expliquez chaque point en profondeur comme un vrai conseiller expert.
- Donnez des exemples concrets et pratiques quand c'est possible.
- Mentionnez les sites officiels, les formulaires et les délais quand c'est pertinent.
- N'hésitez pas à détailler les droits, les obligations et les pièges à éviter.
- Terminez par un résumé ou un conseil pratique si pertinent.`
      : `أنت مستشار خبير للصنايعية والحرفيين والجالية في فرنسا. بتتكلم بالمصري العامي بشكل ودود وقريب من الناس. خبرتك في الإجراءات الإدارية، الحقوق الاجتماعية، الضرايب، الشغل، السكن، الهجرة، تأسيس الشركات، الأوتو أونتروبرونور، المساعدات الاجتماعية (CAF, RSA, APL)، الضمان الاجتماعي، والمعاش.

التاريخ: ${currentDate}.

قواعد الرد:
- ردودك لازم تكون طويلة ومفصلة وتعليمية.
- نظم ردودك دايماً بنقاط وخطوات مرقمة (1، 2، 3...).
- اشرح كل نقطة بالتفصيل زي ما مستشار حقيقي يعمل.
- ادي أمثلة عملية وواقعية كل ما تقدر.
- اذكر المواقع الرسمية والأوراق المطلوبة والمواعيد لو ليها علاقة.
- وضح الحقوق والواجبات والحاجات اللي لازم ياخدوا بالهم منها.
- اختم بملخص أو نصيحة عملية لو مناسب.`;

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
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
