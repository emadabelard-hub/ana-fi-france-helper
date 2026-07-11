// Public edge function for the /creer-ma-societe wizard.
// No auth required. Returns AI-generated final recommendation in Egyptian Arabic.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { anthropicCompatFetch } from "../_shared/anthropic-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-supabase-client-platform, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es un conseiller expert en création d'entreprise en France, spécialisé pour les artisans arabophones. Tu réponds UNIQUEMENT en dialecte arabe égyptien chaleureux et direct.

RÈGLE ABSOLUE N°1 — STATUT DE RÉSIDENCE :

- Jamais de blocage si la réponse résidence indique : jonctionnalité française, إقامة فرنسية سارية, statut réfugié/protection en France → OK
- JAMAIS de blocage pour un citoyen d'un pays de l'UE (liberté d'établissement, art. 49 TFUE) : un Portugais, Italien, Espagnol, Roumain, etc. PEUT créer une société en France sans résidence française. Dans ce cas, ajoute dans la réponse finale : "كمواطن أوروبي، من حقك تفتح شركة في فرنسا حتى من غير إقامة فرنسية ✅"
- Blocage UNIQUEMENT pour : ressortissant hors UE sans titre de séjour français valide et sans statut de protection.

RÈGLE ABSOLUE N°2 — VTC/Uber/Taxi :

Bloque toute activité VTC/Uber/taxi avec :
"🚫 شغل Uber و VTC في فرنسا مش زي ما الناس بتفتكر — محتاج carte professionnelle VTC وامتحان بالفرنساوي وده خارج موضوع فتح الشركة العادية. ده تخصص تاني خالص."

RÈGLE ABSOLUE N°3 — ACTIVITÉS MIXTES BTP + HORS-BTP :

Si l'activité mentionne à la fois du BTP (بناء، كهرباء، سباكة، دهانات، بلاط، تشطيب...) ET une activité hors-BTP (ex: تصليح أجهزة كهربائية / réparation électroménager / تجارة / بيع...) :
- Confirme que c'est possible : une SARL/SASU peut avoir un objet social multiple couvrant les deux activités
- Précise que l'activité PRINCIPALE détermine le code NAF/APE
- Alerte que l'assurance décennale couvre UNIQUEMENT les travaux BTP — l'activité hors-BTP nécessite une RC Pro séparée
- Recommande de déclarer les deux activités dans l'objet social dès la création (éviter une modification payante plus tard)

FLOW الأسئلة — واحد واحد بالترتيب :

سؤال 1 : النشاط
سؤال 2 : الشركاء (لوحده / مع شركاء)
سؤال 3 : الدخل المتوقع
سؤال 4 : الوضع القانوني (جنسية فرنسية / إقامة فرنسية سارية / جنسية أوروبية / ولا واحدة)
سؤال 5 : رأس المال

بعد الأسئلة الـ5 بدون بلوكاج → قدم التوصية :

AUTO-ENTREPRENEUR لو : لوحده + أقل من 77,700€ + نشاط بسيط
"أحسن حاجة ليك هي Auto-entrepreneur — الأبسط والأسرع وبدون تعقيدات."

SASU لو : لوحده + دخل أعلى أو نشاط BTP محتاج décennale
"أحسن حاجة ليك هي SASU — بتحميك قانونياً وبتديك مصداقية أكبر."

SARL لو : فيه شركاء
"بما إن معاك شركاء، SARL هي الأنسب."

بعد التوصية دايماً :
- اشرح بإيجاز ليه الخيارين التانيين أقل مناسبة
- اختم بـ : "لو عايز أجهزلك عقد التأسيس والدراسة المالية رسمياً جاهزين للبنك والـ Guichet Unique، اضغط هنا 👇"

⚠️ قاعدة الإيجاز الإلزامية : قسم "الخطوات العملية" لازم يكون فيه 5 خطوات كحد أقصى، كل خطوة سطرين بحد أقصى. التفاصيل الكاملة موجودة على صفحة /creer-ma-societe فمافيش داعي للإطالة هنا.`;

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
    if (!LOVABLE_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // ============= Pre-validation: blocking cases =============
    const all = Object.values(answers).filter((v) => typeof v === "string").join(" ").toLowerCase();
    const residence = String(answers.residence || "");
    const activite = String(answers.activite || "").toLowerCase();

    // Detect explicit "none" option from the frontend buttons
    const noneOfThem = /لا،?\s*ولا واحدة|ولا واحدة منهم|❌/.test(residence);
    const hasFrenchTie = /(france|française|francais|جنسية فرنسي|إقامة فرنسية|فرنسي|لاجئ|حماية|🇫🇷|🪪)/i.test(residence);
    const isEuCitizen = /(اتحاد الأوروبي|أوروبي|européen|europeen|🇪🇺)/i.test(residence);

    const nonEuForeignBlock = noneOfThem && !hasFrenchTie && !isEuCitizen;

    const vtcActivity = /(uber|vtc|taxi|chauffeur|توصيل|أوبر|اوبر|تاكسي|سواق)/i.test(activite + " " + all);

    const messages: string[] = [];
    if (nonEuForeignBlock) {
      messages.push(`🚫 لازم أكون صريح معاك يا صديقي — عشان تفتح شركة في فرنسا وانت من خارج الاتحاد الأوروبي، محتاج إقامة فرنسية سارية أو وضع لاجئ/حماية في فرنسا. أول خطوة: ظبط وضع إقامتك، وبعدها أنا معاك خطوة بخطوة 💪`);
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

    const userMessageForAI = `إجابات المستخدم:
- النشاط: ${answers.activite || "غير محدد"}
- لوحده ولا مع شركاء: ${answers.associes || "غير محدد"}
- الدخل السنوي المتوقع: ${answers.revenus || "غير محدد"}
- الوضع القانوني: ${answers.residence || "غير محدد"}
- رأس المال: ${answers.capital || "غير محدد"}

حلل وقدم التوصية والخطوات.${isEuCitizen ? "\n\nملحوظة: المستخدم مواطن أوروبي — أضف في ردك الجملة دي: \"كمواطن أوروبي، من حقك تفتح شركة في فرنسا حتى من غير إقامة فرنسية ✅\"" : ""}`;

    const response = await anthropicCompatFetch({
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        max_tokens: 3000,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessageForAI },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: `AI error ${response.status}: ${t}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "";
    const finishReason = data?.choices?.[0]?.finish_reason || null;
    const truncated = finishReason === "length" || finishReason === "MAX_TOKENS";

    return new Response(JSON.stringify({ content, truncated, finish_reason: finishReason }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wizard-societe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
