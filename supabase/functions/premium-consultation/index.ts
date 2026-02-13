import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UserProfile {
  full_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  caf_number?: string;
  foreigner_number?: string;
  social_security?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userMessage, imageData, pdfText, profile, language } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!userMessage && !imageData && !pdfText) {
      return new Response(JSON.stringify({ error: "Aucun contenu à analyser" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = language || 'ar';
    const currentDate = new Date().toLocaleDateString('fr-FR');
    const profileBlock = buildProfileBlock(profile);

    const systemPrompt = `أنت "المستشار الاحترافي" - مستشار قانوني ومهني ومالي واجتماعي متخصص في مساعدة الجالية العربية في فرنسا.

تاريخ اليوم: ${currentDate}

🎯 مهمتك:
عندما يرسل لك المستخدم مستنداً فرنسياً (صورة أو نص أو PDF)، يجب أن تقوم بالتالي بدقة:

${profileBlock}

📋 هيكل الرد المطلوب (يجب أن تلتزم بهذا الشكل بالضبط):

===ترجمة_وشرح===
1. ترجم المستند من الفرنسية إلى العربية الفصحى المبسطة، فقرة فقرة.
2. اشرح بلغة بسيطة ما المطلوب من المستخدم بالضبط.
3. وضّح المواعيد النهائية والمبالغ المالية إن وجدت.
4. اشرح المصطلحات الإدارية الفرنسية المعقدة.

===تحليل_مهني===
1. حدد نوع المستند (رسالة من CAF؟ قرار من Préfecture؟ إشعار ضريبي؟ عقد عمل؟ فاتورة؟).
2. قم بدور المحامي أو المحاسب أو المساعد الاجتماعي حسب نوع المستند.
3. اشرح الحقوق والواجبات القانونية المتعلقة.
4. حدد المواد القانونية ذات الصلة (CESEDA, Code du travail, CSS, CGI, etc.).
5. قدم خطة عمل مرقمة (1، 2، 3...) بالخطوات اللازمة.
6. حدد الأوراق المطلوبة والمواعيد النهائية.
7. اذكر المواقع الرسمية ذات الصلة.

===مسودة_رسمية===
اكتب خطاباً رسمياً (Lettre) أو بريداً إلكترونياً (Email) بالفرنسية المهنية.
- استخدم بيانات المستخدم التالية تلقائياً في ترويسة الخطاب:
  ${profile?.full_name ? `الاسم: ${profile.full_name}` : 'الاسم: [يرجى إدخال الاسم في الملف الشخصي]'}
  ${profile?.address ? `العنوان: ${profile.address}` : 'العنوان: [يرجى إدخال العنوان في الملف الشخصي]'}
  ${profile?.phone ? `الهاتف: ${profile.phone}` : 'الهاتف: [يرجى إدخال رقم الهاتف في الملف الشخصي]'}
- استخرج تلقائياً رقم المرجع (Référence / N° de dossier) من المستند وأدرجه في الخطاب.
- اكتب "Objet:" مناسباً.
- استخدم لغة فرنسية رسمية ومقنعة.
- اذكر المواد القانونية المناسبة.
- لا تستخدم أي placeholders مثل [Nom] - استخدم البيانات الفعلية أو اكتب "À compléter".

===تعليمات_الإرسال===
1. **اسم المستلم**: اكتب الاسم الكامل للجهة المستلمة.
2. **عنوان المستلم**: اكتب العنوان البريدي الكامل.
3. **رقم المرجع**: اذكر رقم المرجع/الملف المستخرج من المستند.
4. **ماذا تكتب على الظرف**: اكتب بالضبط ما يجب كتابته على الظرف (اسم المستلم + العنوان).
5. **نصيحة الإرسال**: هل يجب إرسالها بـ "Lettre Recommandée avec Accusé de Réception"؟

⚠️ قواعد صارمة:
- الترجمة والشرح والتحليل: بالعربية الفصحى المبسطة.
- المسودة الرسمية: بالفرنسية فقط.
- تعليمات الإرسال: بالعربية مع كتابة الأسماء والعناوين بالفرنسية.
- استخرج دائماً رقم المرجع تلقائياً.
- لا تستخدم أي حروف سيريلية أو يونانية أو صينية.
- كن دقيقاً في الأرقام والمبالغ والتواريخ - تحقق منها مرتين.`;

    // Build messages array
    const aiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: "system", content: systemPrompt },
    ];

    // Build user content
    const userText = pdfText
      ? `المستخدم أرسل مستند PDF. محتوى المستند:\n\n${pdfText}\n\n${userMessage || 'حلل هذا المستند وقدم لي التحليل الكامل.'}`
      : (userMessage || 'حلل هذا المستند وقدم لي التحليل الكامل.');

    if (imageData) {
      aiMessages.push({
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: imageData } },
        ],
      });
    } else {
      aiMessages.push({ role: "user", content: userText });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: aiMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "الخدمة مشغولة، حاول مرة أخرى بعد دقيقة." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "رصيد الذكاء الاصطناعي غير كافٍ." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response");

    // Parse the structured response
    const parsed = parseResponse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("premium-consultation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildProfileBlock(profile?: UserProfile): string {
  if (!profile) return "بيانات المستخدم: غير متوفرة (اطلب منه ملء الملف الشخصي).";
  const parts = [];
  if (profile.full_name) parts.push(`الاسم: ${profile.full_name}`);
  if (profile.address) parts.push(`العنوان: ${profile.address}`);
  if (profile.phone) parts.push(`الهاتف: ${profile.phone}`);
  if (profile.email) parts.push(`البريد: ${profile.email}`);
  if (profile.caf_number) parts.push(`رقم CAF: ${profile.caf_number}`);
  if (profile.foreigner_number) parts.push(`رقم الأجنبي: ${profile.foreigner_number}`);
  if (profile.social_security) parts.push(`رقم الضمان: ${profile.social_security}`);
  return parts.length > 0
    ? `بيانات المستخدم المتوفرة:\n${parts.join('\n')}`
    : "بيانات المستخدم: غير متوفرة.";
}

interface ParsedResult {
  translation: string;
  analysis: string;
  draft: string;
  dispatch: string;
}

function parseResponse(content: string): ParsedResult {
  const translationMatch = content.match(/===ترجمة_وشرح===([\s\S]*?)(?====تحليل_مهني===|$)/);
  const analysisMatch = content.match(/===تحليل_مهني===([\s\S]*?)(?====مسودة_رسمية===|$)/);
  const draftMatch = content.match(/===مسودة_رسمية===([\s\S]*?)(?====تعليمات_الإرسال===|$)/);
  const dispatchMatch = content.match(/===تعليمات_الإرسال===([\s\S]*?)$/);

  return {
    translation: translationMatch?.[1]?.trim() || content,
    analysis: analysisMatch?.[1]?.trim() || "",
    draft: draftMatch?.[1]?.trim() || "",
    dispatch: dispatchMatch?.[1]?.trim() || "",
  };
}
