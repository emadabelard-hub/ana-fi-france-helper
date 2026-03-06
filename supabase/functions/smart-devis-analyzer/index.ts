import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Arabic construction term dictionary for auto-translation
const ARABIC_TERMS: Record<string, string> = {
  // Enduit
  'أندوي': 'Enduit', 'اندوي': 'Enduit', 'أندوي': 'Enduit',
  // Peinture
  'بانتيرة': 'Peinture', 'بنتيرة': 'Peinture', 'بانتور': 'Peinture', 'بونتير': 'Peinture',
  // Carrelage / Céramique
  'كارلاج': 'Carrelage', 'كارولاج': 'Carrelage', 'سيراميك': 'Céramique', 'سيراميك': 'Céramique',
  // Faïence
  'فايونس': 'Faïence', 'فيونس': 'Faïence',
  // Placo / Cloison / Gypse
  'بلاكو': 'Placo', 'بلاكوبلاتر': 'Placoplatre', 'كلوازون': 'Cloison',
  'جبس': 'Plâtre / Gypse', 'جيبس': 'Plâtre / Gypse', 'جبسن بورد': 'Plaque de plâtre',
  // Ponçage / Soufflage
  'بوندوز': 'Ponçage', 'سوبلاج': 'Soufflage',
  // Plomberie
  'بلومبري': 'Plomberie', 'سباكة': 'Plomberie', 'سباكه': 'Plomberie', 'بلومبييه': 'Plomberie',
  // Électricité
  'اليكتريسيتي': 'Électricité', 'كهرباء': 'Électricité', 'كهربا': 'Électricité', 'اليكتريك': 'Électricité',
  // Parquet
  'باركي': 'Parquet', 'باركيه': 'Parquet',
  // Démontage / Montage
  'ديمونتاج': 'Démontage', 'مونتاج': 'Montage',
  // Nettoyage
  'نيتواياج': 'Nettoyage',
  // Isolation
  'ايزولاسيون': 'Isolation', 'عزل': 'Isolation', 'عزل حراري': 'Isolation thermique', 'عزل صوتي': 'Isolation phonique',
  // Étanchéité
  'ايتانشيتي': 'Étanchéité', 'عزل مائي': 'Étanchéité',
  // Ravalement / Maçonnerie / Menuiserie
  'رافالمون': 'Ravalement', 'ماسونري': 'Maçonnerie', 'مونيزري': 'Menuiserie',
  // Sous-couche / Finition / Décapage
  'سوس كوش': 'Sous-couche', 'فينيسيون': 'Finition', 'ديكاباج': 'Décapage',
  // Chantier
  'شانتي': 'Chantier', 'شانتييه': 'Chantier',
  // Climatisation / Chauffage
  'كليماتيزاسيون': 'Climatisation', 'تكييف': 'Climatisation', 'شوفاج': 'Chauffage', 'تدفئة': 'Chauffage',
  // Robinet / Sanitaire
  'روبيني': 'Robinetterie', 'حنفية': 'Robinetterie', 'سانيتير': 'Sanitaire',
  // Prise / Interrupteur
  'بريز': 'Prise électrique', 'انتيريبتور': 'Interrupteur',
  // Faux plafond
  'فو بلافون': 'Faux plafond', 'سقف معلق': 'Faux plafond',
  // Devis
  'دوفي': 'Devis', 'فاكتير': 'Facture',
};

function translateArabicTerms(text: string): string {
  let result = text;
  for (const [ar, fr] of Object.entries(ARABIC_TERMS)) {
    result = result.replace(new RegExp(ar, 'gi'), fr);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Auth (optional): accept both authenticated and public/guest calls
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        console.warn("Invalid auth token, continuing as public call");
      }
    }

    const body = await req.json();
    const { action, imageData, mimeType, conversationHistory, userMessage, preferences } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    // Action: analyze_image - Vision analysis of photo/blueprint/document
    if (action === "analyze_image") {
      const { files } = body;

      const systemPrompt = `Tu es un expert en estimation de travaux du bâtiment (BTP) en France.
Tu analyses des images de chantiers, plans, croquis ou documents pour générer des devis professionnels.

RÈGLES STRICTES:
1. PRIORITÉ AU TEXTE: Si l'utilisateur a fourni un texte décrivant les travaux, c'est la SOURCE PRINCIPALE pour définir "ce qu'il faut faire". Les photos/documents servent de confirmation visuelle, évaluation de l'état et estimation des quantités.
2. MULTI-FICHIER: Tu peux recevoir PLUSIEURS images et/ou PDFs en même temps. Analyse-les TOUS ensemble pour produire UN SEUL devis complet et cohérent. Chaque fichier peut montrer une pièce, un angle, ou un document différent.
3. Pour les PHOTOS de chantier: Applique une marge de sécurité de +10% sur les dimensions estimées
4. Pour les PLANS/CROQUIS: Lis les dimensions exactes indiquées
5. Pour les DOCUMENTS/PDF: Extrais les informations textuelles exactes

ESTIMATION DES SURFACES PAR OBJETS DE RÉFÉRENCE (TRÈS IMPORTANT pour les photos):
Utilise les objets visibles dans la photo comme référence d'échelle pour estimer les dimensions:
- Porte standard française: ~2.04m × 0.83m (surface ~1.7m²)
- Fenêtre standard: ~1.2m × 1.0m
- Lit simple: ~1.9m × 0.9m | Lit double: ~1.9m × 1.4m
- Interrupteur / prise: ~0.08m × 0.08m (hauteur depuis sol ~1.1m)
- Carrelage standard: 30×30cm ou 60×60cm
- Plinthe: hauteur ~8-10cm
- Radiateur standard: ~0.6m × 0.8m
- Baignoire: ~1.7m × 0.7m | Lavabo: ~0.5m × 0.4m
- WC: ~0.7m × 0.4m
À partir de ces repères, estime la largeur et hauteur de chaque mur/surface visible.
Le champ "surfaceEstimates" doit contenir UNE ENTRÉE PAR SURFACE identifiée (mur, sol, plafond).
Pour chaque surface, indique l'objet de référence utilisé et le calcul.

ANALYSE BILINGUE (Arabe Égyptien + Français):
- Le champ "analysis_ar" doit être en arabe égyptien (عامية مصرية) avec les termes techniques artisanaux:
  * بانتيرة = Peinture
  * كارلاج = Carrelage
  * أندوي = Enduit
  * شانتي = Chantier
  * فايونس = Faïence
  * بلاكو = Placo
  * باركي = Parquet
- Le champ "analysis_fr" doit être en français professionnel

ANALYSE DEMANDÉE:
- Identifie le type de travaux visibles
- Estime les surfaces/dimensions (avec +10% marge si photo)
- Liste les postes de travail nécessaires
- Propose des matériaux adaptés

Réponds en JSON avec cette structure:
{
  "analysis_ar": "وصف بالعربي المصري باستخدام المصطلحات الحرفية (بانتيرة، كارلاج، أندوي...)",
  "analysis_fr": "Description professionnelle en français",
  "estimatedArea": "Surface totale estimée en m²",
  "inputType": "photo|blueprint|document",
  "surfaceEstimates": [
    {
      "id": "wall_1",
      "label_fr": "Mur principal (côté porte)",
      "label_ar": "الحيطة الرئيسية (ناحية الباب)",
      "width_m": 4.2,
      "height_m": 2.5,
      "area_m2": 10.5,
      "referenceObject_fr": "Porte standard (2.04m) comme repère de hauteur",
      "referenceObject_ar": "الباب القياسي (2.04م) كمرجع للارتفاع",
      "confidence": "medium",
      "workType": "peinture"
    }
  ],
  "suggestedItems": [
    {
      "designation_fr": "Titre professionnel en français (ex: Dépose faïence existante)",
      "designation_ar": "الترجمة بالعامية المصرية مع مصطلحات الحرفيين (ex: فك فايونس قديم)",
      "quantity": number,
      "unit": "m²|ml|u|h|forfait",
      "unitPrice": number,
      "category": "materials|labor|transport|cleaning|waste",
      "linkedSurfaceId": "wall_1"
    }
  ],

RÈGLE CRITIQUE - BILINGUISME OBLIGATOIRE:
- Chaque item DOIT avoir designation_fr ET designation_ar remplis. JAMAIS vide.
- designation_fr = français professionnel du BTP
- designation_ar = arabe égyptien artisanal (عامية مصرية) avec les termes phonétiques du métier
  "notes_ar": "ملاحظات مهمة بالعربي",
  "notes_fr": "Remarques importantes en français"
}`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
      ];

      // Build multi-file content array
      const hasFiles = Array.isArray(files) && files.length > 0;
      const hasLegacyImage = !hasFiles && imageData;

      if (hasFiles || hasLegacyImage) {
        const contentParts: any[] = [
          { type: "text", text: userMessage || "Analyse ces fichiers et génère un devis détaillé." }
        ];

      if (hasFiles) {
          for (const file of files) {
            if (file.type === 'image' && file.data) {
              contentParts.push({
                type: "image_url",
                image_url: { url: file.data.startsWith("data:") ? file.data : `data:${file.mimeType || 'image/jpeg'};base64,${file.data}` }
              });
            }
            // PDFs: use pre-extracted text (much faster than sending raw base64)
            if (file.type === 'pdf') {
              if (file.extractedText) {
                contentParts.push({
                  type: "text",
                  text: `\n--- Contenu du document PDF "${file.name}" ---\n${file.extractedText}\n--- Fin du document ---\n`
                });
              } else if (file.data) {
                // Legacy fallback: send as image_url
                contentParts.push({
                  type: "image_url",
                  image_url: { url: file.data.startsWith("data:") ? file.data : `data:${file.mimeType || 'application/pdf'};base64,${file.data}` }
                });
              }
            }
          }
        } else if (hasLegacyImage) {
          contentParts.push({
            type: "image_url",
            image_url: { url: imageData.startsWith("data:") ? imageData : `data:${mimeType || 'image/jpeg'};base64,${imageData}` }
          });
        }

        messages.push({ role: "user", content: contentParts });
      } else {
        messages.push({ role: "user", content: userMessage || "Analyse ce document." });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "عذراً، النظام مشغول حالياً. حاول مرة تانية بعد شوية" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "رصيد الذكاء الاصطناعي نفد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      
      // Try to parse JSON from the response
      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { analysis: content, suggestedItems: [] };
      } catch {
        parsed = { analysis: content, suggestedItems: [] };
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: chat - Interactive context gathering
    if (action === "chat") {
      const systemPrompt = `Tu es un assistant devis intelligent pour artisans BTP en France.
Tu dois poser des questions pour affiner le devis. Parle en arabe égyptien (عامية مصرية) avec des termes techniques français.

Si l'utilisateur tape des termes techniques en arabe dialectal (ex: أندوي, بانتيرة, كارلاج), reconnais-les et utilise les termes français correspondants.

QUESTIONS À POSER (si pas encore répondues):
1. Qualité des matériaux: Éco (اقتصادي), Standard (عادي), ou Luxe (فخم)?
2. Remise (%): هل تريد تطبيق خصم؟
3. Marge bénéficiaire (%): كم نسبة الربح المطلوبة؟

Réponds toujours de manière concise et professionnelle.
Quand tu as toutes les infos, dis "✅ جاهز لتوليد الدوفي" et résume les paramètres.`;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
        ...(conversationHistory || []),
      ];

      if (userMessage) {
        const translated = translateArabicTerms(userMessage);
        messages.push({ role: "user", content: translated });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "النظام مشغول، حاول تاني" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "رصيد الذكاء الاصطناعي نفد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Action: generate_items - Final generation with preferences applied
    if (action === "generate_items") {
      const { analysisData, materialQuality, discountPercent, profitMarginPercent } = body;

      const systemPrompt = `Tu es un calculateur de devis BTP expert.
À partir de l'analyse fournie, génère les lignes de devis finales.

RÈGLES DE CALCUL:
- Qualité matériaux: ${materialQuality || 'standard'} (éco = -20%, standard = prix base, luxe = +40%)
- Remise: ${discountPercent || 0}%
- Marge bénéficiaire: ${profitMarginPercent || 15}%

POSTES OBLIGATOIRES à inclure:
1. Matériaux (selon qualité choisie)
2. Main d'œuvre
3. Frais de déplacement (forfait)
4. Nettoyage de chantier (forfait)
5. Évacuation des déchets (forfait)

Applique la formule:
Prix final = (Matériaux + Main d'œuvre + Transport + Nettoyage + Évacuation) × (1 + Marge%) × (1 - Remise%)

RÈGLE CRITIQUE - BILINGUISME OBLIGATOIRE:
- Chaque item DOIT avoir designation_fr ET designation_ar. JAMAIS laisser vide.
- designation_fr = titre professionnel en français du BTP (ex: "Dépose faïence existante", "Peinture acrylique satinée 2 couches")
- designation_ar = traduction en arabe égyptien artisanal (عامية مصرية) avec termes phonétiques (ex: "فك فايونس قديم", "بانتيرة ساتيني طبقتين")

Réponds UNIQUEMENT en JSON:
{
  "items": [
    {
      "designation_fr": "Titre professionnel en français",
      "designation_ar": "ترجمة بالعامية المصرية",
      "quantity": number,
      "unit": "m²|ml|u|h|forfait",
      "unitPrice": number
    }
  ],
  "summary": {
    "materialsTotal": number,
    "laborTotal": number,
    "transportTotal": number,
    "cleaningTotal": number,
    "wasteTotal": number,
    "subtotal": number,
    "profitMargin": number,
    "discount": number,
    "finalTotal": number
  }
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Données d'analyse:\n${JSON.stringify(analysisData)}\n\nGénère le devis final.` }
          ],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "النظام مشغول" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "رصيد نفد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      
      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { items: [], summary: {} };
      } catch {
        parsed = { items: [], summary: {} };
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("smart-devis-analyzer error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
