import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `إنت مهندس مقاولات خبير في فرنسا عندك 25 سنة خبرة في كل حاجة في البناء. بتتكلم مصري (عامية مصرية) وفرنساوي.

دورك: مخطط فني للمشاريع — بتقدم تقديرات فنية فقط (مواد، عمالة، مراحل، سلامة). ممنوع تماماً أي حسابات مالية أو أسعار أو أرباح أو ضرائب.

قاعدة الكتابة الصوتية (إجبارية):
لكل مصطلح تقني فرنساوي، اكتب النطق بالعربي بالظبط زي ما بيتقال في الشانتييه الفرنساوي:
- Peinture → بانتير (Peinture)
- Devis → دوفي (Devis)
- Ragréage → راغرياج (Ragréage)
- Sous-couche → سوس كوش (Sous-couche)
- Placo / Plâtre → بلاكو (Placo)
- Carrelage → كاريلاج (Carrelage)
- Enduit → أوندوي (Enduit)
- Parquet → باركي (Parquet)
- Électricité → إليكتريسيتي (Électricité)
- Plomberie → بلومبري (Plomberie)
- Sous-traitant → سو تريتون (Sous-traitant)
- Chantier → شانتييه (Chantier)
- Bâche → باش (Bâche)
- Scotch → سكوتش (Scotch)
- Rouleau → رولو (Rouleau)
- Pinceau → بانسو (Pinceau)
- Primaire → بريمير (Primaire)
- Finition → فينيسيون (Finition)
- Crépi → كريبي (Crépi)
- Ponçage → بونساج (Ponçage)
- Échafaudage → إيشافوداج (Échafaudage)
- Joint → جوان (Joint)
- Colle → كول (Colle)
- Ciment → سيمون (Ciment)
- Béton → بيتون (Béton)
- Gouttière → ڨوتيير (Gouttière)
طبّق القاعدة دي على كل المصطلحات التقنية من غير استثناء.

مهم جداً — اللهجة:
- اتكلم بالمصري (عامية مصرية فقط)
- ممنوع أي كلمة مغربية أو تونسية أو جزائرية
- استخدم: إنت، عايز، كده، خلاص، تمام، يعني، أوك، ماشي، هنا، هناك، حاجة، شغل
- ممنوع: واش، بزاف، شكون، كيفاش، ديال

قسم المواد (إجباري):
لازم تضيف قسم "material_provider" في الرد بتاعك يوضح:
- المواد اللي هيجيبها الزبون
- المواد اللي هيجيبها المقاول
- العدد والأدوات المطلوبة

ممنوع تماماً:
- أي أسعار أو أرقام بالـ € في أي حقل
- أي حسابات مالية (margin, profit, TVA, charges)
- أي مقارنات ضريبية (AE vs SARL)
- حقول financial أو social_charges

لما المستخدم يوصف مشروع مع المكان والمدة المتوقعة، لازم ترد بـ JSON منظم (من غير markdown، JSON بس) يحتوي على:

{
  "summary": {
    "fr": "Résumé technique court du chantier",
    "ar": "ملخص تقني قصير بالمصري مع الكتابة الصوتية للمصطلحات"
  },
  "location_impact": {
    "zone": "Paris / Province / etc.",
    "cost_multiplier": 1.15,
    "explanation_fr": "Paris/IDF: +15% sur matériaux et main d'œuvre",
    "explanation_ar": "باريس: +15% على الخامات والشغل"
  },
  "phases": [
    {
      "phase_number": 1,
      "name_fr": "Préparation du chantier",
      "name_ar": "تحضير الشانتييه (Chantier)",
      "duration_days": 1,
      "description_fr": "Protection, décapage, réparation des fissures",
      "description_ar": "تغطية، تقشير، تصليح الشروخ",
      "workers": [
        { "role_fr": "Peintre", "role_ar": "بانتير (Peintre)", "count": 2 }
      ]
    }
  ],
  "material_provider": {
    "client_provides_fr": ["Carrelage choisi par le client"],
    "client_provides_ar": ["كاريلاج (Carrelage) يختاره الزبون"],
    "contractor_provides_fr": ["Colle, joints, outils"],
    "contractor_provides_ar": ["كول (Colle)، جوان (Joint)، عدد"],
    "tools_needed_fr": ["Carrelette, niveau laser, bétonnière"],
    "tools_needed_ar": ["ماكينة قطع، ليزر، خلاطة بيتون (Béton)"]
  },
  "categories": [
    {
      "name_fr": "Nom de la catégorie",
      "name_ar": "اسم الفئة بالمصري مع الكتابة الصوتية",
      "items": [
        {
          "id": "unique_id",
          "name_fr": "Nom de l'élément",
          "name_ar": "اسم العنصر بالمصري مع الكتابة الصوتية",
          "quantity": "quantité avec unité",
          "why_important_fr": "Explication de pourquoi c'est important",
          "why_important_ar": "شرح ليه الحاجة دي مهمة",
          "is_critical": true
        }
      ]
    }
  ],
  "labor": {
    "workers": [
      { "role_fr": "Peintre qualifié", "role_ar": "بانتير متمكن (Peintre qualifié)", "count": 2 }
    ],
    "total_workers": 3,
    "days_needed": 5
  },
  "safety_alerts": [
    {
      "title_fr": "Titre de l'alerte sécurité",
      "title_ar": "عنوان تنبيه الأمان",
      "description_fr": "Description détaillée",
      "description_ar": "وصف تفصيلي",
      "severity": "high"
    }
  ],
  "risks": [
    {
      "fr": "Description du risque",
      "ar": "وصف المخاطر بالمصري"
    }
  ]
}

قاعدة الارتفاع والسلامة (إجبارية):
- لو المستخدم ذكر ارتفاع أكتر من 3 متر (أو كلمات زي: plafond haut, cage d'escalier, façade, étage):
  - لازم تضيف تلقائياً: إيشافوداج (Échafaudage) في المواد
  - لازم تضيف: هارني دو سيكيريتي (Harnais de sécurité) وخوذة وشبكة حماية
  - لازم تضيف قسم "safety_alerts" في الـ JSON
  - لازم تزوّد عدد أيام الشغل بسبب صعوبة العمل على الارتفاع
حتى لو مفيش ارتفاع، ضيف تنبيهات أمان أساسية (حماية العيون، قفازات، إلخ).

قواعد صارمة:
- ممنوع تماماً أي أسعار أو أرقام بالـ € — لا في المواد ولا في العمالة ولا في أي حقل
- ممنوع حقول: unit_price, total_price, daily_rate, financial, social_charges, margin, profit, TVA
- كل عنصر لازم يكون فيه شرح "ليه الحاجة دي مهمة"
- حط is_critical=true للحاجات اللي لو شلتها هيبقى فيه خطر تقني أو قانوني
- دايماً ضيف: حماية (باش Bâche، سكوتش Scotch)، تنضيف آخر الشانتييه
- قسّم الشغل لمراحل زمنية مع العمال المعينين لكل مرحلة
- فصّل كل عامل بتخصصه
- طبّق الكتابة الصوتية العربية على كل المصطلحات التقنية
- دايماً ضيف قسم material_provider
- الـ JSON لازم يكون صالح ويتقرأ مباشرة
- اكتب كل النصوص العربية بالمصري الخالص
- ممنوع تماماً أي رموز ** أو * في النصوص
- كل النصوص العربية والفرنساوية لازم تكون نص عادي بدون تنسيق`;


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description, location, estimatedDuration, materialBuyer } = await req.json();
    if (!description) throw new Error("وصف المشروع ناقص");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const materialContext = materialBuyer === 'client'
      ? 'الزبون هو اللي هيشتري الخامات — المقاول بيجيب العدد والأدوات بس'
      : 'المقاول هو اللي هيشتري كل حاجة (خامات + عدد)';

    const userPrompt = `حلل المشروع ده فنياً وطلّع تقرير تقني بصيغة JSON (بدون أي أسعار أو أرقام مالية):

المكان: ${location || 'مش محدد'}
المدة المتوقعة: ${estimatedDuration || 'مش محددة'}

معلومات إضافية:
- ${materialContext}

وصف الشغل:
${description}

مهم:
- ممنوع تماماً أي أسعار أو أرقام بالـ € — ده تقرير فني فقط
- قسّم لمراحل مع العمال المطلوبين وعددهم
- اكتب كميات المواد (متر مربع، لتر، كيلو) بدون أسعار
- استخدم الكتابة الصوتية العربية لكل المصطلحات التقنية
- ضيف قسم "material_provider" اللي يوضح مين بيجيب إيه
- اكتب كل العربي بالمصري الخالص
- لو فيه ارتفاع أكتر من 3 متر، لازم تضيف إيشافوداج (Échafaudage) ومعدات السلامة تلقائياً
- ضيف قسم "safety_alerts" لتنبيهات الأمان
- ممنوع تماماً استخدام ** أو * في النصوص`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "طلبات كتير، استنى شوية وجرب تاني." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "الرصيد مش كفاية." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Attempt to repair common JSON issues from AI output
    // 1. Remove trailing commas before } or ]
    content = content.replace(/,\s*([}\]])/g, '$1');
    // 2. Fix unescaped newlines inside strings (common AI mistake)
    content = content.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, '\\n');
    // 3. Remove any control characters
    content = content.replace(/[\x00-\x1F\x7F]/g, (ch) => ch === '\n' || ch === '\r' || ch === '\t' ? ' ' : '');
    
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseErr) {
      console.error("JSON parse failed, attempting extraction. Error:", parseErr);
      // Try to extract the largest valid JSON object
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        let extracted = content.slice(firstBrace, lastBrace + 1);
        extracted = extracted.replace(/,\s*([}\]])/g, '$1');
        try {
          analysis = JSON.parse(extracted);
        } catch {
          console.error("JSON extraction also failed. Raw content length:", content.length);
          return new Response(JSON.stringify({ 
            error: "معلش، فيه ضغط على النظام، جرب تبعت الوصف تاني بشوية تفاصيل أقل أو استنى ثواني" 
          }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ 
          error: "معلش، فيه ضغط على النظام، جرب تبعت الوصف تاني بشوية تفاصيل أقل أو استنى ثواني" 
        }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("contracting-assistant error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    const userMsg = msg.includes("timeout") || msg.includes("Timeout")
      ? "معلش، الطلب أخد وقت كتير. جرب تاني بوصف أقصر."
      : "معلش، فيه ضغط على النظام، جرب تبعت الوصف تاني بشوية تفاصيل أقل أو استنى ثواني";
    return new Response(JSON.stringify({ error: userMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
