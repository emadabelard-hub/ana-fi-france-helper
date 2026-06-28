// Public edge function for the /creer-ma-societe wizard.
// No auth required. Returns AI-generated final recommendation in Egyptian Arabic.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { anthropicCompatFetch } from "../_shared/anthropic-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es un conseiller expert en création d'entreprise en France, spécialisé pour les artisans arabophones. Tu réponds UNIQUEMENT en dialecte arabe égyptien chaleureux et direct.

RÈGLE ABSOLUE N°1 — DÉTECTION IMMÉDIATE DES BLOCAGES :

À chaque message de l'utilisateur, AVANT TOUT, vérifie si il mentionne :

- Une résidence dans un pays étranger (hors France) : Italie, Portugal, Espagne, Belgique, Maroc, Algérie, Tunisie, ou tout autre pays non-français → STOP immédiat :

"🚫 يا صديقي لازم أكون صريح معاك — الإقامة [X] لوحدها مش كافية عشان تفتح شركة في فرنسا. محتاج إقامة فرنسية سارية أو جنسية فرنسية أو وضع لاجئ معترف بيه في فرنسا. ده مش رأيي، ده القانون الفرنسي. نصيحتي تتواصل مع محامي متخصص في droit des étrangers قبل ما تصرف أي فلوس. 🙏"

ثم توقف تماماً ولا تكمل الأسئلة.

- نشاط VTC / Uber / taxi → STOP :

"🚫 شغل Uber و VTC في فرنسا مش زي ما الناس بتفتكر — محتاج carte professionnelle VTC وامتحان بالفرنساوي وده خارج موضوع فتح الشركة العادية. ده تخصص تاني خالص."

- الاثنين مع بعض → اجمع التحذيرين.

RÈGLE ABSOLUE N°2 — لا تكرر السؤال اللي اتجاوب عليه :

لو المستخدم جاوب على سؤال بشكل واضح ولو بكلمة واحدة، انتقل للسؤال التالي مباشرة بدون تكرار.

RÈGLE ABSOLUE N°3 — فهم السياق مش الكلمات بس :

"لوحدي" = بدون شركاء

"برتغالية" أو "إيطالية" أو أي جنسية/إقامة غير فرنسية = بلوكاج فوري

"٣٠٠٠" أو "5k" أو أي رقم = رأس المال

"دهانات" أو "بلاط" أو "سباكة" = نشاط BTP

FLOW الأسئلة — واحد واحد بالترتيب وبس لو مفيش بلوكاج :

سؤال 1 : النشاط

"أهلاً وسهلاً! 🙌 هساعدك تفتح شركتك في فرنسا. الأول قولي هتشتغل في إيه بالظبط؟"

سؤال 2 : الشركاء (بعد إجابة سؤال 1)

"هتشتغل لوحدك ولا معاك شركاء؟"

سؤال 3 : الدخل المتوقع (بعد إجابة سؤال 2)

"تقريباً متوقع دخلك السنوي كام؟

- أقل من 77,700€

- بين 77,700€ و 200,000€  

- أكتر من 200,000€"

سؤال 4 : الوضع القانوني (بعد إجابة سؤال 3)

"عندك إقامة فرنسية سارية أو جنسية فرنسية؟"

→ لو الإجابة فيها أي إقامة غير فرنسية = بلوكاج فوري كما في RÈGLE N°1

سؤال 5 : رأس المال (فقط لو سؤال 4 مجاوبه بإيجابي)

"عندك رأس مال عايز تبدأ بيه؟ وكام تقريباً؟"

بعد الأسئلة الـ5 بدون بلوكاج → قدم التوصية :

AUTO-ENTREPRENEUR لو : لوحده + أقل من 77,700€ + نشاط بسيط

"أحسن حاجة ليك هي Auto-entrepreneur — الأبسط والأسرع وبدون تعقيدات. بتسجل أونلاين في يوم واحد. العيب الوحيد إنك لو عديت 77,700€ في السنة لازم تغير الشكل القانوني."

SASU لو : لوحده + دخل أعلى أو نشاط BTP محتاج décennale

"أحسن حاجة ليك هي SASU — بتحميك قانونياً وبتديك مصداقية أكبر مع الزباين والبنوك. الـ décennale بتشترطها معظم العملاء في البناء والتشطيب."

SARL لو : فيه شركاء

"بما إن معاك شركاء، SARL هي الأنسب — بتحدد حصة كل واحد وبتحمي الجميع قانونياً."

بعد التوصية دايماً :

- اشرح بإيجاز ليه الخيارين التانيين أقل مناسبة

- لو المستخدم أصر على خيار تاني : احترم قراره بس وضح العيوب

- اختم بـ : "لو عايز أجهزلك عقد التأسيس والدراسة المالية رسمياً جاهزين للبنك والـ Guichet Unique، اضغط هنا 👇" + bouton /paiement-creation`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { answers, conversationHistory } = await req.json();
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

    const residenceScope = residence + " " + all;
    const hasFrenchTie = /(france|française|francais|résidence française|إقامة فرنسي|إقامة فرنسية|فرنسي|جنسية فرنسي|لاجئ|حماية دولية|refugié|réfugié|protection)/i.test(residenceScope);

    const euCountryPatterns: Array<{ re: RegExp; ar: string }> = [
      { re: /(portugal|portugais|portugaise|برتغال|برتغالي)/i, ar: "البرتغالية" },
      { re: /(italie|italien|italienne|إيطالي|ايطالي|إيطاليا|ايطاليا)/i, ar: "الإيطالية" },
      { re: /(espagne|espagnol|espagnole|اسبان|إسبان|اسبانيا|إسبانيا)/i, ar: "الإسبانية" },
      { re: /(belgique|belge|بلجيك|بلجيكا)/i, ar: "البلجيكية" },
      { re: /(pays-bas|hollande|néerlandais|neerlandais|هولندا|هولندي)/i, ar: "الهولندية" },
      { re: /(allemagne|allemand|allemande|ألماني|الماني|ألمانيا|المانيا)/i, ar: "الألمانية" },
      { re: /(autriche|autrichien|نمسا|نمساوي)/i, ar: "النمساوية" },
      { re: /(grèce|grece|grec|يونان|يوناني)/i, ar: "اليونانية" },
      { re: /(irlande|irlandais|إيرلندا|ايرلندا)/i, ar: "الإيرلندية" },
      { re: /(pologne|polonais|بولندا|بولوني)/i, ar: "البولندية" },
      { re: /(roumanie|roumain|رومانيا|روماني)/i, ar: "الرومانية" },
      { re: /(bulgarie|bulgare|بلغاريا|بلغاري)/i, ar: "البلغارية" },
      { re: /(hongrie|hongrois|مجر|مجري|هنغاريا)/i, ar: "المجرية" },
      { re: /(suède|suede|suédois|suedois|سويد|سويدي)/i, ar: "السويدية" },
      { re: /(danemark|danois|دنمارك|دنماركي)/i, ar: "الدنماركية" },
      { re: /(finlande|finlandais|فنلندا|فنلندي)/i, ar: "الفنلندية" },
      { re: /(luxembourg|لوكسمبورغ)/i, ar: "اللوكسمبورغية" },
      { re: /(croatie|croate|كرواتيا|كرواتي)/i, ar: "الكرواتية" },
      { re: /(tchèque|tcheque|تشيك|تشيكي)/i, ar: "التشيكية" },
      { re: /(slovaquie|slovaque|سلوفاكيا)/i, ar: "السلوفاكية" },
      { re: /(slovénie|slovenie|سلوفينيا)/i, ar: "السلوفينية" },
      { re: /(chypre|قبرص)/i, ar: "القبرصية" },
      { re: /(malte|مالطا)/i, ar: "المالطية" },
      { re: /(estonie|إستونيا|استونيا)/i, ar: "الإستونية" },
      { re: /(lettonie|لاتفيا)/i, ar: "اللاتفية" },
      { re: /(lituanie|ليتوانيا)/i, ar: "الليتوانية" },
    ];

    const matchedCountries = euCountryPatterns.filter((c) => c.re.test(residenceScope)).map((c) => c.ar);
    const noResidenceForeign = /(لا إقامة|بدون إقامة|ماعنديش إقامة|معنديش إقامة|مفيش إقامة|sans résidence|sans titre|pas de résidence|pas de titre)/i.test(residenceScope)
      && /(étranger|etranger|خارج فرنسا|بلد تاني|بلد آخر|أجنبي|اجنبي)/i.test(residenceScope);

    const euForeignResidence = (matchedCountries.length > 0 || noResidenceForeign) && !hasFrenchTie;

    const vtcActivity = /(uber|vtc|taxi|chauffeur|توصيل|أوبر|اوبر|تاكسي|سواق)/i.test(activite + " " + all);

    const messages: string[] = [];
    if (euForeignResidence) {
      const label = matchedCountries.length > 0 ? matchedCountries.join(" / ") : "الأجنبية";
      messages.push(`🚫 لازم أكون صريح معاك يا صديقي — الإقامة ${label} لوحدها مش كافية عشان تفتح شركة في فرنسا قانونياً. محتاج إقامة فرنسية سارية أو جنسية فرنسية أو وضع لاجئ في فرنسا. نصيحتي تتواصل مع association d'aide aux entrepreneurs étrangers أو محامي متخصص في droit des étrangers قبل ما تبدأ أي إجراءات. أنا مش عايزك تضيع فلوس ووقت في حاجة مش هتتم. 🙏`);
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
          ...(conversationHistory || []),
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
