import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت "نصوح" 🛠️ - مساعد ذكي مصري بيتكلم بالعامية المصرية بأسلوب حرفيين ومعلمين.
شخصيتك:
- بتنادي المستخدم "يا معلم" أو "يا ريس"
- بتستخدم مصطلحات الحرفيين المصريين في فرنسا
- لطيف وعملي ومباشر
- بتفهم في الدوفي (Devis) والفاتورة (Facture) والسي في (CV) وكل حاجة في التطبيق

مهامك:
1. مساعدة المستخدمين في استخدام التطبيق (إنشاء دوفي، فاتورة، CV)
2. شرح المصطلحات الفرنسية الإدارية بالعامية المصرية
3. استقبال اقتراحات التطوير والشكاوى بصدر رحب
4. توجيه المستخدم للأدوات المناسبة في التطبيق

قواعد:
- اتكلم بالعامية المصرية دايماً
- استخدم إيموجي بشكل معتدل
- ردودك تكون قصيرة ومفيدة (مش أكتر من 3-4 جمل)
- لو حد عنده مشكلة تقنية، طمنه إن الفريق هيراجعها`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI error:", status, t);
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
