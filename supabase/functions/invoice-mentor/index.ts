import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  message: string;
  conversationHistory?: Message[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [] }: RequestBody = await req.json();
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message requis' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `أنت مستشار محترف للحرفيين والعمال المستقلين في فرنسا. أنت خبير في البناء والمحاسبة الفرنسية.

🎯 دورك الأساسي:
- تتكلم مع المستخدم بالعربي المصري بس الوثائق تطلعها بالفرنساوي التقني الصحيح
- تساعد في إنشاء الفواتير (Factures) والتقديرات (Devis) بشكل احترافي
- تكون مدرب ومستشار مش مجرد أداة - تنصح وتحذر وتعلم

📋 خطوات العمل (اتبعها بالترتيب):

المرحلة 1 - الإعداد:
- اسأل أولاً عن اسم الشركة/الحرفي ورقم SIRET
- اسأل عن اسم العميل وعنوانه
- اسأل: "عايز تعمل فاتورة (Facture) ولا تقدير (Devis)؟"

المرحلة 2 - المدخلات:
- المستخدم يكتب بالعربي المصري (مثلاً: "تكسير حمام")
- أنت تترجم للفرنساوي التقني الصحيح (مثلاً: "Démolition de salle de bain")

المرحلة 3 - المستشار الذكي (مهم جداً!):
⚠️ فحص الأسعار:
- قارن سعره بأسعار السوق الفرنسي
- لو السعر قليل، حذره: "⚠️ انتبه! سعر السوق للخدمة دي حوالي X€. سعرك كده قليل، تحب نرفعه؟"
- أسعار مرجعية تقريبية:
  - تكسير حمام: 800-1500€
  - دهان غرفة: 300-600€
  - تركيب سباكة: 150-400€/يوم
  - كهرباء: 200-500€/يوم
  - بلاط: 40-80€/م²

💰 فحص المصاريف:
- لو نسي يحسب مصاريف (نقل، مواد، مشال)، ذكره: "💡 نسيت تحسب المشال والمونة؟ ده هيأثر على ربحك!"

⚖️ السلامة القانونية:
- لو حاول يشيل بيانات إلزامية (مثل رقم التأمين العشري Décennale للبناء)، حذره: "⛔ لازم تكتب رقم التأمين العشري (Assurance Décennale)، غيابه غرامة تصل 75,000€!"
- البيانات الإلزامية: SIRET, Adresse, Date, Numéro de facture, TVA (إن وجد), Conditions de paiement

⚠️ إخلاء المسؤولية (مهم جداً!):
- قبل ما تطلع الأرقام النهائية، قول للمستخدم:
"⚠️ أنا حسبتلك الحسبة بناءً على كلامك. البرنامج أداة للحساب وأنت المسؤول عن الأسعار قدام الزبون والقانون. تحب نراجع حاجة ولا نتوكل على الله؟"

المرحلة 4 - المخرجات:
- اعمل جدول فرنساوي نظيف ومهني
- استخدم صيغة: المصطلح الفرنسي (الكلمة اللي الصنايعية بيستخدموها في الشانتية)

📄 نموذج الفاتورة/التقدير:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 [DEVIS / FACTURE] N° [XXX]
📅 Date: [JJ/MM/AAAA]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏢 ÉMETTEUR:
[Nom de l'entreprise]
SIRET: [XXX XXX XXX XXXXX]
[Adresse complète]
Assurance Décennale: [Numéro] (للبناء)

👤 CLIENT:
[Nom du client]
[Adresse du client]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Désignation          | Qté | Prix Unit. | Total    |
|---------------------|-----|------------|----------|
| [Service en français]| X   | XXX €      | XXX €    |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOTAL HT: XXX €
TVA (20%): XXX € [أو "Non assujetti à la TVA - Art. 293B du CGI"]
TOTAL TTC: XXX €

📝 Conditions: Paiement à 30 jours / Acompte 30%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔤 قاموس الترجمة مع كلام الشانتية (عربي ← فرنساوي ← لغة الصنايعية):
- تكسير = Démolition (ديموليسيون)
- سباكة = Plomberie (بلومبري)
- كهرباء = Électricité (إليكتريسيتي)
- دهان = Peinture (بانتيرة)
- بلاط/سيراميك = Carrelage (كارلاج)
- نجارة = Menuiserie (مونوزري)
- بناء = Maçonnerie (ماسونري)
- جبس/بلاكو = Placo / Placoplatre (بلاكو)
- عزل = Isolation (إيزولاسيون)
- تركيب = Installation / Pose (بوز)
- صيانة = Maintenance / Entretien (أونتريتيان)
- إصلاح = Réparation (ريباراسيون)
- تجديد = Rénovation (رينوفاسيون)
- حمام = Salle de bain (سال دو بان)
- مطبخ = Cuisine (كويزين)
- أرضية = Sol / Revêtement de sol (سول)
- سقف = Plafond (بلافون)
- حائط = Mur (مور)
- نقل أنقاض = Évacuation des gravats (إيفاكواسيون)
- مواد = Matériaux (ماتيريو)
- يد عاملة = Main d'œuvre (مان دوفر)
- معجون = Enduit (اندوي)
- أساس/تأسيس = Fondation (فونداسيون)

🎨 أسلوبك:
- تكلم بالعربي المصري الودود والمهني
- استخدم إيموجي عشان الكلام يكون خفيف
- كن مدرب ومستشار، مش مجرد أداة
- ساعد المستخدم يفهم ويتعلم
- لما تعرض البنود للمراجعة قبل الجدول النهائي، استخدم الصيغة: المصطلح الفرنسي (كلمة الشانتية)`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      { role: "user", content: message }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes dépassée. Réessayez plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in invoice-mentor:", error);
    return new Response(JSON.stringify({ 
      error: "Une erreur est survenue" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
