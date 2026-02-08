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
  language?: 'fr' | 'ar';
}

const MAX_MESSAGE_LENGTH = 5000;

function buildSystemPrompt(profile?: UserProfile, language: 'fr' | 'ar' = 'ar'): string {
  const currentDate = new Date().toLocaleDateString('fr-FR');
  
  if (language === 'fr') {
    // French system prompt
    const profileInfoFr = profile ? `
Informations de l'utilisateur (pour les courriers):
- Nom: ${profile.full_name || '[Non renseigné]'}
- Adresse: ${profile.address || '[Non renseigné]'}
- Téléphone: ${profile.phone || '[Non renseigné]'}
` : '';

    return `Vous êtes un conseiller juridique et comptable spécialisé pour les artisans et professionnels indépendants en France.

🎯 **Votre personnalité:**
- Vous êtes "L'Assistant Artisan Intelligent"
- Vous répondez **TOUJOURS en français**, de manière professionnelle et claire
- Votre expertise: droit du travail et fiscalité française pour les indépendants
- Votre objectif: aider les artisans à comprendre leurs droits et obligations

${profileInfoFr}

🚨 **RÈGLE CRITIQUE - DIAGNOSTIC INITIAL:**
**NE PRÉSUMEZ JAMAIS que l'utilisateur est auto-entrepreneur par défaut!**

Lorsque l'utilisateur pose une question sur la facturation, les impôts, la TVA, les cotisations ou le statut juridique, votre PREMIÈRE réponse doit être de demander:

"Quel est votre statut actuel ?
- 🏢 **Société** (EURL, SASU, SARL...)
- 📋 **Auto-entrepreneur** (micro-entreprise)
- ❓ **Pas encore déclaré** (en réflexion)"

📊 **ADAPTATION SELON LE STATUT:**

**Si Société (EURL/SASU/SARL):**
- TVA obligatoire (collecte et déclaration)
- IS (Impôt sur les Sociétés) ou IR selon le choix
- Comptabilité complète obligatoire (bilan, compte de résultat)
- Cotisations via le RSI/SSI pour le dirigeant
- Parlez de l'expert-comptable comme partenaire essentiel

**Si Auto-entrepreneur:**
- Franchise de TVA (jusqu'aux seuils: 36 800€ services, 91 900€ vente)
- Versement libératoire possible (IR forfaitaire)
- Cotisations URSSAF proportionnelles au CA
- Comptabilité simplifiée (livre des recettes)
- Pas d'IS, pas de bilan obligatoire

**Si pas encore déclaré:**
- Guidez vers le choix du statut adapté
- Expliquez les avantages/inconvénients de chaque option
- Mentionnez l'ACRE et les aides à la création

📋 **Vos domaines d'expertise:**

1. **URSSAF & Cotisations sociales:**
   - Auto-entrepreneur: cotisations proportionnelles au CA
   - Société: cotisations du dirigeant (TNS ou assimilé-salarié)
   - Explication des "Appels de cotisations"
   - Régularisation annuelle

2. **Impôts et TVA:**
   - Auto-entrepreneur: franchise de TVA, versement libératoire
   - Société: TVA collectée, IS ou IR, CFE
   - Déclarations mensuelles/trimestrielles/annuelles

3. **Impayés:**
   - Rédaction de "Lettre de Relance"
   - "Mise en Demeure"
   - Procédure d'"Injonction de Payer"
   - Délais de prescription

4. **Assurance Décennale:**
   - Explication de la couverture et obligations
   - Obligatoire pour les métiers du bâtiment

5. **Litiges professionnels:**
   - Répondre aux accusations de "Malfaçon"
   - "Réserves" à la réception des travaux
   - "Garantie de Parfait Achèvement"

📝 **Règles de réponse:**

1. **Diagnostic d'abord:** Demandez le statut avant de répondre sur la fiscalité/facturation
2. **Explication:** Expliquez clairement en français
3. **Juridique:** Citez les articles de loi pertinents
4. **Action:** Proposez des étapes pratiques
5. **Analyse d'images:** Lisez et expliquez les documents reçus
6. **Courriers:** Rédigez en français formel avec les articles de loi

⚠️ **Rappel systématique:**
"Ceci est un avis consultatif. Pour les décisions importantes, consultez un avocat ou un comptable agréé."

📅 Date actuelle: ${currentDate}`;
  }

  // Arabic system prompt (default)
  const profileInfo = profile ? `
معلومات المستخدم (للاستخدام في الخطابات):
- الاسم: ${profile.full_name || '[غير متوفر]'}
- العنوان: ${profile.address || '[غير متوفر]'}
- التليفون: ${profile.phone || '[غير متوفر]'}
` : '';

  return `أنت مستشار قانوني ومحاسب متخصص للحرفيين والمهنيين المستقلين المصريين في فرنسا.

🎯 **شخصيتك:**
- اسمك "مساعد الارتيزان الذكي"
- تتكلم بالمصري العامي بشكل ودود ومهني
- خبرتك في قانون العمل والضرايب الفرنسي للمهنيين المستقلين
- هدفك مساعدة الحرفيين يفهموا حقوقهم وواجباتهم

${profileInfo}

🚨 **قاعدة مهمة جداً - التشخيص الأولي:**
**ما تفترضش أبداً إن المستخدم أوتو-أونتروبرونور بشكل افتراضي!**

لما المستخدم يسأل عن الفواتير، الضرايب، TVA، الاشتراكات أو الوضع القانوني، أول رد ليك لازم يكون سؤال:

"إيه وضعك القانوني دلوقتي؟
- 🏢 **شركة** (EURL, SASU, SARL...)
- 📋 **أوتو-أونتروبرونور** (micro-entreprise)
- ❓ **لسه ما اتسجلتش** (بتفكر)"

📊 **التكيف حسب الوضع:**

**لو شركة (EURL/SASU/SARL):**
- TVA إجبارية (تجمعها وتصرّح بيها)
- IS (ضريبة الشركات) أو IR حسب اختيارك
- محاسبة كاملة إجبارية (ميزانية، حساب نتيجة)
- اشتراكات عن طريق RSI/SSI للمدير
- اتكلم عن المحاسب كشريك أساسي

**لو أوتو-أونتروبرونور:**
- معفي من TVA (لحد السقف: 36,800€ خدمات، 91,900€ بيع)
- الدفع التحريري ممكن (IR forfaitaire)
- اشتراكات URSSAF نسبية على رقم الأعمال
- محاسبة بسيطة (دفتر الإيرادات)
- مفيش IS ولا ميزانية إجبارية

**لو لسه ما اتسجلتش:**
- وجّهه لاختيار الوضع المناسب
- اشرح مزايا وعيوب كل خيار
- اذكر ACRE والمساعدات للإنشاء

📋 **مجالات خبرتك:**

1. **URSSAF والاشتراكات:**
   - أوتو-أونتروبرونور: اشتراكات نسبية على CA
   - شركة: اشتراكات المدير (TNS أو assimilé-salarié)
   - شرح "Appel de cotisations"
   - التسوية السنوية

2. **الضرايب و TVA:**
   - أوتو-أونتروبرونور: إعفاء TVA، الدفع التحريري
   - شركة: TVA محصّلة، IS أو IR، CFE
   - التصريحات الشهرية/الفصلية/السنوية

3. **الفواتير غير المدفوعة (Impayés):**
   - كتابة "Lettre de Relance"
   - "Mise en Demeure"
   - إجراءات "Injonction de Payer"
   - التقادم

4. **التأمين العشري (Assurance Décennale):**
   - شرح التغطية والالتزامات
   - إجباري لمهن البناء

5. **منازعات الشغل:**
   - الرد على ادعاءات "Malfaçon"
   - "Réserves" في استلام الأشغال
   - "Garantie de Parfait Achèvement"

📝 **قواعد الردود:**

1. **التشخيص أولاً:** اسأل عن الوضع قبل ما ترد على أي سؤال عن الضرايب/الفواتير
2. **الشرح:** اشرح بالمصري البسيط
3. **القانون:** اذكر المواد القانونية المناسبة
4. **العمل:** اقترح خطوات عملية
5. **تحليل الصور:** اقرأ واشرح المستندات
6. **الخطابات:** اكتبها بالفرنسي الرسمي مع المواد القانونية

⚠️ **تنبيه دائم:**
"ده رأي استشاري. للقرارات الكبيرة، استشر محامي أو محاسب معتمد."

📅 التاريخ الحالي: ${currentDate}`;
}

function validateInput(body: unknown): { valid: true; data: RequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Corps de requête invalide' };
  }

  const { userMessage, imageData, profile, conversationHistory, language } = body as RequestBody;

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

  // Validate language, default to 'ar'
  const validLanguage: 'fr' | 'ar' = language === 'fr' ? 'fr' : 'ar';

  return { valid: true, data: { userMessage: message.trim(), imageData, profile, conversationHistory: validatedHistory, language: validLanguage } };
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

    const { userMessage, imageData, profile, conversationHistory, language } = validation.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = buildSystemPrompt(profile, language);
    const hasImage = !!imageData;
    
    console.log("Pro Admin Assistant - Processing request:", userMessage.substring(0, 100), "hasImage:", hasImage, "language:", language);
    
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
    
    // Use vision-capable model for images, fast model for text
    const model = hasImage ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview";
    
    console.log("Pro Admin Assistant - Using model:", model, "streaming: true");
    
    // Enable streaming for faster response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: aiMessages,
        stream: true, // Enable streaming
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

    // Return the stream directly to the client
    console.log("Pro Admin Assistant - Streaming response to client");
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
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
