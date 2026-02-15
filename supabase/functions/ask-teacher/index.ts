import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_TEACHER_LIMIT = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    // Auth check for daily limit
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { question, currentPhrase, lessonTitle, imageData } = await req.json();

    // Daily limit check
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("daily_message_count, last_message_date")
        .eq("user_id", userId)
        .single();

      const today = new Date().toISOString().split("T")[0];
      const isNewDay = profile?.last_message_date !== today;
      const currentCount = isNewDay ? 0 : (profile?.daily_message_count ?? 0);

      if (currentCount >= DAILY_TEACHER_LIMIT) {
        return new Response(
          JSON.stringify({ error: "لقد وصلت للحد اليومي (10 أسئلة). عد غداً! 🌙" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("profiles")
        .update({ daily_message_count: currentCount + 1, last_message_date: today })
        .eq("user_id", userId);
    }

    const systemPrompt = `أنت "معلم فرنسي" ودود وصبور. تشرح قواعد اللغة الفرنسية بالعربية الفصحى البسيطة.
السياق: الطالب يتعلم درس "${lessonTitle || 'فرنسي'}" والعبارة الحالية هي: "${currentPhrase || ''}".
- أجب بشكل مختصر (3-5 جمل كحد أقصى).
- استخدم أمثلة فرنسية مع الترجمة.
- إذا كان السؤال عن النطق، اكتب النطق بالحروف العربية.
- إذا أرسل المستخدم صورة، حلل محتواها وأجب عن أي أسئلة متعلقة بها.
- كن مشجعاً ولطيفاً.`;

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (imageData) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: question || "ما هذا؟ اشرح لي بالعربية." },
          { type: "image_url", image_url: { url: imageData } },
        ],
      });
    } else {
      messages.push({ role: "user", content: question });
    }

    console.log("Calling OpenAI GPT-4o-mini...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("OpenAI error:", response.status, errBody);
      return new Response(
        JSON.stringify({ error: `OpenAI Error ${response.status}: ${errBody}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || "عذراً، لم أستطع الإجابة.";

    console.log("OpenAI responded successfully");

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ask-teacher error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
