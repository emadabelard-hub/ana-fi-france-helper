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
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { userMessage, imageData, imageDataArray, pdfText, profile, language } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Collect all images
    const allImages: string[] = [];
    if (imageData) allImages.push(imageData);
    if (imageDataArray && Array.isArray(imageDataArray)) allImages.push(...imageDataArray);

    if (!userMessage && allImages.length === 0 && !pdfText) {
      return new Response(JSON.stringify({ error: "Aucun contenu à analyser" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const profileBlock = buildProfileBlock(profile);

    const systemPrompt = `أنت "المستشار الاحترافي" يا فندم - مستشار قانوني ومهني ومالي واجتماعي متخصص في مساعدة الجالية العربية في فرنسا.

تاريخ النهاردة: ${currentDate}

🎯 مهمتك:
لما المستخدم يبعتلك مستند فرنسي (صورة أو نص أو PDF)، لازم تعمل كده بالظبط:
ملاحظة: ممكن المستخدم يبعت أكتر من مستند مع بعض. حللهم كلهم كملف واحد متكامل.

${profileBlock}

📋 شكل الرد المطلوب (لازم تلتزم بيه بالظبط):

===ترجمة_وشرح===
1. ترجم المستند من الفرنسي للعربي بالعامية المصرية الراقية، فقرة فقرة.
2. اشرح بكلام بسيط إيه المطلوب من المستخدم بالظبط.
3. وضّح المواعيد النهائية والمبالغ المالية لو موجودة.
4. اشرح المصطلحات الإدارية الفرنسية المعقدة (واكتب كل مصطلح فرنسي بالحروف العربية بين قوسين).

===تحليل_مهني===
1. حدد نوع المستند (جواب من الكاف (CAF)؟ قرار من البريفكتير (Préfecture)؟ إشعار ضرايب؟ عقد شغل؟ فاتورة؟).
2. خد دور المحامي أو المحاسب أو المساعد الاجتماعي حسب نوع المستند.
3. اشرح الحقوق والواجبات القانونية المتعلقة.
4. حدد المواد القانونية اللي ليها علاقة (CESEDA, Code du travail, CSS, CGI, إلخ).
5. قدّم خطة عمل مرقمة (1، 2، 3...) بالخطوات اللازمة.
6. حدد الورق المطلوب والمواعيد النهائية.
7. اذكر المواقع الرسمية اللي ليها علاقة.

===مسودة_رسمية===
اكتب خطاب رسمي (Lettre) أو إيميل (Email) بالفرنسي المهني.
- استخدم بيانات المستخدم دي أوتوماتيك في ترويسة الخطاب:
  ${profile?.full_name ? `الاسم: ${profile.full_name}` : 'الاسم: [يرجى إدخال الاسم في البروفايل]'}
  ${profile?.address ? `العنوان: ${profile.address}` : 'العنوان: [يرجى إدخال العنوان في البروفايل]'}
  ${profile?.phone ? `التليفون: ${profile.phone}` : 'التليفون: [يرجى إدخال رقم التليفون في البروفايل]'}
- استخرج أوتوماتيك رقم المرجع (Référence / N° de dossier) من المستند وحطه في الخطاب.
- اكتب "Objet:" مناسب.
- استخدم فرنسي رسمي ومقنع.
- اذكر المواد القانونية المناسبة.
- ما تستخدمش أي placeholders زي [Nom] - استخدم البيانات الفعلية أو اكتب "À compléter".

===تعليمات_الإرسال===
1. **اسم المستلم**: اكتب الاسم الكامل للجهة المستلمة.
2. **عنوان المستلم**: اكتب العنوان البريدي الكامل.
3. **رقم المرجع**: اذكر رقم المرجع/الملف اللي استخرجته من المستند.
4. **إيه تكتب على الظرف**: اكتب بالظبط إيه اللي لازم يتكتب على الظرف (اسم المستلم + العنوان).
5. **نصيحة الإرسال**: لازم يتبعت بـ "Lettre Recommandée avec Accusé de Réception" (ليتر ريكوموندي) ولا لأ؟

⚠️ قواعد صارمة:
- الترجمة والشرح والتحليل: بالعامية المصرية الراقية يا فندم.
- المسودة الرسمية: بالفرنسي بس.
- تعليمات الإرسال: بالمصري مع كتابة الأسماء والعناوين بالفرنسي.
- استخرج دايماً رقم المرجع أوتوماتيك.
- ما تستخدمش أي حروف سيريلية أو يونانية أو صينية.
- كن دقيق في الأرقام والمبالغ والتواريخ - تحقق منهم مرتين.
- استخدم كلمات زي "يا فندم"، "متقلقش"، "خليني أوضحلك" عشان الكلام يبقى ودود ومهني.`;

    // Build messages array
    const aiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: "system", content: systemPrompt },
    ];

    // Build user content parts
    const userText = pdfText
      ? `المستخدم أرسل مستند PDF. محتوى المستند:\n\n${pdfText}\n\n${userMessage || 'حلل هذا المستند وقدم لي التحليل الكامل.'}`
      : (userMessage || 'حلل هذا المستند وقدم لي التحليل الكامل.');

    if (allImages.length > 0) {
      const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: "text", text: allImages.length > 1
          ? `${userText}\n\nالمستخدم أرسل ${allImages.length} صور/مستندات. حللها جميعاً كملف واحد متكامل.`
          : userText },
      ];
      for (const img of allImages) {
        contentParts.push({ type: "image_url", image_url: { url: img } });
      }
      aiMessages.push({ role: "user", content: contentParts });
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
        model: "google/gemini-2.5-flash",
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
