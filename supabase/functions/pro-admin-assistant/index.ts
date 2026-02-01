import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface UserProfile {
  full_name?: string;
  address?: string;
  phone?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  userMessage: string;
  imageData?: string;
  profile?: UserProfile;
  conversationHistory?: ConversationMessage[];
}

const MAX_MESSAGE_LENGTH = 5000;

function buildSystemPrompt(profile?: UserProfile): string {
  const profileInfo = profile ? `
معلومات المستخدم (للاستخدام في الخطابات):
- الاسم: ${profile.full_name || '[غير متوفر]'}
- العنوان: ${profile.address || '[غير متوفر]'}
- التليفون: ${profile.phone || '[غير متوفر]'}
` : '';

  return `أنت مستشار قانوني ومحاسب متخصص للحرفيين والـ Auto-entrepreneurs المصريين في فرنسا.

🎯 **شخصيتك:**
- اسمك "مساعد الارتيزان الذكي"
- تتكلم بالمصري العامي بشكل ودود ومهني
- خبرتك في قانون العمل والضرائب الفرنسي للمهنيين المستقلين
- هدفك مساعدة الحرفيين يفهموا حقوقهم وواجباتهم

${profileInfo}

📋 **مجالات خبرتك:**

1. **URSSAF & RSI (الاشتراكات الاجتماعية):**
   - شرح "Appel de cotisations" (طلب الاشتراكات)
   - فهم "Régularisation" (التسوية السنوية)
   - حساب الاشتراكات بناءً على CA (رقم الأعمال)
   - شرح الفرق بين URSSAF و CIPAV
   - المواعيد النهائية والغرامات

2. **الضرائب (Impôts):**
   - CFE (Cotisation Foncière des Entreprises)
   - TVA (متى تدفع ومتى معفي)
   - IR (ضريبة الدخل للـ Auto-entrepreneur)
   - "Versement Libératoire" - الدفع التحريري
   - التصريحات الشهرية/الفصلية

3. **الفواتير غير المدفوعة (Impayés):**
   - كتابة "Lettre de Relance" (خطاب مطالبة)
   - "Mise en Demeure" (إنذار رسمي)
   - إجراءات "Injonction de Payer" (أمر الدفع)
   - التقادم (délai de prescription)

4. **التأمين العشري (Assurance Décennale):**
   - شرح التغطية والالتزامات
   - متى تحتاج التأمين؟
   - كيف تختار شركة التأمين
   - الإعلان عن الحوادث (Déclaration de Sinistre)

5. **منازعات الشغل (Litiges):**
   - الرد على ادعاءات "Malfaçon" (عيوب في العمل)
   - "Réserves" (تحفظات) في استلام الأشغال
   - "Garantie de Parfait Achèvement" (ضمان الإنجاز التام)
   - حقوقك لما الزبون يرفض يستلم

📝 **قواعد الردود:**

1. **الشرح:** اشرح الموقف بالمصري البسيط أولاً
2. **القانون:** اذكر المواد القانونية المناسبة (Code du Commerce, Code Civil)
3. **العمل:** اقترح خطوات عملية واضحة
4. **تحليل الصور:** لما المستخدم يبعتلك صورة مستند:
   - اقرأ المستند بعناية
   - اشرح محتواه بالمصري
   - حدد المطلوب من المستخدم
   - اقترح الرد المناسب
5. **الخطابات:** لما تكتب خطاب رسمي:
   - اكتبه بالفرنسي الرسمي
   - اذكر المواد القانونية
   - استخدم التنسيق المهني
   - ضع التاريخ الحالي

⚠️ **تنبيه دائم:**
في نهاية أي استشارة مهمة، ذكّر المستخدم:
"ده رأي استشاري. للقرارات الكبيرة، استشر محامي أو محاسب معتمد."

📅 التاريخ الحالي: ${new Date().toLocaleDateString('fr-FR')}`;
}

function validateInput(body: unknown): { valid: true; data: RequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Corps de requête invalide' };
  }

  const { userMessage, imageData, profile, conversationHistory } = body as RequestBody;

  // Allow empty message if image is present
  if ((!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) && !imageData) {
    return { valid: false, error: 'Message utilisateur ou image requis' };
  }

  const message = userMessage || '';
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message trop long (max ${MAX_MESSAGE_LENGTH} caractères)` };
  }

  let validatedHistory: ConversationMessage[] = [];
  if (conversationHistory && Array.isArray(conversationHistory)) {
    validatedHistory = conversationHistory
      .slice(-10)
      .filter(msg => 
        msg && 
        typeof msg === 'object' && 
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string'
      );
  }

  return { valid: true, data: { userMessage: message.trim(), imageData, profile, conversationHistory: validatedHistory } };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const rawBody = await req.json();
    
    const validation = validateInput(rawBody);
    if (!validation.valid) {
      console.log("Validation error:", validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userMessage, imageData, profile, conversationHistory } = validation.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = buildSystemPrompt(profile);
    const hasImage = !!imageData;
    
    console.log("Pro Admin Assistant - Processing request:", userMessage.substring(0, 100), "hasImage:", hasImage);
    
    // Build messages array
    const aiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: "system", content: systemPrompt }
    ];
    
    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }
    
    // Build user message with optional image
    if (hasImage) {
      // Use multimodal format for vision
      const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
      
      // Add image first
      userContent.push({
        type: "image_url",
        image_url: { url: imageData }
      });
      
      // Add text instruction
      const textPrompt = userMessage || 'حلل المستند ده وقولي إيه المكتوب فيه وإيه المطلوب مني';
      userContent.push({
        type: "text",
        text: textPrompt
      });
      
      aiMessages.push({ role: "user", content: userContent });
    } else {
      aiMessages.push({ role: "user", content: userMessage });
    }
    
    // Use vision-capable model for images
    const model = hasImage ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview";
    
    console.log("Pro Admin Assistant - Using model:", model);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: aiMessages,
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

    console.log("Pro Admin Assistant - Response generated successfully, length:", content.length);

    return new Response(JSON.stringify({ response: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in pro-admin-assistant:", error);
    return new Response(JSON.stringify({ 
      error: "Une erreur est survenue lors du traitement de votre demande" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
