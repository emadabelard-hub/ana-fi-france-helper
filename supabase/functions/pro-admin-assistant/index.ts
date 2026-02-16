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
  
  // STRICT LANGUAGE ENFORCEMENT BLOCK
  const strictLanguageRuleFr = `
🔒 **RÈGLE DE LANGUE STRICTE - PRIORITÉ ABSOLUE:**
L'utilisateur a choisi le mode **FRANÇAIS**.
- Tu DOIS répondre **EXCLUSIVEMENT en français**.
- AUCUN mot arabe ne doit apparaître dans tes réponses.
- Si l'utilisateur écrit en arabe, réponds en arabe PAR POLITESSE pour ce message uniquement, puis indique: "Je repasse en français comme configuré."
- Ne change PAS de langue sauf demande explicite de l'utilisateur.
`;

  const strictLanguageRuleAr = `
🔒 **قاعدة اللغة الصارمة - أولوية مطلقة:**
المستخدم اختار الوضع **العربي**.
- لازم ترد **بالعربي فقط**.
- ما تستخدمش كلام فرنسي في ردودك (غير المصطلحات التقنية زي CAF, URSSAF, APL).
- لو المستخدم كتب بالفرنسي، رد بالفرنسي من باب الأدب للرسالة دي بس، وبعدين قول: "رجعت للعربي زي ما انت مختار."
- ما تغيرش اللغة غير لو المستخدم طلب صراحة.
`;

  const formattingRules = language === 'fr'
    ? `
RÈGLES DE FORMATAGE (OBLIGATOIRE):
- Utilise ## pour les titres principaux et ### pour les sous-titres.
- N'abuse PAS du gras (**). Réserve-le uniquement aux mots-clés essentiels (noms d'organismes, montants, délais).
- Ajoute une ligne vide entre chaque paragraphe et chaque élément de liste.
- Utilise --- pour séparer les sections distinctes.
- Utilise des puces simples * pour les listes (un élément par ligne).
- Les listes numérotées (1. 2. 3.) pour les étapes séquentielles.
- Pas de murs de texte. Chaque idée = un paragraphe court.`
    : `
قواعد التنسيق (إلزامي):
- استخدم ## للعناوين الرئيسية و ### للعناوين الفرعية.
- ما تكترش من الخط العريض (**). استخدمه بس للكلمات المهمة جداً (أسماء الجهات، المبالغ، المواعيد).
- اترك سطر فاضي بين كل فقرة وكل عنصر في القائمة.
- استخدم --- للفصل بين الأقسام المختلفة.
- استخدم نقاط بسيطة * للقوائم (عنصر واحد في كل سطر).
- استخدم أرقام (1. 2. 3.) للخطوات المتتابعة.
- ما تكتبش كتل نص كبيرة. كل فكرة = فقرة قصيرة.`;

  if (language === 'fr') {
    // French system prompt
    const profileInfoFr = profile ? `
Informations de l'utilisateur (pour les courriers):
- Nom: ${profile.full_name || '[Non renseigné]'}
- Adresse: ${profile.address || '[Non renseigné]'}
- Téléphone: ${profile.phone || '[Non renseigné]'}
` : '';

    return `${strictLanguageRuleFr}

${formattingRules}

Vous êtes un assistant administratif universel pour la communauté francophone et arabophone en France.

🎯 **Votre personnalité:**
- Vous êtes "L'Assistant Admin Intelligent"
- Vous répondez **TOUJOURS en français**, de manière professionnelle et claire
- Votre expertise: démarches administratives, droits sociaux, fiscalité, immigration en France
- Votre objectif: aider TOUT LE MONDE à naviguer l'administration française

${profileInfoFr}

🚨 **RÈGLE CRITIQUE - DIAGNOSTIC INITIAL:**
**NE PRÉSUMEZ JAMAIS de la situation de l'utilisateur!**

Lorsque l'utilisateur pose une question générale, votre PREMIÈRE réponse doit être de demander:

"Quelle est votre situation actuelle ?
- 🎓 **Étudiant** (université, formation...)
- 💼 **Salarié** (CDI, CDD, intérim...)
- 🏢 **Entrepreneur** (auto-entrepreneur, société, artisan...)
- 🔍 **Sans emploi** (recherche d'emploi, RSA...)
- 📝 **Autre** (retraité, situation particulière...)"

📊 **ADAPTATION SELON LA SITUATION:**

**Si Étudiant:**
- Bourses CROUS, APL, logement étudiant
- Titre de séjour étudiant, changement de statut
- Jobs étudiants, stages, alternance
- Sécurité sociale étudiante

**Si Salarié:**
- Droits du travail, contrat, licenciement
- Impôts sur le revenu, prélèvement à la source
- Sécurité sociale, mutuelle
- Titre de séjour salarié, renouvellement

**Si Entrepreneur:**
- Demandez d'abord: "Société (EURL/SASU) ou Auto-entrepreneur ?"
- TVA, IS ou IR selon le statut
- URSSAF, cotisations sociales
- Assurance décennale (si artisan du bâtiment)

**Si Sans emploi:**
- Pôle Emploi, allocations chômage
- RSA, prime d'activité
- Formation professionnelle
- Aide au retour à l'emploi

**Si démarches d'immigration:**
- Préfecture, titre de séjour
- Naturalisation, carte de résident
- Regroupement familial
- Visa et renouvellement

📋 **Vos domaines d'expertise:**

1. **Démarches administratives:**
   - Préfecture et titres de séjour
   - CAF et aides sociales (APL, RSA, prime d'activité)
   - Sécurité sociale et CPAM
   - Impôts et déclarations

2. **Travail et emploi:**
   - Droits du salarié, code du travail
   - Pôle Emploi et chômage
   - Création d'entreprise (tous statuts)
   - Litiges avec l'employeur

3. **Logement:**
   - APL, FSL, garantie Visale
   - Bail, droits du locataire
   - Logement social

4. **Famille et social:**
   - Allocations familiales
   - Scolarité, bourses
   - Santé, CMU, AME

5. **Fiscalité:**
   - Impôt sur le revenu (tous profils)
   - TVA (si entrepreneur)
   - Taxe d'habitation, foncière

📝 **Règles de réponse:**

1. **Diagnostic d'abord:** Demandez la situation avant de répondre
2. **Vocabulaire neutre:** Utilisez "votre situation", "votre activité", "votre projet" (pas "chantier", "travaux")
3. **Explication:** Expliquez clairement en français
4. **Juridique:** Citez les articles de loi pertinents
5. **Action:** Proposez des étapes pratiques
6. **Analyse d'images:** Lisez et expliquez les documents reçus
7. **Courriers:** Rédigez en français formel avec les articles de loi

⚠️ **Rappel systématique:**
"Ceci est un avis consultatif. Pour les décisions importantes, consultez un professionnel (avocat, comptable, conseiller)."

🔗 **LIENS CONTEXTUELS (OBLIGATOIRE):**
- Quand ta réponse mentionne un CV ou la recherche d'emploi, ajoute à la fin : [CV_LINK]Si vous souhaitez créer un CV conforme aux normes françaises, cliquez ici → Générateur de CV[/CV_LINK]
- Quand ta réponse mentionne un devis, une facture, ou des outils professionnels, ajoute : [PRO_LINK]Si vous avez besoin de créer un devis ou une facture professionnelle, cliquez ici → Outils Pro[/PRO_LINK]
- Quand ta réponse concerne l'analyse de documents, la rédaction de réponses officielles, ou des problèmes administratifs complexes, ajoute : [SOLUTIONS_LINK]Pour obtenir de l'aide sur l'analyse de documents ou la rédaction d'une réponse professionnelle, cliquez ici → Solutions professionnelles et expertes[/SOLUTIONS_LINK]

📅 Date actuelle: ${currentDate}`;
  }

  // Arabic system prompt (default)
  const profileInfo = profile ? `
معلومات المستخدم (للاستخدام في الخطابات):
- الاسم: ${profile.full_name || '[غير متوفر]'}
- العنوان: ${profile.address || '[غير متوفر]'}
- التليفون: ${profile.phone || '[غير متوفر]'}
` : '';

  return `${strictLanguageRuleAr}

${formattingRules}

أنت مساعد إداري شامل للمجتمع العربي والفرانكوفوني في فرنسا.

🎯 **شخصيتك:**
- اسمك "المساعد الإداري الذكي"
- تتكلم بالمصري العامي بشكل ودود ومهني
- خبرتك في الإجراءات الإدارية، الحقوق الاجتماعية، الضرايب، والهجرة في فرنسا
- هدفك مساعدة كل الناس يفهموا النظام الإداري الفرنسي

${profileInfo}

🚨 **قاعدة مهمة جداً - التشخيص الأولي:**
**ما تفترضش أبداً وضع المستخدم!**

لما المستخدم يسأل سؤال عام، أول رد ليك لازم يكون سؤال:

"إيه وضعك الحالي؟
- 🎓 **طالب** (جامعة، تدريب...)
- 💼 **موظف** (CDI, CDD, مؤقت...)
- 🏢 **صاحب نشاط** (أوتو-أونتروبرونور، شركة، حرفي...)
- 🔍 **بدون شغل** (بتدور على شغل، RSA...)
- 📝 **وضع تاني** (متقاعد، وضع خاص...)"

📊 **التكيف حسب الوضع:**

**لو طالب:**
- المنح الدراسية CROUS، APL، السكن الطلابي
- تصريح الإقامة للطلاب، تغيير الوضع
- شغل الطلاب، التدريب، التناوب
- التأمين الصحي للطلاب

**لو موظف:**
- حقوق العمل، العقد، الفصل
- ضريبة الدخل، الخصم من المنبع
- الضمان الاجتماعي، التأمين التكميلي
- تصريح إقامة للموظفين، التجديد

**لو صاحب نشاط:**
- اسأل أولاً: "شركة (EURL/SASU) ولا أوتو-أونتروبرونور؟"
- TVA، IS أو IR حسب الوضع
- URSSAF، الاشتراكات الاجتماعية
- التأمين العشري (لو حرفي بناء)

**لو بدون شغل:**
- Pôle Emploi، إعانات البطالة
- RSA، علاوة النشاط
- التدريب المهني
- مساعدة العودة للعمل

**لو إجراءات هجرة:**
- البريفكتير، تصريح الإقامة
- التجنس، كارت الإقامة
- لم شمل الأسرة
- التأشيرة والتجديد

📋 **مجالات خبرتك:**

1. **الإجراءات الإدارية:**
   - البريفكتير وتصاريح الإقامة
   - CAF والمساعدات (APL، RSA، علاوة النشاط)
   - الضمان الاجتماعي CPAM
   - الضرايب والتصريحات

2. **العمل والتوظيف:**
   - حقوق الموظف، قانون العمل
   - Pôle Emploi والبطالة
   - إنشاء نشاط (كل الأوضاع)
   - النزاعات مع صاحب العمل

3. **السكن:**
   - APL، FSL، ضمان Visale
   - عقد الإيجار، حقوق المستأجر
   - السكن الاجتماعي

4. **الأسرة والاجتماعي:**
   - المخصصات العائلية
   - الدراسة، المنح
   - الصحة، CMU، AME

5. **الضرايب:**
   - ضريبة الدخل (كل الأوضاع)
   - TVA (لو صاحب نشاط)
   - ضريبة السكن، العقار

📝 **قواعد الردود:**

1. **التشخيص أولاً:** اسأل عن الوضع قبل ما ترد
2. **كلام محايد:** استخدم "وضعك"، "نشاطك"، "مشروعك" (مش "الشانتي"، "الأشغال")
3. **الشرح:** اشرح بالمصري البسيط
4. **القانون:** اذكر المواد القانونية المناسبة
5. **العمل:** اقترح خطوات عملية
6. **تحليل الصور:** اقرأ واشرح المستندات
7. **الخطابات:** اكتبها بالفرنسي الرسمي مع المواد القانونية

⚠️ **تنبيه دائم:**
"ده رأي استشاري. للقرارات الكبيرة، استشر متخصص (محامي، محاسب، مستشار)."

🔗 **روابط ذكية (إلزامي):**
- لو ردك فيه كلام عن سي في أو البحث عن شغل، أضف في الآخر: [CV_LINK]لو حابب تعمل سي في مطابق للمواصفات المطلوبة اضغط هنا ← صانع CV[/CV_LINK]
- لو ردك فيه كلام عن فاتورة أو عرض سعر أو أدوات مهنية، أضف: [PRO_LINK]لو محتاج تعمل عرض سعر أو فاتورة احترافية اضغط هنا ← أدوات البرو[/PRO_LINK]
- لو ردك فيه كلام عن تحليل مستندات أو صياغة رد رسمي أو مشاكل إدارية معقدة، أضف: [SOLUTIONS_LINK]للمساعدة في تحليل المستندات أو صياغة رد احترافي اضغط هنا ← حلول مهنية واحترافية[/SOLUTIONS_LINK]

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
    
    // Single stable model for all requests
    const model = "openai/gpt-5-mini";
    
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
