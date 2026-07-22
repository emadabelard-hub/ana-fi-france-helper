// Public edge function for the /creer-ma-societe wizard.
// No auth required. Returns AI-generated final recommendation in Egyptian Arabic.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { anthropicCompatFetch } from "../_shared/anthropic-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-supabase-client-platform, apikey, content-type",
};

const SYSTEM_PROMPT_AR = `Tu es un conseiller expert en création d'entreprise en France, spécialisé pour les artisans arabophones. Tu réponds UNIQUEMENT en dialecte arabe égyptien chaleureux et direct.

RÈGLE ABSOLUE N°1 — STATUT DE RÉSIDENCE :

- Jamais de blocage si la réponse résidence indique : jonctionnalité française, إقامة فرنسية سارية, statut réfugié/protection en France → OK
- JAMAIS de blocage pour un citoyen d'un pays de l'UE (liberté d'établissement, art. 49 TFUE) : un Portugais, Italien, Espagnol, Roumain, etc. PEUT créer une société en France sans résidence française. Dans ce cas, ajoute dans la réponse finale : "كمواطن أوروبي، من حقك تفتح شركة في فرنسا حتى من غير إقامة فرنسية ✅"
- Blocage UNIQUEMENT pour : ressortissant hors UE sans titre de séjour français valide et sans statut de protection.

RÈGLE ABSOLUE N°2 — VTC/Uber/Taxi :

Bloque toute activité VTC/Uber/taxi avec :
"🚫 شغل Uber و VTC في فرنسا مش زي ما الناس بتفتكر — محتاج carte professionnelle VTC وامتحان بالفرنساوي وده خارج موضوع فتح الشركة العادية. ده تخصص تاني خالص."

RÈGLE ABSOLUE N°3 — ACTIVITÉS MIXTES BTP + HORS-BTP :

Si l'activité mentionne à la fois du BTP ET une activité hors-BTP :
- Confirme que c'est possible (SARL/SASU peut avoir un objet social multiple)
- Précise que l'activité PRINCIPALE détermine le code NAF/APE
- Alerte que la décennale ne couvre QUE le BTP — RC Pro séparée pour le reste
- Recommande de déclarer les deux activités dès la création

بعد الأسئلة الـ5 بدون بلوكاج → قدم التوصية :
AUTO-ENTREPRENEUR لو : لوحده + أقل من 77,700€ + نشاط بسيط
SASU لو : لوحده + دخل أعلى أو نشاط BTP محتاج décennale
SARL لو : فيه شركاء

بعد التوصية دايماً :
- اشرح بإيجاز ليه الخيارين التانيين أقل مناسبة
- اختم بـ : "لو عايز أجهزلك عقد التأسيس والدراسة المالية رسمياً جاهزين للبنك والـ Guichet Unique، اضغط هنا 👇"

⚠️ قاعدة الإيجاز الإلزامية : "الخطوات العملية" لازم يكون 5 خطوات كحد أقصى، كل خطوة سطرين بحد أقصى.`;

const SYSTEM_PROMPT_FR = `Tu es un conseiller expert en création d'entreprise en France, spécialisé pour les artisans. Tu réponds UNIQUEMENT en français professionnel, clair, chaleureux et direct. Jamais un mot en arabe.

RÈGLE ABSOLUE N°1 — STATUT DE RÉSIDENCE :
- Pas de blocage si : nationalité française, titre de séjour français valide, statut réfugié/protection en France.
- JAMAIS de blocage pour un citoyen de l'UE (liberté d'établissement, art. 49 TFUE). Dans ce cas, ajoute : "En tant que citoyen européen, vous avez le droit de créer une société en France, même sans résidence française ✅"
- Blocage UNIQUEMENT pour : ressortissant hors UE sans titre de séjour français valide et sans statut de protection.

RÈGLE ABSOLUE N°2 — VTC/Uber/Taxi :
Bloque toute activité VTC/Uber/taxi avec :
"🚫 L'activité VTC/Uber/Taxi en France exige une carte professionnelle VTC et un examen spécifique. Ce n'est pas une création d'entreprise classique — c'est une démarche à part."

RÈGLE ABSOLUE N°3 — ACTIVITÉS MIXTES BTP + HORS-BTP :
- Confirme la possibilité (SARL/SASU peut avoir un objet social multiple)
- Précise que l'activité PRINCIPALE détermine le code NAF/APE
- Alerte que la décennale ne couvre QUE le BTP — RC Pro séparée pour le reste
- Recommande de déclarer les deux activités dès la création

Après les 5 questions sans blocage → recommandation :
- AUTO-ENTREPRENEUR si : seul + moins de 77 700 € + activité simple
- SASU si : seul + revenu plus élevé ou BTP nécessitant décennale
- SARL si : avec associés

Toujours après la recommandation :
- Explique brièvement pourquoi les deux autres options sont moins adaptées
- Termine par : "Pour préparer vos statuts et votre prévisionnel prêts pour la banque et le Guichet Unique, cliquez ci-dessous 👇"

⚠️ Concision obligatoire : la section « Étapes pratiques » = 5 étapes maximum, deux lignes max par étape.`;

const BLOCK_NON_EU_AR = `🚫 لازم أكون صريح معاك يا صديقي — عشان تفتح شركة في فرنسا وانت من خارج الاتحاد الأوروبي، محتاج إقامة فرنسية سارية أو وضع لاجئ/حماية في فرنسا. أول خطوة: ظبط وضع إقامتك، وبعدها أنا معاك خطوة بخطوة 💪`;
const BLOCK_NON_EU_FR = `🚫 Soyons directs : pour créer une société en France en tant que ressortissant hors Union européenne, il vous faut un titre de séjour français valide ou un statut de réfugié/protection en France. La première étape est donc de régulariser votre situation de résidence — ensuite je vous accompagne pas à pas 💪`;
const BLOCK_VTC_AR = `شغل Uber و VTC في فرنسا محتاج رخصة خاصة (carte professionnelle VTC) وامتحان صعب بالفرنساوي، وده غير فتح الشركة العادية. ده موضوع تخصصي خارج نطاق مساعدتي — نصيحتي تتواصل مع un organisme agréé VTC.`;
const BLOCK_VTC_FR = `L'activité Uber/VTC en France exige une carte professionnelle VTC et un examen spécifique en français — c'est une démarche distincte de la création d'entreprise classique et hors du périmètre de cet assistant. Nous vous recommandons de contacter un organisme agréé VTC.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { answers, language: langRaw } = await req.json();
    if (!answers || typeof answers !== "object") {
      return new Response(JSON.stringify({ error: "Invalid answers" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const language: 'fr' | 'ar' = langRaw === 'fr' ? 'fr' : 'ar';

    const LOVABLE_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    // ============= Pre-validation: blocking cases =============
    const all = Object.values(answers).filter((v) => typeof v === "string").join(" ").toLowerCase();
    const residence = String(answers.residence || "");
    const activite = String(answers.activite || "").toLowerCase();

    const noneOfThem = /لا،?\s*ولا واحدة|ولا واحدة منهم|❌/.test(residence);
    const hasFrenchTie = /(france|française|francais|جنسية فرنسي|إقامة فرنسية|فرنسي|لاجئ|حماية|🇫🇷|🪪)/i.test(residence);
    const isEuCitizen = /(اتحاد الأوروبي|أوروبي|européen|europeen|🇪🇺)/i.test(residence);

    const nonEuForeignBlock = noneOfThem && !hasFrenchTie && !isEuCitizen;
    const vtcActivity = /(uber|vtc|taxi|chauffeur|توصيل|أوبر|اوبر|تاكسي|سواق)/i.test(activite + " " + all);

    const messages: string[] = [];
    if (nonEuForeignBlock) {
      messages.push(language === 'fr' ? BLOCK_NON_EU_FR : BLOCK_NON_EU_AR);
    }
    if (vtcActivity) {
      messages.push(language === 'fr' ? BLOCK_VTC_FR : BLOCK_VTC_AR);
    }

    if (messages.length > 0) {
      const introFR = messages.length > 1 ? `Deux points à clarifier avant d'avancer :\n\n` : "";
      const introAR = messages.length > 1 ? `يا صديقي، في عندك عقبتين مش واحدة، خليني أوضحهم:\n\n` : "";
      const intro = language === 'fr' ? introFR : introAR;
      const blocked = intro + messages.map((m, i) => messages.length > 1 ? `${i + 1}. ${m}` : m).join("\n\n");
      return new Response(JSON.stringify({ content: blocked, blocked: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMessageForAI = language === 'fr'
      ? `Réponses de l'utilisateur :
- Activité : ${answers.activite || "non précisé"}
- Seul ou avec associés : ${answers.associes || "non précisé"}
- Revenu annuel prévu : ${answers.revenus || "non précisé"}
- Statut juridique / résidence : ${answers.residence || "non précisé"}
- Capital : ${answers.capital || "non précisé"}

Analyse et fournis la recommandation et les étapes, EXCLUSIVEMENT en français.${isEuCitizen ? "\n\nNote : l'utilisateur est citoyen européen — ajoute cette phrase dans ta réponse : \"En tant que citoyen européen, vous avez le droit de créer une société en France, même sans résidence française ✅\"" : ""}`
      : `إجابات المستخدم:
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
          { role: "system", content: language === 'fr' ? SYSTEM_PROMPT_FR : SYSTEM_PROMPT_AR },
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
