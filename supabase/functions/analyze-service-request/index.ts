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

    const { description, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = language === 'ar'
      ? `أنت مساعد إداري خبير. مهمتك الوحيدة هي تحليل طلب المستخدم وتحديد قائمة المستندات والمعلومات المطلوبة لتنفيذ الخدمة الإدارية.

## قواعد الرد

1. ارجع قائمة مرقمة واضحة بالمستندات والمعلومات المطلوبة.
2. لكل عنصر، أضف شرح مختصر بالعامية المصرية الراقية (مثلاً: "1. وصل كهرباء أو غاز: عشان نثبت عنوان السكن يا فندم").
3. لو في مستند اختياري، وضّح إنه اختياري.
4. في النهاية، أضف ملاحظة: "متقلقش يا فندم، كل بياناتك في أمان تام وبتتحذف بعد تنفيذ الخدمة مباشرة."
5. استخدم تنسيق Markdown نظيف بدون نجوم خام.
6. لا تكتب مقدمة طويلة، ادخل في الموضوع مباشرة.

## مثال

### المستندات والمعلومات المطلوبة

1. **بطاقة الهوية أو تيتر دو سيجور** (Titre de séjour): عشان نتأكد من هويتك يا فندم
2. **وصل كهرباء أو غاز** (Justificatif de domicile): عشان نثبت عنوان السكن
3. **رقم الضمان الاجتماعي** (Numéro de sécurité sociale): لو عندك - اختياري`
      : `Tu es un expert administratif. Ta seule mission est d'analyser la demande de l'utilisateur et de fournir une liste numérotée des documents et informations nécessaires pour réaliser la démarche administrative.

## Règles de réponse

1. Retourne une liste numérotée claire des documents et informations requis.
2. Pour chaque élément, ajoute une brève explication.
3. Si un document est optionnel, précise-le.
4. Termine par : "Vos données sont en sécurité et seront supprimées après l'exécution du service."
5. Utilise un formatage Markdown propre sans étoiles brutes.
6. Pas d'introduction longue, va droit au but.`;

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
          { role: "user", content: description },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const requirements = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ requirements }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-service-request error:", e);
    return new Response(JSON.stringify({ error: "Erreur interne" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
