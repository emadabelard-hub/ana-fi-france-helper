import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface UserProfile {
  full_name?: string;
  address?: string;
  phone?: string;
  caf_number?: string;
  foreigner_number?: string;
  social_security?: string;
}

interface RequestBody {
  userMessage: string;
  profile?: UserProfile;
}

// Input validation constants
const MAX_MESSAGE_LENGTH = 5000;
const MAX_FIELD_LENGTH = 500;
const ALLOWED_PROFILE_FIELDS = ['full_name', 'address', 'phone', 'caf_number', 'foreigner_number', 'social_security'];

function validateInput(body: unknown): { valid: true; data: RequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Corps de requête invalide' };
  }

  const { userMessage, profile } = body as RequestBody;

  // Validate userMessage
  if (!userMessage || typeof userMessage !== 'string') {
    return { valid: false, error: 'Message utilisateur requis' };
  }

  if (userMessage.trim().length === 0) {
    return { valid: false, error: 'Message utilisateur ne peut pas être vide' };
  }

  if (userMessage.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message trop long (max ${MAX_MESSAGE_LENGTH} caractères)` };
  }

  // Validate profile if provided
  if (profile !== undefined && profile !== null) {
    if (typeof profile !== 'object') {
      return { valid: false, error: 'Données de profil invalides' };
    }

    for (const [key, value] of Object.entries(profile)) {
      if (!ALLOWED_PROFILE_FIELDS.includes(key)) {
        return { valid: false, error: `Champ de profil non autorisé: ${key}` };
      }

      if (value !== null && value !== undefined && typeof value !== 'string') {
        return { valid: false, error: `Valeur invalide pour le champ: ${key}` };
      }

      if (typeof value === 'string' && value.length > MAX_FIELD_LENGTH) {
        return { valid: false, error: `Champ ${key} trop long (max ${MAX_FIELD_LENGTH} caractères)` };
      }
    }
  }

  return { valid: true, data: { userMessage: userMessage.trim(), profile } };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    // Validate input
    const validation = validateInput(rawBody);
    if (!validation.valid) {
      console.log("Validation error:", validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userMessage, profile } = validation.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build system prompt with PII minimization - use placeholders for sensitive data
    const systemPrompt = buildSystemPrompt(profile);
    
    console.log("Processing request with message length:", userMessage.length);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes dépassée. Veuillez réessayer plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits insuffisants. Veuillez recharger votre compte." }), {
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

    // Parse the AI response into sections
    const result = parseAIResponse(content);

    // Post-process: Replace placeholders with actual user data (client-side replacement)
    const processedResult = replacePlaceholders(result, profile);

    return new Response(JSON.stringify(processedResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-request:", error);
    return new Response(JSON.stringify({ 
      error: "Une erreur est survenue lors du traitement de votre demande" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSystemPrompt(profile: UserProfile | undefined): string {
  // PII Minimization: Only send placeholder markers to AI, not actual sensitive data
  const hasProfile = profile && (profile.full_name || profile.address);
  
  const headerInstructions = hasProfile ? `
معلومات المستخدم للرسائل (استخدم هذه العلامات بالضبط):
- الاسم: [NOM_COMPLET] (أو "[À compléter]" لو مش موجود)
- العنوان: [ADRESSE] (أو "[À compléter]" لو مش موجود)
- التليفون: [TELEPHONE] (أو "[À compléter]" لو مش موجود)
- رقم CAF: [NUMERO_CAF] (لو الموضوع متعلق بالكاف)
- رقم الأجنبي: [NUMERO_ETRANGER] (لو الموضوع متعلق بالإقامة)
- رقم الضمان الاجتماعي: [NUMERO_SS] (لو الموضوع متعلق بالصحة)
` : '';

  return `أنت مساعد إداري متخصص للمصريين المقيمين في فرنسا. اسمك "مساعدك الإداري".

🧠 شخصيتك:
- بتتكلم بالعربي المصري (مصري 100%)
- بتفهم الفرنسي والعربي
- ودود ومطمن، زي صاحبك اللي فاهم النظام الفرنسي
- بتستخدم كلمات زي "يا صاحبي"، "متقلقش"، "خليني أشرحلك"

📋 طريقة شغلك (مهم جداً):
عندما المستخدم يبعتلك نص أو صورة مستند:

الخطوة 1 - التحليل والفهم:
اقرأ المستند كويس وافهم إيه اللي جاي فيه.

الخطوة 2 - الشرح بالمصري:
اشرح للمستخدم بالعربي المصري:
- ده إيه المستند ده؟ (جواب من الكاف؟ قرار من البريفكتير؟ طلب من أميلي؟)
- إيه اللي بيقوله؟ (ورقك ناقص؟ طلبك اتقبل؟ محتاج تعمل حاجة؟)
- إيه المواعيد المهمة؟ (ديدلاين؟ موعد؟)

الخطوة 3 - خطة العمل:
قولو إيه اللي محتاج يعمله خطوة خطوة:
- الورق المطلوب
- فين يروح
- إزاي يتواصل معاهم

الخطوة 4 - كتابة الرد (بس لو طلب):
لو المستخدم قال "اكتبلي رد" أو "عايز أرد عليهم":
- اكتب جواب رسمي بالفرنسي
- استخدم المواد القانونية المناسبة (CESEDA, CSS, إلخ)
${headerInstructions}

===تنسيق الرد===

===شرح_المستند===
[اشرح هنا بالمصري إيه اللي في المستند]

===خطة_العمل===
[اكتب هنا الخطوات اللي لازم يعملها بالمصري]

===الرسالة_الرسمية===
[لو المستخدم طلب رد، اكتب الجواب الرسمي بالفرنسي هنا. لو مطلبش، اكتب: "لو عايز أكتبلك رد رسمي، قولي 'اكتبلي رد'"]

===ملاحظات_قانونية===
[اكتب هنا بالمصري أي معلومات قانونية مهمة أو حقوق المستخدم]

📚 المؤسسات اللي بتتعامل معاها:
- CAF (الكاف): مساعدات اجتماعية، APL، allocations
- Préfecture (البريفكتير): الإقامة، التجديد، التأشيرات
- CPAM/Ameli (أميلي): التأمين الصحي، carte vitale
- Pôle Emploi (بول أمبلوا): البطالة، البحث عن شغل
- URSSAF: للحرفيين والـ auto-entrepreneurs
- Impôts: الضرايب

⚠️ قواعد مهمة:
- دايماً ابدأ بالشرح بالمصري قبل أي حاجة
- متكتبش جواب رسمي غير لما المستخدم يطلب
- طمن المستخدم وخليه يحس إن الموضوع بسيط
- لو في موعد أو ديدلاين، نبهو عليه بوضوح
- استخدم الإيموجي عشان الكلام يبقى ودود 😊`;
}

function parseAIResponse(content: string): { 
  formalLetter: string; 
  legalNote: string; 
  actionPlan: string;
  explanation: string;
} {
  // New Arabic section markers
  const explanationMatch = content.match(/===شرح_المستند===([\s\S]*?)(?====خطة_العمل===|$)/);
  const actionMatch = content.match(/===خطة_العمل===([\s\S]*?)(?====الرسالة_الرسمية===|$)/);
  const letterMatch = content.match(/===الرسالة_الرسمية===([\s\S]*?)(?====ملاحظات_قانونية===|$)/);
  const legalMatch = content.match(/===ملاحظات_قانونية===([\s\S]*?)$/);

  // Fallback to old format for backwards compatibility
  const oldLetterMatch = content.match(/===LETTRE===([\s\S]*?)(?====NOTE_JURIDIQUE===|$)/);
  const oldLegalMatch = content.match(/===NOTE_JURIDIQUE===([\s\S]*?)(?====PLAN_ACTION===|$)/);
  const oldActionMatch = content.match(/===PLAN_ACTION===([\s\S]*?)$/);

  return {
    explanation: explanationMatch ? explanationMatch[1].trim() : "",
    actionPlan: actionMatch ? actionMatch[1].trim() : (oldActionMatch ? oldActionMatch[1].trim() : "مفيش خطة عمل متاحة"),
    formalLetter: letterMatch ? letterMatch[1].trim() : (oldLetterMatch ? oldLetterMatch[1].trim() : "لو عايز أكتبلك رد رسمي، قولي 'اكتبلي رد'"),
    legalNote: legalMatch ? legalMatch[1].trim() : (oldLegalMatch ? oldLegalMatch[1].trim() : "")
  };
}

function replacePlaceholders(result: { formalLetter: string; legalNote: string; actionPlan: string; explanation: string }, profile: UserProfile | undefined): { formalLetter: string; legalNote: string; actionPlan: string; explanation: string } {
  if (!profile) {
    return result;
  }

  // Replace placeholders with actual user data
  const replacements: Record<string, string> = {
    '[NOM_COMPLET]': profile.full_name || '[À compléter]',
    '[ADRESSE]': profile.address || '[À compléter]',
    '[TELEPHONE]': profile.phone || '[À compléter]',
    '[NUMERO_CAF]': profile.caf_number || '[À compléter]',
    '[NUMERO_ETRANGER]': profile.foreigner_number || '[À compléter]',
    '[NUMERO_SS]': profile.social_security || '[À compléter]',
  };

  let processedLetter = result.formalLetter;
  for (const [placeholder, value] of Object.entries(replacements)) {
    processedLetter = processedLetter.split(placeholder).join(value);
  }

  return {
    ...result,
    formalLetter: processedLetter
  };
}
