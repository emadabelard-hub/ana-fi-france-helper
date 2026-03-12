import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Arabic construction term dictionary (Moroccan/North African trade dialect)
const ARABIC_TERMS: Record<string, string> = {
  // Enduit
  'أندوي': 'Enduit', 'اندوي': 'Enduit',
  // Peinture
  'بنتيرة': 'Peinture', 'بانتيرة': 'Peinture', 'بانتور': 'Peinture', 'بونتير': 'Peinture',
  // Carrelage / Céramique
  'كارلاج': 'Carrelage', 'كارولاج': 'Carrelage', 'سيراميك': 'Céramique',
  // Faïence
  'فايونس': 'Faïence', 'فيونس': 'Faïence',
  // Placo / Cloison / Gypse
  'بلاكو': 'Placo', 'بلاكوبلاتر': 'Placoplatre', 'كلوازون': 'Cloison',
  'جبس': 'Plâtre / Gypse', 'جيبس': 'Plâtre / Gypse', 'جبسن بورد': 'Plaque de plâtre',
  // Ponçage / Soufflage
  'بونساج': 'Ponçage', 'بوندوز': 'Ponçage', 'سوبلاج': 'Soufflage',
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
  'سوكوش': 'Sous-couche', 'سوس كوش': 'Sous-couche', 'فينيسيون': 'Finition', 'ديكاباج': 'Décapage',
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
  // Devis / Facture
  'دوفي': 'Devis', 'فاكتير': 'Facture',
  // Moroccan/Trade specific
  'داباج': 'Dépannage', 'فورصة': 'Forfait', 'كريبي': 'Crépi', 'راغرياج': 'Ragréage',
  'بريمير': 'Primaire', 'فورنيتير': 'Fourniture', 'بلانت': 'Plinthes',
  'ديكوراسيون': 'Décoration', 'شنتيي': 'Chantier', 'ماتيريال': 'Matériaux',
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

⛔ RÈGLE STATELESS (PRIORITÉ MAXIMALE):
- Chaque analyse est INDÉPENDANTE. Tu n'as AUCUNE mémoire des devis précédents.
- Ignore tout contexte antérieur. Analyse UNIQUEMENT le contenu actuel (texte + images fournis MAINTENANT).
- Si le sketch/texte mentionne UNIQUEMENT "Parquet", tu génères UNIQUEMENT des lignes Parquet. ZÉRO peinture, ZÉRO carrelage.

⛔ RÈGLE ZERO-HALLUCINATION (PRIORITÉ ABSOLUE):
- Tu ne dois JAMAIS inventer, deviner ou ajouter des catégories de travaux non demandées.
- Mapping 1:1 OBLIGATOIRE: chaque ligne du devis = un travail EXPLICITEMENT demandé.
- En cas de doute, NE PAS ajouter. Un devis incomplet vaut mieux qu'un devis avec des lignes fantômes.

⛔ RÈGLE ANTI-DOUBLE FACTURATION (CRITIQUE):
- Si tu crées une ligne "Fourniture et pose de parquet", tu NE DOIS PAS ajouter une ligne séparée "Main d'œuvre pose parquet". C'est une DOUBLE FACTURATION.
- Chaque tâche = UNE SEULE ligne. "Fourniture et pose" inclut DÉJÀ la main d'œuvre.
- Vérifie CHAQUE item: Plinthes, Peinture, Carrelage, etc. Aucune duplication.

⛔ RÈGLE CONSOLIDATION FRAIS:
- Regroupe tous les petits frais (déplacement, nettoyage, évacuation déchets) en UNE SEULE ligne: "Frais de chantier / مصاريف الشانتي" (forfait).
- NE PAS créer 3 lignes séparées pour déplacement, nettoyage, évacuation.

⛔ RÈGLE TRANSLITÉRATION (TRÈS IMPORTANT):
- Pour designation_ar, utilise la TRANSLITÉRATION PHONÉTIQUE du terme français en lettres arabes.
- C'est le JARGON utilisé par les artisans arabophones (عامية مصرية) dans le bâtiment en France.
- EXEMPLES OBLIGATOIRES:
  * Parquet → باركيه (PAS أرضيات خشبية)
  * Plinthes → بلانت (PAS وزر أو ألواح قاعدية)
  * Primaire → بريمير (PAS طبقة أولية)
  * Ragréage → راغرياج (PAS تسوية)
  * Sous-couche → سوكوش (PAS طبقة تحتية)
  * Enduit → أندوي (PAS معجون)
  * Peinture → بانتيرة (PAS طلاء أو دهان)
  * Carrelage → كارلاج (PAS بلاط)
  * Faïence → فايونس (PAS قيشاني)
  * Ponçage → بونساج (PAS صنفرة)
  * Démontage → ديمونتاج (PAS فك)
  * Nettoyage → نيتواياج (PAS تنظيف)
  * Fourniture → فورنيتير (PAS توريد)
  * Main d'œuvre → مصنعية (terme accepté car universel)
  * Frais de chantier → مصاريف الشانتي
  * Dépannage → داباج (PAS إصلاح)
  * Décapage → ديكاباج (PAS كشط)
- Le but: le client lit le terme FRANÇAIS écrit en lettres arabes, tel qu'il est PRONONCÉ dans le métier.
- Le TONE: عامية مصرية راقية (Arabe Égyptien Raffiné) - professionnel et accessible.

RÈGLES STRICTES:
1. PRIORITÉ AU TEXTE: Si l'utilisateur a fourni un texte, c'est la SOURCE PRINCIPALE et EXCLUSIVE. Les photos servent UNIQUEMENT de confirmation visuelle et estimation des quantités.
2. MULTI-FICHIER: Tu peux recevoir PLUSIEURS images et/ou PDFs. Analyse-les TOUS ensemble pour UN SEUL devis cohérent.
3. Pour les PHOTOS de chantier: Applique une marge de sécurité de +10% sur les dimensions estimées
4. Pour les PLANS/CROQUIS: Lis les dimensions exactes indiquées
5. Pour les DOCUMENTS/PDF: Extrais les informations textuelles exactes

RÈGLE CRITIQUE - INDÉPENDANCE (RAPPEL):
- "Pose de parquet" → UNIQUEMENT: ragréage, fourniture et pose parquet, plinthes. ZÉRO peinture/enduit. UNE ligne par tâche, PAS de duplication.
- "Peinture chambre" → UNIQUEMENT: préparation murs, sous-couche et peinture. ZÉRO parquet/carrelage.
- INTERDIT d'ajouter des catégories "bonus", "complémentaires" ou "recommandées" non demandées.

ANALYSE DEMANDÉE:
- Identifie UNIQUEMENT les travaux explicitement mentionnés dans le texte ou clairement visibles
- Estime les surfaces/dimensions (avec +10% marge si photo)
- Liste UNIQUEMENT les postes directement liés aux travaux demandés
- INTERDIT d'ajouter des catégories non demandées
- INTERDIT de dupliquer un poste (fourniture+pose = 1 seule ligne)

Réponds en JSON avec cette structure:
{
  "analysis_ar": "وصف بالعامية المصرية باستخدام المصطلحات الحرفية (بانتيرة، كارلاج، أندوي...)",
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
- designation_ar = عامية مصرية (arabe égyptien) artisanale avec les termes phonétiques du métier
  "notes_ar": "ملاحظات مهمة بالعامية المصرية",
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
        if (status === 429) return new Response(JSON.stringify({ error: "عذراً، السيستم مشغول حالياً. حاول مرة تانية بعد شوية" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
Tu dois poser des questions pour affiner le devis. Parle en DARIJA MAGHRÉBINE (dialecte marocain/nord-africain) avec des termes techniques français translittérés.

VOCABULAIRE OBLIGATOIRE:
- Peinture = بنتيرة / بانتيرة
- Enduit = أندوي
- Carrelage = كارلاج
- Chantier = شانتي
- Dépannage = داباج
- Forfait = فورصة
- Devis = دوفي

Si l'utilisateur tape des termes techniques en arabe dialectal (ex: أندوي, بانتيرة, كارلاج), reconnais-les et utilise les termes français correspondants.

QUESTIONS À POSER (si pas encore répondues):
1. Qualité des matériaux: Éco (اقتصادي), Standard (عادي), ou Luxe (لوكس)?
2. Remise (%): واش بغيتي خصم؟
3. Marge bénéficiaire (%): شحال بغيتي نسبة الربح؟

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
        if (status === 429) return new Response(JSON.stringify({ error: "السيستم مشغول، عاود من بعد" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "رصيد الذكاء الاصطناعي سالى" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Action: generate_items - Final generation with preferences applied
    if (action === "generate_items") {
      const { analysisData, materialQuality, discountPercent, profitMarginPercent, materialScope } = body;

      const scopeRule = materialScope === 'main_oeuvre_seule'
        ? `\n⛔ RÈGLE SCOPE MATÉRIAUX (CRITIQUE): Le client fournit ses propres matériaux. Chiffre UNIQUEMENT la main d'œuvre (pose, préparation, nettoyage). Les prix ne doivent PAS inclure le coût des matériaux. Utilise "Pose de..." au lieu de "Fourniture et pose de...".`
        : `\nLe devis inclut fourniture ET pose (matériaux + main d'œuvre).`;

      const systemPrompt = `Tu es un calculateur de devis BTP expert.
À partir de l'analyse fournie, génère les lignes de devis finales.
${scopeRule}
⛔ RÈGLE STATELESS (PRIORITÉ MAXIMALE):
- Cette génération est INDÉPENDANTE. Ignore tout devis ou analyse précédent.
- Génère UNIQUEMENT à partir des données d'analyse fournies dans CE message.

⛔ RÈGLE ZERO-HALLUCINATION (PRIORITÉ ABSOLUE):
- Génère UNIQUEMENT des lignes pour les travaux EXPLICITEMENT présents dans l'analyse.
- Mapping 1:1 strict entre l'analyse et les lignes générées.
- NE JAMAIS ajouter de catégories "complémentaires", "recommandées" ou "bonus".

⛔ RÈGLE ANTI-DOUBLE FACTURATION (CRITIQUE):
- "Fourniture et pose" = 1 SEULE ligne. NE PAS séparer en "Fourniture" + "Main d'œuvre pose".
- Chaque tâche identifiée = exactement 1 ligne dans le devis. ZÉRO duplication.
- Vérifie chaque item avant de l'ajouter: est-il déjà couvert par une autre ligne?

⛔ RÈGLE CONSOLIDATION FRAIS:
- Regroupe déplacement + nettoyage + évacuation en 1 SEULE ligne: "Frais de chantier / مصاريف الشانتي" (فورصة).

⛔ RÈGLE TRANSLITÉRATION OBLIGATOIRE pour designation_ar:
- Utilise la translitération phonétique du français en arabe DIALECTE MAROCAIN/MAGHRÉBIN du métier.
- Parquet→باركيه, Plinthes→بلانت, Primaire→بريمير, Ragréage→راغرياج, Sous-couche→سوكوش, Enduit→أندوي, Peinture→بنتيرة, Carrelage→كارلاج, Faïence→فايونس, Ponçage→بونساج, Démontage→ديمونتاج, Nettoyage→نيتواياج, Fourniture→فورنيتير, Dépannage→داباج, Forfait→فورصة, Crépi→كريبي

RÈGLES DE CALCUL:
- Qualité matériaux: ${materialQuality || 'standard'} (éco = -20%, standard = prix base, luxe = +40%)
- Remise: ${discountPercent || 0}%
- Marge bénéficiaire: ${profitMarginPercent || 15}%

POSTES À INCLURE:
1. Fourniture et pose (1 seule ligne par type de travail, inclut matériaux + main d'œuvre)
2. Préparation si nécessaire (ragréage, sous-couche - 1 ligne)
3. Frais de chantier (1 seul forfait regroupant déplacement + nettoyage + évacuation)

Applique la formule:
Prix final = Sous-total × (1 + Marge%) × (1 - Remise%)

RÈGLE CRITIQUE - BILINGUISME OBLIGATOIRE:
- Chaque item DOIT avoir designation_fr ET designation_ar. JAMAIS laisser vide.
- designation_fr = titre professionnel en français du BTP (ex: "Fourniture et pose de parquet stratifié")
- designation_ar = TRANSLITÉRATION phonétique en darija maghrébine (ex: "فورنيتير و بوز باركيه ستراتيفيي")

Réponds UNIQUEMENT en JSON:
{
  "items": [
    {
      "designation_fr": "Titre professionnel en français",
      "designation_ar": "ترجمة بالدارجة المغاربية",
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
        if (status === 429) return new Response(JSON.stringify({ error: "السيستم مشغول" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "رصيد سالى" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
