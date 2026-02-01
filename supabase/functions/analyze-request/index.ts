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

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface MissingField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

interface FilledData {
  [key: string]: string;
}

interface RequestBody {
  userMessage: string;
  profile?: UserProfile;
  conversationHistory?: ConversationMessage[];
  generateLetterWithData?: FilledData;
  imageData?: string; // Base64 image for vision analysis
}

// Input validation constants
const MAX_MESSAGE_LENGTH = 5000;
const MAX_FIELD_LENGTH = 500;
const ALLOWED_PROFILE_FIELDS = ['full_name', 'address', 'phone', 'caf_number', 'foreigner_number', 'social_security'];

// Field definitions for missing info detection
const FIELD_DEFINITIONS: Record<string, MissingField> = {
  full_name: {
    key: 'full_name',
    label: 'اكتب اسمك بالكامل هنا',
    placeholder: 'مثال: محمد أحمد علي',
  },
  address: {
    key: 'address',
    label: 'عنوانك في فرنسا',
    placeholder: 'مثال: 12 rue de Paris, 75001 Paris',
  },
  phone: {
    key: 'phone',
    label: 'رقم تليفونك',
    placeholder: 'مثال: 06 12 34 56 78',
  },
  caf_number: {
    key: 'caf_number',
    label: 'رقم الملف عند الكاف (CAF)',
    placeholder: 'مثال: 1234567A',
  },
  foreigner_number: {
    key: 'foreigner_number',
    label: 'رقم الأجنبي (Numéro Étranger)',
    placeholder: 'مثال: 1234567890',
  },
  social_security: {
    key: 'social_security',
    label: 'رقم الضمان الاجتماعي',
    placeholder: 'مثال: 1 23 45 67 890 123 45',
  },
  recipient_name: {
    key: 'recipient_name',
    label: 'اسم الجهة أو الشخص المرسل إليه',
    placeholder: 'مثال: CAF de Paris / Préfecture de Police',
  },
  reference_number: {
    key: 'reference_number',
    label: 'رقم المرجع أو الملف (لو موجود في الجواب)',
    placeholder: 'مثال: REF-2024-12345',
  },
  date_of_letter: {
    key: 'date_of_letter',
    label: 'تاريخ الخطاب الأصلي (لو موجود)',
    placeholder: 'مثال: 15/01/2024',
    type: 'text',
  },
  deadline: {
    key: 'deadline',
    label: 'الموعد النهائي للرد (لو موجود)',
    placeholder: 'مثال: 30/01/2024',
    type: 'text',
  },
  birth_date: {
    key: 'birth_date',
    label: 'تاريخ ميلادك',
    placeholder: 'مثال: 15/03/1990',
    type: 'text',
  },
  siret: {
    key: 'siret',
    label: 'رقم SIRET (للحرفيين)',
    placeholder: 'مثال: 123 456 789 00012',
  },
};

function validateInput(body: unknown): { valid: true; data: RequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Corps de requête invalide' };
  }

  const { userMessage, profile, conversationHistory, generateLetterWithData } = body as RequestBody;

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

  // Validate conversation history if provided (limit to last 10 messages)
  let validatedHistory: ConversationMessage[] = [];
  if (conversationHistory && Array.isArray(conversationHistory)) {
    validatedHistory = conversationHistory
      .slice(-10) // Keep only last 10 messages for context
      .filter(msg => 
        msg && 
        typeof msg === 'object' && 
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string'
      );
  }

  // Extract imageData if present
  const imageData = (body as any).imageData;
  
  return { valid: true, data: { userMessage: userMessage.trim(), profile, conversationHistory: validatedHistory, generateLetterWithData, imageData } };
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

    const { userMessage, profile, conversationHistory, generateLetterWithData, imageData } = validation.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check if this is a letter generation request with filled data
    if (generateLetterWithData && Object.keys(generateLetterWithData).length > 0) {
      return await generateLetterWithFilledData(generateLetterWithData, profile, conversationHistory, LOVABLE_API_KEY);
    }

    // Build system prompt with PII minimization - use placeholders for sensitive data
    const systemPrompt = buildSystemPrompt(profile);
    
    console.log("Processing request with message length:", userMessage.length, "history:", conversationHistory?.length || 0, "hasImage:", !!imageData);
    
    // Build messages array with conversation history
    const aiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [
      { role: "system", content: systemPrompt }
    ];
    
    // Add conversation history for context (already validated and limited to 10)
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }
    
    // Add the current user message - with image if provided (Vision API)
    if (imageData) {
      // Use multimodal format for vision analysis
      aiMessages.push({ 
        role: "user", 
        content: [
          { type: "text", text: userMessage || "حلل الصورة دي وقولي إيه المكتوب فيها. لو ده جواب إداري، اشرحلي بالمصري إيه المطلوب مني." },
          { type: "image_url", image_url: { url: imageData } }
        ]
      });
    } else {
      aiMessages.push({ role: "user", content: userMessage });
    }
    
    // Use gemini-2.5-flash for vision (multimodal support) or gemini-3-flash-preview for text
    const model = imageData ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview";
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
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

    // Parse the AI response into sections
    const result = parseAIResponse(content);

    // Check if user is asking for a letter and detect missing fields
    const isLetterRequest = detectLetterRequest(userMessage, content);
    
    if (isLetterRequest) {
      const missingFields = detectMissingFields(profile, content);
      
      if (missingFields.length > 0) {
        // Return missing fields for the form
        return new Response(JSON.stringify({
          ...result,
          requiresMoreInfo: true,
          missingFields: missingFields,
          letterContext: userMessage,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Post-process: Replace placeholders with actual user data
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

function detectLetterRequest(userMessage: string, aiResponse: string): boolean {
  const letterKeywords = [
    'اكتبلي رد', 'اكتب رد', 'عايز رد', 'اكتبلي جواب', 'اكتب جواب',
    'اكتبلي خطاب', 'عايز خطاب', 'محتاج رد', 'محتاج جواب', 'رد رسمي',
    'lettre', 'répondre', 'courrier', 'رسالة رسمية', 'نعم', 'أيوه', 'ايوه', 'اه', 'آه',
    'oui', 'yes', 'اكتب', 'تمام'
  ];
  
  const lowerMessage = userMessage.toLowerCase();
  const hasLetterRequest = letterKeywords.some(keyword => lowerMessage.includes(keyword));
  
  // Also check if the AI response suggests writing a letter
  const aiSuggestsLetter = aiResponse.includes('تحب أكتبلك خطاب') || 
                           aiResponse.includes('اكتبلك رد رسمي') ||
                           aiResponse.includes('أكتبلك جواب');
  
  return hasLetterRequest || (aiSuggestsLetter && letterKeywords.some(k => lowerMessage.includes(k)));
}

function detectMissingFields(profile: UserProfile | undefined, aiResponse: string): MissingField[] {
  const missingFields: MissingField[] = [];
  
  // Always need name and address for formal letters
  if (!profile?.full_name) {
    missingFields.push(FIELD_DEFINITIONS.full_name);
  }
  if (!profile?.address) {
    missingFields.push(FIELD_DEFINITIONS.address);
  }
  
  // Check AI response for context-specific fields
  const responseText = aiResponse.toLowerCase();
  
  // CAF-related
  if ((responseText.includes('caf') || responseText.includes('كاف') || responseText.includes('allocations')) && !profile?.caf_number) {
    missingFields.push(FIELD_DEFINITIONS.caf_number);
  }
  
  // Prefecture/Residence permit related
  if ((responseText.includes('préfecture') || responseText.includes('بريفكتير') || responseText.includes('إقامة') || responseText.includes('titre de séjour')) && !profile?.foreigner_number) {
    missingFields.push(FIELD_DEFINITIONS.foreigner_number);
  }
  
  // Health/Social security related
  if ((responseText.includes('cpam') || responseText.includes('ameli') || responseText.includes('أميلي') || responseText.includes('carte vitale') || responseText.includes('sécurité sociale')) && !profile?.social_security) {
    missingFields.push(FIELD_DEFINITIONS.social_security);
  }
  
  // Always ask for recipient if not obvious
  missingFields.push(FIELD_DEFINITIONS.recipient_name);
  
  // Reference number if mentioned
  if (responseText.includes('référence') || responseText.includes('مرجع') || responseText.includes('numéro de dossier')) {
    missingFields.push(FIELD_DEFINITIONS.reference_number);
  }
  
  return missingFields;
}

async function generateLetterWithFilledData(
  filledData: FilledData,
  profile: UserProfile | undefined,
  conversationHistory: ConversationMessage[] | undefined,
  apiKey: string
): Promise<Response> {
  // Merge profile with filled data
  const mergedProfile = {
    ...profile,
    full_name: filledData.full_name || profile?.full_name,
    address: filledData.address || profile?.address,
    phone: filledData.phone || profile?.phone,
    caf_number: filledData.caf_number || profile?.caf_number,
    foreigner_number: filledData.foreigner_number || profile?.foreigner_number,
    social_security: filledData.social_security || profile?.social_security,
  };

  // Build letter generation prompt with dispatch info extraction
  const letterPrompt = `أنت مساعد متخصص في كتابة الرسائل الإدارية الرسمية بالفرنسي.

بناءً على المحادثة السابقة، اكتب الآن خطاب رسمي متكامل بالفرنسي.

بيانات المرسل:
- الاسم: ${mergedProfile.full_name || '[غير متوفر]'}
- العنوان: ${mergedProfile.address || '[غير متوفر]'}
- التليفون: ${mergedProfile.phone || '[غير متوفر]'}
- رقم CAF: ${filledData.caf_number || mergedProfile.caf_number || '[غير متوفر]'}
- رقم الأجنبي: ${filledData.foreigner_number || mergedProfile.foreigner_number || '[غير متوفر]'}
- رقم الضمان الاجتماعي: ${filledData.social_security || mergedProfile.social_security || '[غير متوفر]'}

المرسل إليه: ${filledData.recipient_name || '[الجهة المعنية]'}
رقم المرجع: ${filledData.reference_number || '[إن وجد]'}

⚠️ مهم جداً:
1. اكتب الخطاب بالفرنسي الرسمي فقط
2. لا تستخدم أي placeholders مثل [Nom] أو [...] - استخدم البيانات الفعلية
3. اذكر المواد القانونية المناسبة (CESEDA, CSS, etc.)
4. اجعل الخطاب مهني ومقنع
5. أضف التاريخ الحالي

ابدأ الخطاب مباشرة بدون مقدمات بالعربي.`;

  const aiMessages: Array<{ role: string; content: string }> = [
    { role: "system", content: letterPrompt }
  ];
  
  // Add conversation history for context
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-6)) {
      aiMessages.push({ role: msg.role, content: msg.content });
    }
  }
  
  aiMessages.push({ 
    role: "user", 
    content: `اكتب الخطاب الرسمي الآن بالفرنسي مستخدماً البيانات المتوفرة.` 
  });

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: aiMessages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI gateway error during letter generation:", response.status, errorText);
    return new Response(JSON.stringify({ error: "Erreur lors de la génération de la lettre" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await response.json();
  const letterContent = data.choices?.[0]?.message?.content;

  if (!letterContent) {
    throw new Error("No content in letter generation response");
  }

  // Extract dispatch information from the filled data and context
  const dispatchInfo = extractDispatchInfo(filledData, letterContent);

  return new Response(JSON.stringify({
    explanation: '',
    actionPlan: '',
    formalLetter: letterContent,
    legalNote: '',
    letterGenerated: true,
    dispatchInfo: dispatchInfo,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractDispatchInfo(filledData: FilledData, letterContent: string): {
  recipientName?: string;
  recipientAddress?: string;
  referenceNumber?: string;
  subjectLine?: string;
} {
  const dispatchInfo: {
    recipientName?: string;
    recipientAddress?: string;
    referenceNumber?: string;
    subjectLine?: string;
  } = {};

  // Get recipient name from filled data
  if (filledData.recipient_name) {
    dispatchInfo.recipientName = filledData.recipient_name;
  }

  // Get reference number from filled data
  if (filledData.reference_number) {
    dispatchInfo.referenceNumber = filledData.reference_number;
  }

  // Try to extract address from letter content
  // Look for common French address patterns
  const addressPatterns = [
    // CAF addresses
    /CAF\s+(?:de\s+)?([^,\n]+),?\s*(\d{5}\s+[A-Za-zÀ-ÿ\s-]+)/i,
    // Prefecture addresses
    /Préfecture\s+(?:de\s+)?([^,\n]+),?\s*(\d{5}\s+[A-Za-zÀ-ÿ\s-]+)/i,
    // CPAM addresses
    /CPAM\s+(?:de\s+)?([^,\n]+),?\s*(\d{5}\s+[A-Za-zÀ-ÿ\s-]+)/i,
    // Generic address with postal code
    /(\d+[,\s]+(?:rue|avenue|boulevard|place)[^,\n]+),?\s*(\d{5}\s+[A-Za-zÀ-ÿ\s-]+)/i,
  ];

  for (const pattern of addressPatterns) {
    const match = letterContent.match(pattern);
    if (match) {
      dispatchInfo.recipientAddress = match[0].trim();
      break;
    }
  }

  // Known institution addresses (common CAF, Préfecture addresses)
  const knownAddresses: Record<string, string> = {
    'caf de paris': 'CAF de Paris\n21 rue Joubert\n75009 Paris',
    'caf de la seine-saint-denis': 'CAF de la Seine-Saint-Denis\n1-9 rue du Chemin Vert\n93000 Bobigny',
    'caf du val-de-marne': 'CAF du Val-de-Marne\n7 avenue du Général de Gaulle\n94000 Créteil',
    'préfecture de police': 'Préfecture de Police\n12-14 quai de Gesvres\n75004 Paris',
    'préfecture de paris': 'Préfecture de Paris\n5 rue Leblanc\n75015 Paris',
    'cpam de paris': 'CPAM de Paris\n21 rue Georges Auric\n75948 Paris Cedex 19',
  };

  // Check if recipient matches known addresses
  if (dispatchInfo.recipientName && !dispatchInfo.recipientAddress) {
    const recipientLower = dispatchInfo.recipientName.toLowerCase();
    for (const [key, address] of Object.entries(knownAddresses)) {
      if (recipientLower.includes(key)) {
        dispatchInfo.recipientAddress = address;
        break;
      }
    }
  }

  // Determine subject line based on context
  const letterLower = letterContent.toLowerCase();
  if (letterLower.includes('réclamation')) {
    dispatchInfo.subjectLine = 'Réclamation';
  } else if (letterLower.includes('recours')) {
    dispatchInfo.subjectLine = 'Recours gracieux';
  } else if (letterLower.includes('demande')) {
    dispatchInfo.subjectLine = 'Demande officielle';
  } else if (letterLower.includes('contestation')) {
    dispatchInfo.subjectLine = 'Contestation de décision';
  } else {
    dispatchInfo.subjectLine = 'Correspondance officielle';
  }

  return dispatchInfo;
}

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
- استخدم الإيموجي عشان الكلام يبقى ودود 😊
- ⭐ مهم جداً: بعد ما تخلص الشرح وخطة العمل، لازم دايماً تسأل المستخدم: "تحب أكتبلك خطاب رسمي (Lettre) للجهة دي عشان تحل المشكلة؟ 📝" - ده بيديله الفرصة يطلب الرد الرسمي لو محتاج`;
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
