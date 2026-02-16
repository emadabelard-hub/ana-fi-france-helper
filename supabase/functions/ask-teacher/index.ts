import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAILY_TEACHER_LIMIT = 5;

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
          JSON.stringify({ error: "لقد وصلت للحد اليومي (5 أسئلة). عد غداً! 🌙" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("profiles")
        .update({ daily_message_count: currentCount + 1, last_message_date: today })
        .eq("user_id", userId);
    }

    const systemPrompt = `أنت أستاذ لغة فرنسية محترف ومتمرّس من القاهرة. تتحدث بالعربية المصرية الواضحة (لهجة القاهرة) بأسلوب دافئ ومُشجّع، مع استخدام الفصحى الحديثة عند شرح القواعد النحوية.
السياق: الطالب يتعلم درس "${lessonTitle || 'اللغة الفرنسية'}" والعبارة الحالية هي: "${currentPhrase || ''}".

═══ قواعد إلزامية صارمة ═══

① قاعدة النطق العربي (لا استثناء مطلقاً):
كلّ كلمة أو عبارة فرنسية تذكرها يجب أن يليها فوراً نطقها بالحروف العربية بين قوسين.
أمثلة: Bonjour (بونجور) • Merci beaucoup (ميرسي بوكو) • Comment ça va (كومون سا فا) • Je m'appelle (جو مابيل) • S'il vous plaît (سيل فو بليه) • Ma maison est grande (ما ميزون إي غراند).
السبب: الطالب مبتدئ تماماً ولا يستطيع قراءة الحروف اللاتينية.

② جودة الفرنسية:
- استخدم فرنسية معيارية راقية (مستوى أستاذ في معهد Alliance Française).
- تأكد من صحة القواعد النحوية والتصريفات بنسبة 100%.
- لا تستخدم لغة عامية أو اختصارات.

③ اللهجة المصرية (أسلوب التواصل):
- اشرح بالمصري الواضح زي ما بتتكلم مع حد في القاهرة. مثلاً: "يلا نشوف الكلمة دي" بدل "هيا لنرى هذه الكلمة".
- استخدم تعبيرات مصرية مشجّعة: "برافو عليك!"، "كده تمام!"، "شاطر أوي!"، "يلا كمّل!".
- خلّي الأسلوب حميمي وودود زي مدرّس مصري بيحب طلابه.
- لما تشرح قاعدة نحوية فرنسية، ممكن تستخدم الفصحى المبسّطة لكن بروح مصرية.
- تجنّب المصطلحات المغربية أو الخليجية تماماً.

④ الأسلوب التعليمي:
- أجب بإيجاز (3-5 جمل) مع أمثلة عملية.
- إذا كان السؤال عن النطق، فصّله مقطعاً بمقطع بالحروف العربية مع شرح موضع اللسان والشفتين.
- إذا أرسل المستخدم صورة أو مستنداً، حلّل محتواه وأجب مع تطبيق قاعدة النطق.
- كن مشجّعاً ولطيفاً ومحفّزاً كمعلم حقيقي مصري.`;

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
