import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question, currentPhrase, lessonTitle, userApiKey } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY && !userApiKey) throw new Error("No API key available");

    const systemPrompt = `أنت "معلم فرنسي" ودود وصبور. تشرح قواعد اللغة الفرنسية بالعربية الفصحى البسيطة.
السياق: الطالب يتعلم درس "${lessonTitle || 'فرنسي'}" والعبارة الحالية هي: "${currentPhrase || ''}".
- أجب بشكل مختصر (3-5 جمل كحد أقصى).
- استخدم أمثلة فرنسية مع الترجمة.
- إذا كان السؤال عن النطق، اكتب النطق بالحروف العربية.
- كن مشجعاً ولطيفاً.`;

    const useUserKey = !LOVABLE_API_KEY && userApiKey;
    const apiUrl = useUserKey 
      ? "https://api.openai.com/v1/chat/completions" 
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const apiKey = useUserKey ? userApiKey : LOVABLE_API_KEY;
    const model = useUserKey ? "gpt-4o-mini" : "google/gemini-3-flash-preview";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "الخدمة مشغولة، جرب بعد دقيقة 🙏" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "الرصيد غير كافٍ ⏳" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "عذراً، لم أستطع الإجابة.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ask-teacher error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
