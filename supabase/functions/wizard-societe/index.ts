// Public edge function for the /creer-ma-societe wizard.
// No auth required. Returns AI-generated final recommendation in Egyptian Arabic.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { anthropicCompatFetch } from "../_shared/anthropic-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `أنت مستشار خبير في تأسيس الشركات في فرنسا للحرفيين العرب.
بتتكلم بالعامية المصرية، أسلوبك دافي ومشجع.

مهمتك: تحلل إجابات المستخدم وتقدمله:
1. توصية واضحة على نوع الشركة المناسب (Auto-entrepreneur / SASU / SARL) مع سبب الاختيار بالعامية.
2. قائمة مرتبة بالخطوات اللي محتاج يعملها.

قواعد القرار:
- Auto-entrepreneur: لو لوحده + دخل أقل من 77,700€ + نشاط بسيط بدون تأمين عشري.
- SASU: لوحده + دخل أعلى أو محتاج assurance décennale (دهان، بناء، سباكة كبيرة).
- SARL: لو معاه شركاء.

التنسيق:
## التوصية
[نوع الشركة + ليه]

## الخطوات المطلوبة
1. ...
2. ...

ما تكتبش مقدمة طويلة. ابدأ بالتوصية على طول.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { answers } = await req.json();
    if (!answers || typeof answers !== "object") {
      return new Response(JSON.stringify({ error: "Invalid answers" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ============= Pre-validation: blocking cases =============
    const all = Object.values(answers).filter((v) => typeof v === "string").join(" ").toLowerCase();
    const residence = String(answers.residence || "").toLowerCase();
    const activite = String(answers.activite || "").toLowerCase();

    const euForeignResidence = /(italie|italien|italienne|italie|espagne|espagnol|allemagne|portugal|belgique|pays-bas|hollande|إيطالي|ايطالي|اسبان|إسبان|ألماني|برتغال|بلجيك)/i.test(residence + " " + all)
      && !/(france|française|francais|résidence française|إقامة فرنسي|فرنسي|جنسية فرنسي|لاجئ|حماية دولية|refugié|réfugié|protection)/i.test(residence + " " + all);

    const vtcActivity = /(uber|vtc|taxi|chauffeur|توصيل|أوبر|اوبر|تاكسي|سواق)/i.test(activite + " " + all);

    const messages: string[] = [];
    if (euForeignResidence) {
      messages.push(`يا صديقي، الإقامة الإيطالية مش بتسمحلك تفتح شركة في فرنسا مباشرة 🚫 عشان تفتح شركة في فرنسا لازم يكون عندك إما إقامة فرنسية سارية، أو جنسية فرنسية، أو وضع لاجئ/حماية دولية في فرنسا. نصيحتي: اتواصل مع une association d'aide aux entrepreneurs étrangers أو استشر محامي متخصص في droit des étrangers.`);
    }
    if (vtcActivity) {
      messages.push(`شغل Uber و VTC في فرنسا محتاج رخصة خاصة (carte professionnelle VTC) وامتحان صعب بالفرنساوي، وده غير فتح الشركة العادية. ده موضوع تخصصي خارج نطاق مساعدتي — نصيحتي تتواصل مع un organisme agréé VTC.`);
    }

    if (messages.length > 0) {
      const intro = messages.length > 1
        ? `يا صديقي، في عندك عقبتين مش واحدة، خليني أوضحهم:\n\n`
        : "";
      const blocked = intro + messages.map((m, i) => messages.length > 1 ? `${i + 1}. ${m}` : m).join("\n\n");
      return new Response(JSON.stringify({ content: blocked, blocked: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMessage = `إجابات المستخدم:
- النشاط: ${answers.activite || "غير محدد"}
- لوحده ولا مع شركاء: ${answers.associes || "غير محدد"}
- الدخل السنوي المتوقع: ${answers.revenus || "غير محدد"}
- إقامة/جنسية فرنسية: ${answers.residence || "غير محدد"}
- رأس المال: ${answers.capital || "غير محدد"}

حلل وقدم التوصية والخطوات.`;

    const response = await anthropicCompatFetch({
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wizard-societe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
