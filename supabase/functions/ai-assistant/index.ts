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
      ? `Tu es 'Ana Fi France', un conseiller expert pour TOUTE la communauté arabophone en France (Maghreb, Égypte, Moyen-Orient) ainsi que les artisans et indépendants.

Date du jour : ${currentDate}.

RÈGLES DE RÉPONSE :
1. Langue : Utilise un Français professionnel, clair et accessible.
2. Format : Tes réponses doivent être LONGUES, DÉTAILLÉES et BIEN STRUCTURÉES.
3. Style : Utilise des listes à puces, des paragraphes distincts et explique les démarches étape par étape (1, 2, 3...).
4. Contenu : Sois précis sur les lois françaises, les aides sociales (CAF, RSA, APL), la fiscalité, la sécurité sociale, la retraite, la création d'entreprise, l'auto-entrepreneur, le logement, l'immigration.
5. Donne des exemples concrets et pratiques quand c'est possible.
6. Mentionne les sites officiels, les formulaires et les délais quand c'est pertinent.
7. Détaille les droits, les obligations et les pièges à éviter.
8. Termine par un résumé ou un conseil pratique si pertinent.`
      : `أنت 'أنا في فرنسا'، مستشار خبير لكل الجالية العربية في فرنسا (مغرب، مصر، شرق أوسط) وكذلك الحرفيين والمستقلين.

التاريخ: ${currentDate}.

قواعد الرد:
1. اللغة: استخدم العربية الفصحى الواضحة والمبسطة لتكون مفهومة للجميع.
2. الشكل: ردودك لازم تكون طويلة ومفصلة ومنظمة بشكل جيد.
3. الأسلوب: استخدم القوائم النقطية والفقرات المنفصلة واشرح الإجراءات خطوة بخطوة (1، 2، 3...).
4. المحتوى: كن دقيقاً في القوانين الفرنسية، المساعدات الاجتماعية (CAF, RSA, APL)، الضرائب، الضمان الاجتماعي، التقاعد، تأسيس الشركات، العمل الحر، السكن، والهجرة.
5. أعطِ أمثلة عملية وواقعية كلما أمكن.
6. اذكر المواقع الرسمية والأوراق المطلوبة والمواعيد النهائية عند الحاجة.
7. وضّح الحقوق والواجبات والأمور التي يجب الحذر منها.
8. اختم بملخص أو نصيحة عملية إن كان ذلك مناسباً.`;

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
