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
  imageData?: string; // Base64 image for vision analysis (single image)
  multipleImages?: string[]; // Array of base64 images for multi-document analysis
  documentContext?: string; // Context about the session documents
  language?: 'fr' | 'ar'; // Interface language - determines AI response language
}

// Alphabet validation - block Cyrillic, Greek, Chinese, etc.
const CYRILLIC_RANGE = /[\u0400-\u04FF\u0500-\u052F]/;
const GREEK_RANGE = /[\u0370-\u03FF]/;
const CHINESE_RANGE = /[\u4E00-\u9FFF]/;
const JAPANESE_RANGE = /[\u3040-\u309F\u30A0-\u30FF]/;
const KOREAN_RANGE = /[\uAC00-\uD7AF]/;

function detectForbiddenScripts(text: string): string[] {
  const detected: string[] = [];
  if (CYRILLIC_RANGE.test(text)) detected.push('cyrillic');
  if (GREEK_RANGE.test(text)) detected.push('greek');
  if (CHINESE_RANGE.test(text)) detected.push('chinese');
  if (JAPANESE_RANGE.test(text)) detected.push('japanese');
  if (KOREAN_RANGE.test(text)) detected.push('korean');
  return detected;
}

function sanitizeAIResponse(text: string): string {
  // Remove any forbidden characters from AI response
  let result = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Skip Cyrillic (0400-052F), Greek (0370-03FF), Chinese (4E00-9FFF), Japanese (3040-30FF), Korean (AC00-D7AF)
    const isForbidden = 
      (code >= 0x0400 && code <= 0x052F) ||
      (code >= 0x0370 && code <= 0x03FF) ||
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3040 && code <= 0x30FF) ||
      (code >= 0xAC00 && code <= 0xD7AF);
    if (!isForbidden) {
      result += char;
    }
  }
  return result;
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

  // Extract imageData, multipleImages, documentContext, and language if present
  const imageData = (body as any).imageData;
  const multipleImages = (body as any).multipleImages;
  const documentContext = (body as any).documentContext;
  const language = (body as any).language as 'fr' | 'ar' | undefined;
  
  return { 
    valid: true, 
    data: { 
      userMessage: userMessage.trim(), 
      profile, 
      conversationHistory: validatedHistory, 
      generateLetterWithData, 
      imageData,
      multipleImages,
      documentContext,
      language: language || 'ar', // Default to Arabic for backward compatibility
    } 
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

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

    const { userMessage, profile, conversationHistory, generateLetterWithData, imageData, multipleImages, documentContext, language } = validation.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check if this is a letter generation request with filled data
    if (generateLetterWithData && Object.keys(generateLetterWithData).length > 0) {
      return await generateLetterWithFilledData(generateLetterWithData, profile, conversationHistory, LOVABLE_API_KEY);
    }

    // Determine if we have images to analyze
    const hasImages = !!imageData || (multipleImages && multipleImages.length > 0);
    const imageCount = multipleImages?.length || (imageData ? 1 : 0);

    // Build system prompt based on language setting
    // French mode = pure French responses, Arabic mode = Egyptian Arabic
    let systemPrompt = buildSystemPrompt(profile, language || 'ar');
    if (documentContext) {
      systemPrompt += `\n\n📂 DOCUMENT SESSION CONTEXT:\n${documentContext}\nWhen analyzing multiple documents, compare them, find connections, and help the user understand the full picture of their case.`;
    }
    
    console.log("Processing request with message length:", userMessage.length, "history:", conversationHistory?.length || 0, "hasImages:", hasImages, "imageCount:", imageCount);
    
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
    
    // Add the current user message - with images if provided (Vision API)
    if (hasImages) {
      // Use multimodal format for vision analysis
      const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { 
          type: "text", 
          text: multipleImages && multipleImages.length > 1
            ? `${userMessage || 'حلل المستندات دي'}. (${imageCount} documents in the session dossier - analyze all and find connections between them)`
            : (userMessage || "حلل الصورة دي وقولي إيه المكتوب فيها. لو ده جواب إداري، اشرحلي بالمصري إيه المطلوب مني.")
        }
      ];
      
      // Add all images from multipleImages array
      if (multipleImages && multipleImages.length > 0) {
        for (let i = 0; i < multipleImages.length; i++) {
          contentParts.push({ type: "image_url", image_url: { url: multipleImages[i] } });
        }
      } else if (imageData) {
        // Single image
        contentParts.push({ type: "image_url", image_url: { url: imageData } });
      }
      
      aiMessages.push({ role: "user", content: contentParts });
    } else {
      aiMessages.push({ role: "user", content: userMessage });
    }
    
    // Single stable model for all requests
    const model = "openai/gpt-5-mini";
    
    console.log("Using model:", model);
    
    const callModel = async (messages: any, modelName: string): Promise<string> => {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          stream: false,
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          throw new Error("Limite de requêtes dépassée. Veuillez réessayer plus tard.");
        }
        if (resp.status === 402) {
          throw new Error("Crédits insuffisants. Veuillez recharger votre compte.");
        }
        const errorText = await resp.text();
        console.error("AI gateway error:", resp.status, errorText);
        throw new Error("Erreur du service IA");
      }

      const json = await resp.json();
      const c = json.choices?.[0]?.message?.content;
      if (!c) throw new Error("No content in AI response");
      return c;
    };

    let content = await callModel(aiMessages, model);

    // ⚠️ CRITICAL: Block & retry if forbidden alphabets are detected (cyrillic, etc.)
    const forbiddenScripts = detectForbiddenScripts(content);
    if (forbiddenScripts.length > 0) {
      console.warn("Forbidden scripts detected in AI response:", forbiddenScripts);

      const strictRule = `\n\n🔒 RÈGLE ABSOLUE (SORTIE):\n- Interdiction d'utiliser un alphabet autre que latin (français) ou arabe.\n- Interdiction: cyrillique, grec, chinois, japonais, coréen, etc.\n- Réponds strictement selon la langue demandée (FR=français pur, AR=arabe/darija).`;

      const retryMessages = [...aiMessages];
      const sys = String(retryMessages[0]?.content ?? "");
      retryMessages[0] = { role: "system", content: sys + strictRule };

      content = await callModel(retryMessages, model);

      // If still forbidden, sanitize as a last resort (never display raw foreign alphabets)
      const stillForbidden = detectForbiddenScripts(content);
      if (stillForbidden.length > 0) {
        console.warn("Still forbidden after retry; sanitizing.", stillForbidden);
        content = sanitizeAIResponse(content);
      }
    }

    // Parse the AI response into sections
    const result = parseAIResponse(content);

    // Build dispatch info from extracted sender (sender becomes recipient for reply)
    const dispatchInfo = {
      recipientName: result.extractedSender?.name,
      recipientAddress: result.extractedSender?.address,
      referenceNumber: result.extractedSender?.reference,
      subjectLine: result.extractedSender?.subject,
    };

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
          dispatchInfo: dispatchInfo,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Post-process: Replace placeholders with actual user data
    const processedResult = replacePlaceholders(result, profile);

    return new Response(JSON.stringify({
      ...processedResult,
      dispatchInfo: dispatchInfo,
    }), {
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

function buildSystemPrompt(profile: UserProfile | undefined, language: 'fr' | 'ar' = 'ar'): string {
  // PII Minimization: Only send placeholder markers to AI, not actual sensitive data
  const hasProfile = profile && (profile.full_name || profile.address);
  
  // FRENCH MODE: Pure French professional responses
  if (language === 'fr') {
    return buildFrenchSystemPrompt(profile, hasProfile);
  }
  
  // ARABIC MODE: Egyptian Arabic (Masri) responses
  return buildArabicSystemPrompt(profile, hasProfile);
}

function buildFrenchSystemPrompt(profile: UserProfile | undefined, hasProfile: boolean): string {
  const headerInstructions = hasProfile ? `
Informations de l'utilisateur pour les courriers (utilisez ces marqueurs) :
- Nom : [NOM_COMPLET] (ou "[À compléter]" si absent)
- Adresse : [ADRESSE] (ou "[À compléter]" si absent)
- Téléphone : [TELEPHONE] (ou "[À compléter]" si absent)
- Numéro CAF : [NUMERO_CAF] (si le sujet concerne la CAF)
- Numéro Étranger : [NUMERO_ETRANGER] (si le sujet concerne le titre de séjour)
- Numéro Sécurité Sociale : [NUMERO_SS] (si le sujet concerne la santé)
` : '';

  return `Vous êtes un assistant administratif professionnel spécialisé dans l'accompagnement des résidents en France.

⛔ DIRECTIVE LINGUISTIQUE STRICTE:
Vous devez répondre EXCLUSIVEMENT en français. Aucun mot arabe, aucun caractère non-latin.
- Utilisez un français professionnel, précis et adapté au jargon administratif français.
- Ton: courtois, clair, rassurant mais professionnel.

⛔ ALPHABETS INTERDITS:
- Cyrillique (russe, ukrainien): А-Я, а-я
- Grec: Α-Ω
- Arabe: ا-ي (dans vos réponses - l'utilisateur peut écrire en arabe)
- Chinois, japonais, coréen, hébreu, hindi

🔍 AUTO-VÉRIFICATION:
Avant d'envoyer votre réponse, vérifiez:
1. Tout le texte est-il en français ?
2. Y a-t-il des caractères d'alphabets interdits ?
3. Le ton est-il professionnel et adapté ?

⚖️ RÈGLE D'HONNÊTETÉ:
1. Vérifiez que vos conseils s'appliquent au contexte français.
2. Si un courrier n'est pas utile, expliquez pourquoi et proposez une alternative.
3. Si vous n'êtes pas sûr, indiquez-le clairement.

🔢 DOUBLE VÉRIFICATION DES DONNÉES:
- Relisez deux fois les montants, dates et taux de TVA.
- TVA française: 5.5% (rénovation énergétique), 10% (rénovation standard), 20% (construction neuve), 0% (auto-entrepreneurs - art. 293 B CGI).
${headerInstructions}

📋 STRUCTURE DE RÉPONSE:

===ANALYSE===
[Expliquez clairement le document ou la situation]

===PLAN_ACTION===
[Listez les étapes à suivre, documents requis, contacts]

===LETTRE_OFFICIELLE===
[Si demandé et pertinent, rédigez le courrier officiel en français]

===NOTES_JURIDIQUES===
[Informations légales pertinentes, articles de loi applicables]

📚 INSTITUTIONS COURANTES:
- CAF de Paris: 21 rue Joubert, 75009 Paris
- Préfecture de Police de Paris: 12-14 quai de Gesvres, 75004 Paris
- CPAM de Paris: 21 rue Georges Auric, 75948 Paris Cedex 19

⚠️ RÈGLES FINALES:
- Français uniquement - pas d'arabe dans vos réponses
- Toujours vérifier l'absence de caractères étrangers avant d'envoyer
- Proposer un courrier seulement si vraiment utile`;
}

function buildArabicSystemPrompt(profile: UserProfile | undefined, hasProfile: boolean): string {
  
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

⛔⛔⛔ تحذير لغوي صارم - اقرأ ده قبل أي حاجة:
ممنوع منعاً باتاً استخدام أي لغة غير:
1. العربي المصري (الدارجة المصرية) - للشرح والتواصل
2. الفرنسي - للخطابات الرسمية فقط

❌ قائمة الممنوعات:
- الروسي (حروف سيريلية: А-Я، женщинами)
- الأوكراني (حروف سيريلية)
- التركي، الفارسي، الهندي، الصيني، اليوناني
- أي أبجدية غير: العربية (ا-ي) والاتينية (A-Z)
- أي كلمة مش عربي مصري أو فرنسي = ممنوع!

🔍 خطوة التحقق الذاتي (قبل إرسال أي رد):
قبل ما تبعت ردك، اسأل نفسك:
1. هل كل الكلام بالعربي المصري أو الفرنسي فقط؟
2. هل في أي حرف من أبجدية غريبة (سيريلية، يونانية، صينية)؟
3. لو لقيت أي كلمة مش مصري أو فرنسي = امسحها فوراً!

🧠 شخصيتك:
- بتتكلم بالعربي المصري فقط (مصري 100%) للشرح
- بتفهم الفرنسي والعربي المصري والفرانكو
- ودود ومطمن، زي صاحبك اللي فاهم النظام الفرنسي
- بتستخدم كلمات زي "يا صاحبي"، "متقلقش"، "خليني أشرحلك"

⚖️ قاعدة الصدق والدقة القانونية (مهمة جداً):
1. التحقق من الصلاحية الجغرافية:
   - قبل ما تدي أي نصيحة، تأكد إنها تنطبق على فرنسا
   - لو النصيحة مش مناسبة للقانون الفرنسي، قول: "⚠️ تنبيه: الحل ده مش متاح في فرنسا. الصح هو [البديل الفرنسي]."
   - متخترعش حلول مش موجودة في النظام الفرنسي

2. التحقق من جدوى الخطاب:
   - قبل ما تقترح خطاب، اسأل نفسك: "هل الخطاب ده هيفيد المستخدم فعلاً؟"
   - لو الجواب "لأ"، قول بصراحة: "في حالتك دي، مش محتاج خطاب لأن [السبب]. الأفضل تعمل [البديل]."
   - لو المشكلة ممكن تتحل بتليفون أو زيارة أو موقع إلكتروني، قول كده

3. الاعتراف بالحدود:
   - لو مش متأكد من معلومة، قول: "⚠️ الأفضل تتأكد من ده مع [الجهة المختصة] عشان المعلومات ممكن تتغير."
   - متديش نصائح قانونية مؤكدة في مواضيع معقدة - وجه المستخدم لمحامي أو جمعية مساعدة

🔢 قاعدة التحقق المزدوج للأرقام والحسابات:
عند استخراج أو حساب أي أرقام (مبالغ، تواريخ، نسب TVA):
1. اقرأ الرقم مرتين من المستند الأصلي
2. تأكد إن الوحدة صح (€، %، أيام، شهور)
3. لو بتحسب TVA:
   - 5.5% = للتجديدات الموفرة للطاقة (rénovation énergétique)
   - 10% = للتجديدات العادية (rénovation standard)
   - 20% = للبناء الجديد (construction neuve)
   - 0% = لـ Auto-entrepreneurs (مع ذكر المادة 293 B du CGI)
4. لو في شك في أي رقم، قول: "⚠️ تأكد من المبلغ ده في المستند الأصلي: [الرقم]"

📋 طريقة شغلك (مهم جداً):
عندما المستخدم يبعتلك نص أو صورة مستند:

الخطوة 1 - التحليل والاستخراج:
اقرأ المستند كويس واستخرج المعلومات دي بالضبط:
- اسم المرسل (الجهة اللي بعتت الجواب): زي "CAF de Paris" أو "Préfecture de Police"
- عنوان المرسل: العنوان الكامل للجهة
- رقم المرجع/الملف: زي "N° 2024-12345" أو "Réf: ABC123"
- الموضوع: موضوع الجواب
- التاريخ: تاريخ الجواب
- المبالغ المالية: أي أرقام مذكورة (تأكد منها مرتين!)

الخطوة 2 - الشرح بالمصري:
اشرح للمستخدم بالعربي المصري الصافي:
- ده إيه المستند ده؟ (جواب من الكاف؟ قرار من البريفكتير؟ طلب من أميلي؟)
- إيه اللي بيقوله؟ (ورقك ناقص؟ طلبك اتقبل؟ محتاج تعمل حاجة؟)
- إيه المواعيد المهمة؟ (ديدلاين؟ موعد؟)

الخطوة 3 - خطة العمل:
قولو إيه اللي محتاج يعمله خطوة خطوة:
- الورق المطلوب
- فين يروح
- إزاي يتواصل معاهم

الخطوة 4 - اقتراح الرد (بصدق):
⭐ مهم جداً: بعد ما تخلص الشرح وخطة العمل، قرر بصدق:
- لو الخطاب هيفيد فعلاً، اعرض: "تحب أكتبلك خطاب رسمي (Lettre) للجهة دي عشان تحل المشكلة؟ 📝"
- لو الخطاب مش لازم، قول: "في الحالة دي، مش محتاج خطاب. الأحسن تعمل [الحل البديل]."
${headerInstructions}

===تنسيق الرد===

===شرح_المستند===
[اشرح هنا بالمصري إيه اللي في المستند]

===معلومات_المرسل===
- الجهة: [اسم الجهة المرسلة]
- العنوان: [عنوان الجهة الكامل]
- المرجع: [رقم المرجع/الملف]
- الموضوع: [موضوع الجواب]
- التاريخ: [تاريخ الجواب]

===خطة_العمل===
[اكتب هنا الخطوات اللي لازم يعملها بالمصري]

===الرسالة_الرسمية===
[لو المستخدم طلب رد والخطاب مفيد، اكتب الجواب الرسمي بالفرنسي هنا. لو مش مفيد، اشرح ليه.]

===ملاحظات_قانونية===
[اكتب هنا بالمصري أي معلومات قانونية مهمة أو حقوق المستخدم]
⚠️ تذكير: تأكد إن كل النصائح القانونية تنطبق على فرنسا فقط!

📚 المؤسسات اللي بتتعامل معاها وعناوينها:
- CAF de Paris: 21 rue Joubert, 75009 Paris
- CAF de la Seine-Saint-Denis: 1-9 rue du Chemin Vert, 93000 Bobigny
- CAF du Val-de-Marne: 7 avenue du Général de Gaulle, 94000 Créteil
- Préfecture de Police de Paris: 12-14 quai de Gesvres, 75004 Paris
- Préfecture de Paris: 5 rue Leblanc, 75015 Paris
- CPAM de Paris: 21 rue Georges Auric, 75948 Paris Cedex 19
- Pôle Emploi (بول أمبلوا): حسب الوكالة المحلية
- URSSAF: للحرفيين والـ auto-entrepreneurs

⚠️ قواعد صارمة نهائية:
- اللغة: مصري فقط + فرنسي للخطابات الرسمية. ممنوع أي لغة تانية!
- قبل ما تبعت الرد، راجع كل كلمة وتأكد مفيش حروف غريبة!
- دايماً استخرج اسم وعنوان الجهة المرسلة من المستند
- دايماً ابدأ بالشرح بالمصري قبل أي حاجة
- متكتبش جواب رسمي غير لما المستخدم يطلب ويكون الخطاب مفيد فعلاً
- لو في أرقام أو مبالغ، تأكد منها مرتين!
- طمن المستخدم وخليه يحس إن الموضوع بسيط
- لو في موعد أو ديدلاين، نبهو عليه بوضوح
- استخدم الإيموجي عشان الكلام يبقى ودود 😊`;
}

interface ParsedResponse { 
  formalLetter: string; 
  legalNote: string; 
  actionPlan: string;
  explanation: string;
  extractedSender?: {
    name?: string;
    address?: string;
    reference?: string;
    subject?: string;
    date?: string;
  };
}

function parseAIResponse(content: string): ParsedResponse {
  // New Arabic section markers
  const explanationMatch = content.match(/===شرح_المستند===([\s\S]*?)(?====معلومات_المرسل===|===خطة_العمل===|$)/);
  const senderMatch = content.match(/===معلومات_المرسل===([\s\S]*?)(?====خطة_العمل===|$)/);
  const actionMatch = content.match(/===خطة_العمل===([\s\S]*?)(?====الرسالة_الرسمية===|$)/);
  const letterMatch = content.match(/===الرسالة_الرسمية===([\s\S]*?)(?====ملاحظات_قانونية===|$)/);
  const legalMatch = content.match(/===ملاحظات_قانونية===([\s\S]*?)$/);

  // Fallback to old format for backwards compatibility
  const oldLetterMatch = content.match(/===LETTRE===([\s\S]*?)(?====NOTE_JURIDIQUE===|$)/);
  const oldLegalMatch = content.match(/===NOTE_JURIDIQUE===([\s\S]*?)(?====PLAN_ACTION===|$)/);
  const oldActionMatch = content.match(/===PLAN_ACTION===([\s\S]*?)$/);

  // Parse extracted sender info from the new section
  let extractedSender: ParsedResponse['extractedSender'] = undefined;
  if (senderMatch) {
    const senderText = senderMatch[1];
    extractedSender = {};
    
    // Extract fields using patterns
    const nameMatch = senderText.match(/الجهة:\s*(.+?)(?:\n|$)/);
    const addressMatch = senderText.match(/العنوان:\s*(.+?)(?:\n|$)/);
    const refMatch = senderText.match(/المرجع:\s*(.+?)(?:\n|$)/);
    const subjectMatch = senderText.match(/الموضوع:\s*(.+?)(?:\n|$)/);
    const dateMatch = senderText.match(/التاريخ:\s*(.+?)(?:\n|$)/);
    
    if (nameMatch && nameMatch[1].trim() !== '[اسم الجهة المرسلة]') {
      extractedSender.name = nameMatch[1].trim();
    }
    if (addressMatch && addressMatch[1].trim() !== '[عنوان الجهة الكامل]') {
      extractedSender.address = addressMatch[1].trim();
    }
    if (refMatch && refMatch[1].trim() !== '[رقم المرجع/الملف]') {
      extractedSender.reference = refMatch[1].trim();
    }
    if (subjectMatch && subjectMatch[1].trim() !== '[موضوع الجواب]') {
      extractedSender.subject = subjectMatch[1].trim();
    }
    if (dateMatch && dateMatch[1].trim() !== '[تاريخ الجواب]') {
      extractedSender.date = dateMatch[1].trim();
    }
  }

  // Also try to extract sender from content patterns if not found
  if (!extractedSender || !extractedSender.name) {
    extractedSender = extractedSender || {};
    // Try common patterns
    const contentPatterns = [
      /(?:جواب|خطاب|رسالة)\s+(?:من|de)\s+(CAF|CPAM|Préfecture|Pôle Emploi|URSSAF)[^.\n]*/i,
      /(CAF|CPAM|Préfecture|Pôle Emploi|URSSAF|RSI|Ameli)\s+(?:de\s+)?([A-Za-zÀ-ÿ\s-]+)/i,
    ];
    for (const pattern of contentPatterns) {
      const match = content.match(pattern);
      if (match) {
        extractedSender.name = match[0].replace(/^(?:جواب|خطاب|رسالة)\s+(?:من|de)\s+/i, '').trim();
        break;
      }
    }
    
    // Extract reference number
    const refPatterns = [
      /(?:N°|n°|Ref|REF|Référence|رقم المرجع|رقم الملف)[:\s]*([A-Z0-9\-\/]+)/gi,
      /(?:Dossier|ملف)[:\s]*([A-Z0-9\-\/]+)/gi,
    ];
    for (const pattern of refPatterns) {
      const match = content.match(pattern);
      if (match && !extractedSender.reference) {
        const numMatch = match[0].match(/[A-Z0-9\-\/]{5,}/i);
        if (numMatch) {
          extractedSender.reference = numMatch[0];
          break;
        }
      }
    }
  }

  return {
    explanation: explanationMatch ? explanationMatch[1].trim() : "",
    actionPlan: actionMatch ? actionMatch[1].trim() : (oldActionMatch ? oldActionMatch[1].trim() : "مفيش خطة عمل متاحة"),
    formalLetter: letterMatch ? letterMatch[1].trim() : (oldLetterMatch ? oldLetterMatch[1].trim() : "تحب أكتبلك خطاب رسمي (Lettre) للجهة دي عشان تحل المشكلة؟ 📝"),
    legalNote: legalMatch ? legalMatch[1].trim() : (oldLegalMatch ? oldLegalMatch[1].trim() : ""),
    extractedSender: (extractedSender && Object.keys(extractedSender).length > 0) ? extractedSender : undefined,
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
