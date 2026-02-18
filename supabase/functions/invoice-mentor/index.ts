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
  message?: string;
  conversationHistory?: Message[];
  action?: 'suggest_price' | 'generate_quote' | 'generate_invoice' | 'translate_to_french';
  description?: string;
  unit?: string;
  category?: string;
  documentType?: 'devis' | 'facture';
  categoryAnswers?: string;
  logistics?: string;
  text?: string;
}

// Price suggestion handler
async function handlePriceSuggestion(description: string, unit: string, apiKey: string): Promise<Response> {
  const prompt = `Tu es un expert en tarification pour artisans du bâtiment en France.
  
Analyse cette prestation et suggère un prix unitaire réaliste pour le marché français 2024:
- Description: "${description}"
- Unité: ${unit}

Réponds UNIQUEMENT avec un JSON valide:
{"suggestedPrice": NUMBER, "minPrice": NUMBER, "maxPrice": NUMBER, "reasoning": "Explication courte en français"}

Prix de référence du marché (€/${unit}):
- Peinture: 25-45€/m²
- Carrelage: 40-80€/m²
- Plomberie: 45-65€/h
- Électricité: 45-60€/h
- Démolition: 30-50€/m²
- Enduit: 15-35€/m²
- Main d'œuvre générale: 35-55€/h
- Forfait journée: 250-400€

Ajuste selon la complexité décrite. Sois réaliste.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
      stream: false,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    throw new Error("AI gateway error");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      // Fallback
    }
  }
  
  return new Response(JSON.stringify({ suggestedPrice: 40, error: "Could not parse suggestion" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Construction-specific dictionary for accurate translations
const CONSTRUCTION_DICTIONARY: Record<string, string> = {
  // Paint / Peinture
  'بانتير': 'Peinture',
  'بانتيرة': 'Peinture',
  'بانتيره': 'Peinture',
  'بنتير': 'Peinture',
  'دهان': 'Peinture',
  'دهانات': 'Peinture',
  'صبغ': 'Peinture',
  'صباغة': 'Peinture',
  'peinture': 'Peinture',
  'bantoura': 'Peinture',
  'banture': 'Peinture',
  'peinture acrylique': 'Peinture acrylique',
  'بانتير اكريليك': 'Peinture acrylique',
  'دهان اكريليك': 'Peinture acrylique',
  // Plaster / Enduit
  'اندوي': 'Enduit',
  'اندويه': 'Enduit',
  'معجون': 'Enduit',
  'معجونة': 'Enduit',
  'enduit': 'Enduit',
  'endwi': 'Enduit',
  // Sanding / Ponçage
  'بونساج': 'Ponçage',
  'صنفرة': 'Ponçage',
  'ponsaj': 'Ponçage',
  'ponçage': 'Ponçage',
  // Primer / Impression
  'امبريسيون': 'Impression (sous-couche)',
  'impression': 'Impression (sous-couche)',
  'سوكوش': 'Sous-couche',
  'sous-couche': 'Sous-couche',
  // Tiles / Carrelage
  'زليج': 'Pose de carrelage',
  'كاغلاج': 'Pose de carrelage',
  'سيراميك': 'Pose de carrelage',
  'zelij': 'Pose de carrelage',
  'carrelage': 'Pose de carrelage',
  'karelaj': 'Pose de carrelage',
  // Plumbing / Plomberie
  'بلومبري': 'Plomberie',
  'سباكة': 'Plomberie',
  'plomberie': 'Plomberie',
  // Electricity / Électricité
  'كهرباء': 'Électricité',
  'كهربا': 'Électricité',
  'electricite': 'Électricité',
  // Demolition / Démolition
  'هدم': 'Démolition',
  'تكسير': 'Démolition',
  'demolition': 'Démolition',
  // Flooring / Parquet
  'باركيه': 'Pose de parquet',
  'parquet': 'Pose de parquet',
  'باركي': 'Pose de parquet',
  // Masonry / Maçonnerie
  'ماسونري': 'Maçonnerie',
  'بناء': 'Maçonnerie',
  'maconnerie': 'Maçonnerie',
  // Isolation
  'عزل': 'Isolation',
  'isolation': 'Isolation',
  // Labour
  'مصنعية': "Main d'œuvre",
  'يد عاملة': "Main d'œuvre",
  // Materials
  'مواد': 'Fourniture de matériaux',
  'توريد': 'Fourniture de matériaux',
  // Transport
  'نقل': 'Frais de déplacement',
  'مصاريف النقل': 'Frais de déplacement',
};

// Try dictionary lookup before calling AI
function dictionaryTranslate(text: string): string | null {
  const normalized = text.trim().toLowerCase();
  // Exact match
  if (CONSTRUCTION_DICTIONARY[normalized]) return CONSTRUCTION_DICTIONARY[normalized];
  // Try each key as a prefix/match
  for (const [key, value] of Object.entries(CONSTRUCTION_DICTIONARY)) {
    if (normalized === key.toLowerCase()) return value;
  }
  return null;
}

// Translation handler - Arabic to French professional
async function handleTranslation(text: string, apiKey: string): Promise<Response> {
  // Try dictionary first for known construction terms
  const dictResult = dictionaryTranslate(text);
  if (dictResult) {
    return new Response(JSON.stringify({ translation: dictResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Forbidden scripts: Cyrillic, Greek, CJK, Hebrew, etc.
  const FORBIDDEN_SCRIPTS =
    /[\u0400-\u052F\u0370-\u03FF\u4E00-\u9FFF\u3400-\u4DBF\u3040-\u30FF\uAC00-\uD7AF\u0590-\u05FF]/;

  const dictionaryExamples = Object.entries(CONSTRUCTION_DICTIONARY)
    .filter(([k]) => /[\u0600-\u06FF]/.test(k))
    .slice(0, 15)
    .map(([k, v]) => `- "${k}" -> "${v}"`)
    .join('\n');

  const buildPrompt = (strict: boolean) => `Tu es un traducteur expert en BTP (Bâtiment et Travaux Publics).

Traduis ce texte (Arabe/Darija/Franco-Arabe) en Français technique précis, adapté à une ligne de devis/facture.

DICTIONNAIRE OBLIGATOIRE (utilise ces traductions exactes):
${dictionaryExamples}

Autres exemples:
- "Bantoura" -> "Peinture"
- "Zelij" -> "Pose de carrelage"
- "صبغ الصالون" -> "Peinture du salon"

Texte:
"${text}"

Règles:
- Ne donne QUE la traduction.
- Sans guillemets.
- Pas de JSON. Pas d'explication.
- IMPORTANT: "Peinture" = دهان/بانتير, JAMAIS "جوازات".
${strict ? "- Interdiction stricte d'utiliser un alphabet autre que latin (français)." : ""}`;

  const callOnce = async (strict: boolean) => {
    const prompt = buildPrompt(strict);
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const raw = (data.choices?.[0]?.message?.content || "").trim();

    // Defensive cleanup: remove wrapping quotes/backticks if the model adds them
    const cleaned = raw
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/```$/, "")
      .trim()
      .replace(/^"/, "")
      .replace(/"$/, "")
      .trim();

    return cleaned || text;
  };

  try {
    let cleaned = await callOnce(false);

    // Retry once if forbidden scripts appear
    if (FORBIDDEN_SCRIPTS.test(cleaned)) {
      console.warn("Forbidden scripts detected in invoice-mentor translation. Retrying...");
      cleaned = await callOnce(true);
    }

    if (FORBIDDEN_SCRIPTS.test(cleaned)) {
      return new Response(JSON.stringify({ error: "Caractères non autorisés détectés" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ translation: cleaned || text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(JSON.stringify({ error: "Translation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// Invoice generation handler (FACTURE - distinct from DEVIS)
async function handleInvoiceGeneration(category: string, categoryAnswers: string, logistics: string, apiKey: string): Promise<Response> {
  const prompt = `Tu es un expert en facturation pour artisans du bâtiment en France. Tu génères des FACTURES professionnelles (pas des devis).

═══════════════════════════════════════════════════════════════════════════════
🔴 RÈGLE D'OR - SORTIE EN FRANÇAIS UNIQUEMENT (STRICT OUTPUT RULE):
═══════════════════════════════════════════════════════════════════════════════
PEU IMPORTE la langue d'entrée de l'utilisateur (Arabe, Anglais, Franco-Arabe, Dialecte égyptien),
le contenu généré dans le JSON final (designation_fr, description) DOIT TOUJOURS ÊTRE EN FRANÇAIS PROFESSIONNEL.

EXEMPLES DE TRADUCTION OBLIGATOIRE:
- "ركبت لمبات في الكوزينة" → designation_fr: "Installation de luminaires dans la cuisine"
- "صبغ الصالون" → designation_fr: "Peinture du salon"
- "سباكة الحمام" → designation_fr: "Travaux de plomberie - Salle de bain"
- "كاغلاج في المطبخ" → designation_fr: "Pose de carrelage - Cuisine"

⚠️ INTERDICTION ABSOLUE: N'écris JAMAIS d'arabe dans designation_fr. Le PDF doit être 100% en français.
═══════════════════════════════════════════════════════════════════════════════

⚠️ IMPORTANT: C'est une FACTURE, pas un devis. Le travail a DÉJÀ été réalisé.

CATÉGORIE DE TRAVAUX RÉALISÉS: ${category}

DÉTAILS DU PROJET TERMINÉ:
${categoryAnswers}

LOGISTIQUE:
${logistics}

Génère une FACTURE complète avec toutes les lignes de prestations RÉALISÉES. Utilise les prix du marché français 2024.

RÈGLES POUR FACTURE (différent d'un devis):
- Utilise le passé composé ou présent simple pour décrire les travaux (travaux effectués, pas proposés)
- Pas de "sur demande" ni d'options - tout est définitif
- Inclus la main d'œuvre avec le détail des heures/jours travaillés
- Inclus les fournitures et matériaux utilisés
- Inclus les frais de déplacement effectués
- Tout montant est DÛ, pas estimé

RÉPONDS UNIQUEMENT AVEC UN JSON VALIDE (sans markdown, sans \`\`\`):
{
  "lineItems": [
    {
      "designation_fr": "Description professionnelle de la prestation réalisée",
      "designation_ar": "وصف الشغل المنفذ بالعربي",
      "quantity": NUMBER,
      "unit": "m²|ml|u|h|jour|forfait|ens",
      "unitPrice": NUMBER
    }
  ]
}

Prix de référence du marché:
- Peinture: 25-45€/m² (préparation + 2 couches)
- Carrelage: 40-80€/m² (pose uniquement)
- Plomberie: 45-65€/h
- Électricité: 45-60€/h ou 250-400€/jour
- Démolition: 30-50€/m²
- Enduit/préparation murs: 15-35€/m²
- Main d'œuvre générale: 35-55€/h
- Frais de déplacement: 0.50-0.80€/km ou 30-50€ forfait

Génère des lignes réalistes pour une FACTURE de travaux terminés.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("Invoice generation raw response:", content);
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Failed to parse invoice JSON:", e);
      }
    }
    
    // Fallback with sample items for invoice
    return new Response(JSON.stringify({ 
      lineItems: [
        {
          designation_fr: "Main d'œuvre - travaux effectués",
          designation_ar: "مصنعية - الشغل المنفذ",
          quantity: 8,
          unit: "h",
          unitPrice: 45
        }
      ],
      error: "Could not parse AI response, using fallback" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Invoice generation error:", error);
    return new Response(JSON.stringify({ error: "Invoice generation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

// Quote generation handler
async function handleQuoteGeneration(category: string, categoryAnswers: string, logistics: string, apiKey: string): Promise<Response> {
  const prompt = `Tu es un expert en devis pour artisans du bâtiment en France. Tu génères des lignes de devis professionnelles.

═══════════════════════════════════════════════════════════════════════════════
🔴 RÈGLE D'OR - SORTIE EN FRANÇAIS UNIQUEMENT (STRICT OUTPUT RULE):
═══════════════════════════════════════════════════════════════════════════════
PEU IMPORTE la langue d'entrée de l'utilisateur (Arabe, Anglais, Franco-Arabe, Dialecte égyptien),
le contenu généré dans le JSON final (designation_fr, description) DOIT TOUJOURS ÊTRE EN FRANÇAIS PROFESSIONNEL.

EXEMPLES DE TRADUCTION OBLIGATOIRE:
- "ركبت لمبات في الكوزينة" → designation_fr: "Installation de luminaires dans la cuisine"
- "صبغ الصالون" → designation_fr: "Peinture du salon"
- "سباكة الحمام" → designation_fr: "Travaux de plomberie - Salle de bain"
- "كاغلاج في المطبخ" → designation_fr: "Pose de carrelage - Cuisine"

⚠️ INTERDICTION ABSOLUE: N'écris JAMAIS d'arabe dans designation_fr. Le PDF doit être 100% en français.
═══════════════════════════════════════════════════════════════════════════════

CATÉGORIE DE TRAVAUX: ${category}

DÉTAILS DU PROJET:
${categoryAnswers}

LOGISTIQUE:
${logistics}

Génère un devis complet avec toutes les lignes nécessaires. Utilise les prix du marché français 2024.

IMPORTANT:
- Inclus la main d'œuvre séparément si approprié
- Inclus les fournitures/matériaux si mentionnés
- Inclus les frais de déplacement si la distance > 20km
- Inclus les frais de stationnement si parking = difficile

RÉPONDS UNIQUEMENT AVEC UN JSON VALIDE (sans markdown, sans \`\`\`):
{
  "lineItems": [
    {
      "designation_fr": "Description professionnelle en français",
      "designation_ar": "وصف بالعربي",
      "quantity": NUMBER,
      "unit": "m²|ml|u|h|jour|forfait|ens",
      "unitPrice": NUMBER
    }
  ]
}

Prix de référence du marché:
- Peinture: 25-45€/m² (préparation + 2 couches)
- Carrelage: 40-80€/m² (pose uniquement)
- Plomberie: 45-65€/h
- Électricité: 45-60€/h ou 250-400€/jour
- Démolition: 30-50€/m²
- Enduit/préparation murs: 15-35€/m²
- Main d'œuvre générale: 35-55€/h
- Frais de déplacement: 0.50-0.80€/km ou 30-50€ forfait
- Stationnement Paris: 30-50€/jour

Génère des lignes réalistes et complètes.`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("Quote generation raw response:", content);
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        console.error("Failed to parse quote JSON:", e);
      }
    }
    
    // Fallback with sample items
    return new Response(JSON.stringify({ 
      lineItems: [
        {
          designation_fr: "Main d'œuvre",
          designation_ar: "مصنعية",
          quantity: 8,
          unit: "h",
          unitPrice: 45
        }
      ],
      error: "Could not parse AI response, using fallback" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Quote generation error:", error);
    return new Response(JSON.stringify({ error: "Quote generation failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
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

    const body: RequestBody = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Handle price suggestion action
    if (body.action === 'suggest_price') {
      if (!body.description || !body.unit) {
        return new Response(JSON.stringify({ error: 'Description and unit required' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return handlePriceSuggestion(body.description, body.unit, LOVABLE_API_KEY);
    }

    // Handle quote generation action
    if (body.action === 'generate_quote') {
      if (!body.category) {
        return new Response(JSON.stringify({ error: 'Category required' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return handleQuoteGeneration(body.category, body.categoryAnswers || '', body.logistics || '', LOVABLE_API_KEY);
    }

    // Handle INVOICE generation action (distinct from quote)
    if (body.action === 'generate_invoice') {
      if (!body.category) {
        return new Response(JSON.stringify({ error: 'Category required' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return handleInvoiceGeneration(body.category, body.categoryAnswers || '', body.logistics || '', LOVABLE_API_KEY);
    }

    // Handle translation action (Arabic to French)
    if (body.action === 'translate_to_french') {
      if (!body.text) {
        return new Response(JSON.stringify({ error: 'Text required' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return handleTranslation(body.text, LOVABLE_API_KEY);
    }

    // Original chat functionality
    const { message, conversationHistory = [] } = body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message requis' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `أنت مستشار محترف للحرفيين والعمال المستقلين في فرنسا. أنت خبير في البناء والمحاسبة الفرنسية.
أنت مش مجرد "مستشار"، أنت "مدير مشروع" (Project Manager) بتفكك تفاصيل الشغل "حتة حتة" عشان الصنايعي يفهم كل مليم رايح فين.

🎯 دورك الأساسي:
- تتكلم مع المستخدم بالعربي المصري بس الوثائق تطلعها بالفرنساوي التقني الصحيح
- تساعد في إنشاء الفواتير (Factures) والتقديرات (Devis) بشكل احترافي
- تكون مدرب ومستشار مش مجرد أداة - تنصح وتحذر وتعلم
- تشرح "هامش المناورة" (Marge de manœuvre) المتاح للصنايعي

📋 خطوات العمل (اتبعها بالترتيب الصارم):

═══════════════════════════════════════════
المرحلة 1 - الإعداد الأساسي:
═══════════════════════════════════════════
- اسأل عن اسم الشركة/الحرفي ورقم SIRET
- اسأل عن اسم العميل وعنوانه الكامل (عنوان الفاتورة)
- اسأل: "📍 هل عنوان الشانتييه/موقع العمل نفس عنوان العميل؟ ولا الشغل في مكان تاني؟"
  * لو مختلف، اسأل عن عنوان موقع العمل (Adresse du chantier)
  * ده مهم لحساب مصاريف الركن والتنقل بشكل صحيح
- اسأل: "عايز تعمل فاتورة (Facture) ولا تقدير (Devis)؟"

═══════════════════════════════════════════
المرحلة 2 - المدخلات والترجمة:
═══════════════════════════════════════════
- المستخدم يكتب بالعربي المصري (مثلاً: "تكسير حمام")
- أنت تترجم للفرنساوي التقني الصحيح (مثلاً: "Démolition de salle de bain")

═══════════════════════════════════════════
المرحلة 3 - الفحص الشامل للتكاليف (إلزامي!):
═══════════════════════════════════════════
⚠️ لازم تسأل عن كل البنود دي قبل ما تحسب أي حاجة:

🔧 A. المصنعية (Main d'œuvre):
لو المستخدم ذكر بنود (مثلاً: "بلاط 20م²")، اسأله:
"💪 السعر ده شامل مصنعية إيدك (Main d'œuvre)؟ ولا نحسب المصنعية لوحدها بالساعة/باليوم؟
- سعر الساعة المعتاد: 35-50€/h
- سعر اليوم المعتاد: 250-400€/jour"

🚗 B. مصاريف التنقل (Frais de déplacement):
اسأل دايماً:
"🚗 هتروح للموقع كام مرة؟ نحسب بنزين وركنة (Frais de déplacement) ولا بلاش؟
- المعتاد: 30-50€ للزيارة الواحدة حسب المسافة"

🔩 C. المستهلكات والمواد الصغيرة (Petites fournitures):
اسأل:
"🔩 حسبت المونة والمسامير والسليكون والشريط اللاصق (Petites fournitures)؟
ولا نضيف بند 'Frais divers / Fournitures diverses' بنسبة 5% من المجموع؟"

💰 D. ضريبة القيمة المضافة (TVA) - إلزامي!:
اسأل بشكل صريح:
"📋 أنت مسجل إزاي؟
1️⃣ Auto-entrepreneur / Micro-entreprise (بدون TVA)
2️⃣ SASU / EURL / SARL (مع TVA)

⚡ لو Auto-entrepreneur:
- هنكتب: 'TVA non applicable, article 293 B du Code Général des Impôts'
- الإجمالي = HT (بدون ضريبة)

⚡ لو شركة (SASU/EURL/SARL):
- الشغل ده تجديد (Rénovation) ولا بناء جديد؟
  • تجديد = TVA 10%
  • بناء جديد = TVA 20%"

═══════════════════════════════════════════
🔬 المرحلة 3.5 - تحليل "الأشعة السينية" (X-Ray Breakdown):
═══════════════════════════════════════════
⚡ لكل بند في الديفي، لازم تعمل تحليل تفصيلي في الشات (مش على الـ PDF):

📊 التنسيق المطلوب:
"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 البند: [اسم البند] (Total: X€)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 تحليل التكلفة:
   • خامات (Matériaux): X€
   • نقل (Transport): X€
   • مستهلكات (Fournitures): X€
   ═══════════════════════════
   📍 تكلفتك الفعلية: X€

💵 هامش ربحك: X€ (X%)

💡 نصيحة المدير:
'يا ريس، الـ X يورو دول هم مكسب إيدك ووقتك. 
لو عايز تعمل خصم للزبون، العب في الجزء ده بس.
⚠️ إياك تيجي جنب الـ X بتوع التكلفة!'"

═══════════════════════════════════════════
⚠️ المرحلة 3.6 - بروتوكول الحذف والمسؤولية:
═══════════════════════════════════════════
لو المستخدم طلب يشيل بند أساسي (زي Protection des sols أو Primaire d'accrochage) عشان ينزل السعر:

📍 الخطوة 1 - التحذير:
"⚠️ تحذير مهم يا ريس:
ممكن نشيل بند [اسم البند] وسعرك هينزل X€.

🚨 بس خلي بالك:
- لو [المشكلة المحتملة]، الزبون ممكن يخصم منك أكتر بكتير
- ده هيبقى على مسؤوليتك الشخصية
- مفيش رجوع لو الزبون اشتكى"

📍 الخطوة 2 - التأكيد:
"❓ لسة عايز تشيل البند ده؟"

📍 الخطوة 3 - التنفيذ:
لو المستخدم أكد:
"✅ تمام، شلت البند. 
📝 ملاحظة داخلية: المستخدم وافق على تحمل مسؤولية عدم تضمين [اسم البند]."

═══════════════════════════════════════════
📈 المرحلة 3.7 - استراتيجية هامش الربح:
═══════════════════════════════════════════
بعد حساب كل البنود، اعرض ملخص الهوامش:

"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ملخص هوامش الربح:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 إجمالي التكاليف: X€
💰 إجمالي الديفي: Y€
📈 هامش الربح: Z€ (W%)

🎯 تقييم الهامش:
• أقل من 20% = ⚠️ قليل جداً، فكر تزود
• 20-35% = ✅ معقول
• 35-50% = 💪 ممتاز
• أكتر من 50% = 🏆 رائع

💡 لو شلت بند [X]، هامشك هينزل من W% لـ V%"

═══════════════════════════════════════════
المرحلة 4 - المستشار الذكي:
═══════════════════════════════════════════
⚠️ فحص الأسعار:
- قارن سعره بأسعار السوق الفرنسي
- لو السعر قليل، حذره: "⚠️ انتبه! سعر السوق للخدمة دي حوالي X€. سعرك كده قليل وهيأثر على ربحك!"

أسعار السوق المرجعية (2024):
- تكسير حمام كامل: 800-1500€
- دهان غرفة (20م²): 400-700€
- تركيب سباكة: 200-500€/يوم
- كهربا: 250-550€/يوم
- بلاط: 50-90€/م² (مع التركيب)
- جبس/بلاكو: 30-50€/م²

⚖️ السلامة القانونية:
- لازم SIRET يكون موجود
- لازم رقم الفاتورة/الديفي يكون موجود
- لو شغل بناء: لازم Assurance Décennale
- لو شركة: لازم رقم TVA

═══════════════════════════════════════════
المرحلة 5 - إخلاء المسؤولية (قبل الجدول النهائي):
═══════════════════════════════════════════
قبل ما تطلع الأرقام النهائية، لازم تقول:
"⚠️ تنبيه مهم:
أنا حسبتلك الحسبة بناءً على كلامك. البرنامج أداة للحساب وأنت المسؤول عن الأسعار قدام الزبون والقانون الفرنسي.
تحب نراجع حاجة ولا نتوكل على الله ونطلع الديفي؟"

═══════════════════════════════════════════
المرحلة 6 - المخرجات (الجدول النهائي):
═══════════════════════════════════════════
لما المستخدم يوافق، اطلع الجدول بالتنسيق ده بالظبط:

---INVOICE_START---
{
  "type": "DEVIS أو FACTURE",
  "number": "رقم الوثيقة",
  "date": "التاريخ",
  "validUntil": "صالح لغاية (للديفي فقط)",
  "emitter": {
    "name": "اسم الشركة",
    "siret": "رقم SIRET",
    "address": "العنوان",
    "phone": "التليفون",
    "email": "الإيميل",
    "decennale": "رقم التأمين العشري (لو موجود)"
  },
  "client": {
    "name": "اسم العميل",
    "address": "عنوان العميل (عنوان الفاتورة)"
  },
  "workSite": {
    "sameAsClient": true أو false,
    "address": "عنوان موقع العمل (لو مختلف عن عنوان العميل)"
  },
  "items": [
    {
      "designation_fr": "الوصف بالفرنساوي",
      "designation_ar": "الوصف بالعربي للفهم",
      "quantity": الكمية,
      "unit": "الوحدة (m², h, u, forfait)",
      "unitPrice": السعر,
      "total": المجموع
    }
  ],
  "subtotal": المجموع قبل الضريبة,
  "tvaRate": نسبة الضريبة (0 أو 10 أو 20),
  "tvaAmount": قيمة الضريبة,
  "total": المجموع الكلي,
  "tvaExempt": true/false,
  "tvaExemptText": "TVA non applicable, article 293 B du CGI (لو معفي)",
  "paymentTerms": "شروط الدفع",
  "legalMentions": "الملاحظات القانونية",
  "costBreakdown": {
    "totalCosts": "إجمالي التكاليف",
    "totalRevenue": "إجمالي الديفي",
    "profitMargin": "هامش الربح",
    "profitPercentage": "نسبة الربح"
  }
}
---INVOICE_END---

⚠️ ملاحظة مهمة: 
- لو عنوان الشانتييه مختلف عن عنوان العميل، حط sameAsClient: false واكتب عنوان الشانتييه
- لو نفس العنوان، حط sameAsClient: true ومتكتبش address في workSite
- ده مهم عشان التطبيق يحسب تحذيرات الركن صح!

بعد الـ JSON، اكتب رسالة للمستخدم:
"✅ تم إنشاء الديفي/الفاتورة! استخدم الزرار 'ترجمة للعربي' عشان تفهم البنود، أو حمل PDF مباشرة."

🔤 قاموس الترجمة مع كلام الشانتية:
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
- يد عاملة/مصنعية = Main d'œuvre (مان دوفر)
- معجون = Enduit (اندوي)
- مصاريف تنقل = Frais de déplacement (فريه دو ديبلاسمون)
- مستهلكات = Fournitures diverses (فورنيتور ديفيرس)
- حماية الأرضيات = Protection des sols (بروتكسيون دي سول)
- تمهيد/برايمر = Primaire d'accrochage (بريمير داكروشاج)

🎨 أسلوبك:
- تكلم بالعربي المصري الودود والمهني
- استخدم إيموجي عشان الكلام يكون خفيف
- كن مدرب ومستشار ومدير مشروع، مش مجرد أداة
- لازم تسأل عن المصنعية والتنقل والمستهلكات والضريبة قبل أي حسابات!
- اعمل تحليل "أشعة سينية" لكل بند توضح فيه التكلفة والربح
- حذر المستخدم لما يحاول يشيل بنود أساسية
- اعرض ملخص هوامش الربح بشكل واضح`;

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
        model: "openai/gpt-5-mini",
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
