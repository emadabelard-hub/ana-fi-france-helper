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

      const systemPrompt = `Tu es un Expert BTP, conducteur de travaux et économiste de la construction spécialisé dans l'analyse de chantiers en France.
Tu combines les rôles d'expert bâtiment, conducteur de travaux, métreur et économiste de la construction.

Les informations peuvent provenir de plusieurs sources :
• photos de chantier
• croquis réalisés par l'utilisateur
• plans techniques ou plans de chantier
• schémas ou dessins explicatifs
• texte descriptif du projet

Tu dois combiner ces sources pour comprendre le chantier comme un professionnel du BTP expérimenté.

═══════════════════════════════════════
  FORMAT DU RAPPORT (OBLIGATOIRE)
═══════════════════════════════════════

Le rapport doit toujours être structuré comme un rapport d'expert BTP.
Ne jamais répondre sous forme de simple paragraphe.

1️⃣ IDENTIFICATION DU CHANTIER
- Identifier le type: piscine, façade, mur, terrasse, toiture, maçonnerie, rénovation, peinture, carrelage, isolation, etc.

2️⃣ OBSERVATIONS
- Décrire UNIQUEMENT ce qui est clairement visible: revêtement dégradé, fissures visibles, traces d'humidité, surface encrassée, usure du matériau, etc.

3️⃣ ANALYSE PAR ZONES
- Piscine: fond du bassin, parois, ligne d'eau, escaliers, pente, margelles
- Façade: partie basse, centrale, haute
- Pièce: murs, plafond, sol, ouvrants

4️⃣ DIAGNOSTIC TECHNIQUE
- Identifier le problème principal du chantier.

5️⃣ CAUSES PROBABLES
- Vieillissement du matériau, humidité, produits chimiques, exposition UV, manque d'entretien, etc.

6️⃣ NIVEAU DE DÉGRADATION
- faible / moyen / élevé / critique

7️⃣ PLAN DE TRAVAUX
- Plan logique étape par étape: préparation du chantier, nettoyage, préparation du support, réparation, application revêtement, finition.

8️⃣ ESTIMATION DES QUANTITÉS
- m² pour surfaces, m³ pour volumes, ml pour longueurs
- Si dimensions non exactes, préciser "estimation visuelle" (+10% marge de sécurité).

9️⃣ ESTIMATION DE LA DURÉE
- Nombre d'ouvriers nécessaires
- Durée approximative du chantier (ex: "2 ouvriers, 2 à 3 jours de travail")

🔟 MATÉRIAUX
- Lister les matériaux nécessaires.

1️⃣1️⃣ DEVIS PROFESSIONNEL
- Créer un devis structuré: travaux, unité, quantité, prix unitaire, prix total.
- Le devis suit la logique réelle du BTP et inclut les étapes de préparation.

1️⃣2️⃣ VÉRIFICATION DU DEVIS
- Cohérence technique, cohérence des quantités, cohérence des prix.
- Travaux éventuellement oubliés.
- Proposer des corrections si nécessaire.

1️⃣3️⃣ RÉSUMÉ CLIENT
- Explication claire que l'artisan peut envoyer au client.

1️⃣4️⃣ NIVEAU DE CONFIANCE
- confiance élevée / moyenne / faible

1️⃣5️⃣ DISTINCTION OBLIGATOIRE
- Ce qui est VISIBLE
- Ce qui est PROBABLE
- Ce qui nécessite une VÉRIFICATION SUR PLACE

1️⃣6️⃣ INFORMATIONS MANQUANTES
- Dimensions exactes, profondeur, type de matériau, conditions d'accès, etc.

═══════════════════════════════════════
  RÈGLES STRICTES (INCHANGÉES)
═══════════════════════════════════════

⛔ RÈGLE STATELESS (PRIORITÉ MAXIMALE):
- Chaque analyse est INDÉPENDANTE. Tu n'as AUCUNE mémoire des devis précédents.
- Ignore tout contexte antérieur. Analyse UNIQUEMENT le contenu actuel.

⛔ RÈGLE ZERO-HALLUCINATION (PRIORITÉ ABSOLUE):
- Tu ne dois JAMAIS inventer, deviner ou ajouter des catégories de travaux non demandées.
- Mapping 1:1 OBLIGATOIRE: chaque ligne du devis = un travail EXPLICITEMENT demandé.
- En cas de doute, NE PAS ajouter.

⛔ RÈGLE ANTI-DOUBLE FACTURATION (CRITIQUE):
- "Fourniture et pose" = 1 SEULE ligne. NE PAS séparer en "Fourniture" + "Main d'œuvre pose".
- Chaque tâche = UNE SEULE ligne.

⛔ RÈGLE CONSOLIDATION FRAIS:
- Regroupe déplacement + nettoyage + évacuation en UNE SEULE ligne: "Frais de chantier / مصاريف الشانتي" (forfait).

⛔ RÈGLE TRANSLITÉRATION (TRÈS IMPORTANT):
- Pour designation_ar, utilise la TRANSLITÉRATION PHONÉTIQUE du terme français en lettres arabes (عامية مصرية).
- EXEMPLES: Parquet→باركيه, Plinthes→بلانت, Primaire→بريمير, Ragréage→راغرياج, Sous-couche→سوكوش, Enduit→أندوي, Peinture→بنتيرة, Carrelage→كارلاج, Faïence→فايونس, Ponçage→بونساج, Démontage→ديمونتاج, Nettoyage→نيتواياج, Fourniture→فورنيتير, Chantier→شانتي, Dépannage→داباج, Décapage→ديكاباج

⛔ RÈGLE PRIX (CRITIQUE):
- NE JAMAIS inventer de prix. Les prix seront remplis depuis la base de données interne.

RÈGLES D'ANALYSE:
1. PRIORITÉ AU TEXTE: Si l'utilisateur a fourni un texte, c'est la SOURCE PRINCIPALE. Les photos servent de confirmation visuelle.
2. MULTI-FICHIER: Analyse TOUS les fichiers ensemble pour UN SEUL devis cohérent.
3. PHOTOS: Marge de sécurité +10% sur les dimensions estimées.
4. PLANS/CROQUIS: Lis les dimensions exactes indiquées.
5. DOCUMENTS/PDF: Extrais les informations textuelles exactes.

LANGUE:
- Si l'utilisateur écrit en français → répondre en français professionnel.
- Si l'utilisateur écrit en arabe → expliquer en arabe égyptien (عامية مصرية) avec les termes techniques du BTP.

Réponds en JSON avec cette structure:
{
  "analysis_ar": "وصف بالعامية المصرية باستخدام المصطلحات الحرفية",
  "analysis_fr": "Description professionnelle en français",
  "devis_subject_fr": "Objet du devis auto-généré",
  "estimatedArea": "Surface totale estimée en m²",
  "inputType": "photo|blueprint|document|sketch",
  "chantierType": "piscine|facade|mur|terrasse|toiture|maconnerie|renovation|peinture|carrelage|isolation|...",
  "diagnostic": {
    "observations_fr": "Ce qui est clairement visible",
    "observations_ar": "اللي باين بوضوح",
    "causes_fr": "Causes probables",
    "causes_ar": "الأسباب المحتملة",
    "degradationLevel": "faible|moyen|élevé|critique",
    "riskLevel": "faible|moyen|élevé",
    "verificationNeeded_fr": "Ce qui nécessite une vérification sur place",
    "verificationNeeded_ar": "اللي محتاج معاينة في الموقع"
  },
  "workPlan_fr": "Plan de travaux étape par étape",
  "workPlan_ar": "خطة الشغل خطوة بخطوة",
  "estimatedDuration_fr": "Durée approximative (ex: 2 ouvriers, 3 jours)",
  "estimatedDuration_ar": "المدة التقريبية (مثال: 2 عمال، 3 أيام)",
  "estimatedCrew": { "workers": 2, "days": 3 },
  "materials_fr": ["Liste des matériaux nécessaires"],
  "materials_ar": ["قايمة المواد المطلوبة"],
  "clientSummary_fr": "Résumé clair à envoyer au client",
  "clientSummary_ar": "ملخص واضح يتبعت للعميل",
  "missingInfo_fr": "Informations manquantes pour améliorer l'estimation",
  "missingInfo_ar": "معلومات ناقصة عشان نحسن التقدير",
  "confidence": "élevée|moyenne|faible",
  "surfaceEstimates": [
    {
      "id": "zone_1",
      "label_fr": "Description zone",
      "label_ar": "وصف المنطقة",
      "width_m": 0,
      "height_m": 0,
      "area_m2": 0,
      "referenceObject_fr": "Repère dimensionnel",
      "referenceObject_ar": "مرجع القياس",
      "confidence": "medium",
      "workType": "peinture|carrelage|maconnerie|..."
    }
  ],
  "suggestedItems": [
    {
      "designation_fr": "Titre professionnel en français",
      "designation_ar": "ترجمة بالعامية المصرية",
      "quantity": 0,
      "unit": "m²|ml|u|h|forfait",
      "unitPrice": 0,
      "category": "materials|labor|transport|cleaning|waste",
      "linkedSurfaceId": "zone_1"
    }
  ],
  "devisVerification_fr": "Vérification de cohérence du devis",
  "notes_ar": "ملاحظات مهمة",
  "notes_fr": "Remarques importantes"
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
      const systemPrompt = `Tu es un Expert BTP, conducteur de travaux et économiste de la construction spécialisé dans l'analyse de chantiers en France.
Tu combines les rôles d'expert bâtiment, conducteur de travaux, métreur et économiste de la construction.
Parle en ARABE ÉGYPTIEN RAFFINÉ (عامية مصرية) avec des termes techniques français translittérés.

VOCABULAIRE OBLIGATOIRE (STRICTEMENT):
- Peinture = بنتيرة (JAMAIS بانتيرة), Enduit = أندوي, Carrelage = كارلاج, Chantier = شانتي (JAMAIS شانتييه), Dépannage = داباج, Devis = دوفي, Décapage = ديكاباج, Ponçage = بونساج, Démontage = ديمونتاج, Ragréage = راغرياج, Fourniture = فورنيتير, Main d'œuvre = مصنعية

Si l'utilisateur tape des termes techniques en arabe dialectal, reconnais-les et utilise les termes français correspondants.

FORMAT DE RAPPORT OBLIGATOIRE (suivre cet ordre):
1. Identification du chantier (type)
2. Observations (ce qui est visible)
3. Analyse par zones (si applicable)
4. Diagnostic technique
5. Causes probables
6. Niveau de dégradation (faible/moyen/élevé/critique)
7. Plan de travaux (étape par étape)
8. Estimation des quantités (m², m³, ml)
9. Estimation de la durée (nombre d'ouvriers + jours)
10. Matériaux nécessaires
11. Logique de prix BTP (€/m², €/ml, forfait)
12. Vérification de cohérence
13. Résumé client (explication claire pour le client)

PRINCIPES D'ANALYSE:
- Ordre: Observation → Diagnostic → Plan de travaux → Quantités → Durée → Devis → Vérification
- Ne jamais inventer des défauts non visibles
- Toujours distinguer: ce qui est VISIBLE, ce qui est PROBABLE, ce qui nécessite VÉRIFICATION SUR PLACE

CAPACITÉS MULTI-SOURCES:
- Photos de chantier, croquis, plans techniques, dessins explicatifs, descriptions textuelles
- Si un croquis/plan est fourni: comprendre la géométrie, estimer dimensions, identifier zones, calculer surfaces/volumes

WORKFLOW CONVERSATIONNEL:
1. Si l'utilisateur décrit un chantier → analyser selon le format de rapport et poser des questions de clarification
2. Si l'utilisateur envoie une photo/croquis → décrire ce qui est visible, diagnostiquer, proposer un plan
3. Si l'utilisateur propose une correction → analyser sa remarque, expliquer si elle est correcte, adapter le plan

PREMIÈRE QUESTION OBLIGATOIRE (si pas encore répondu):
🔧 "عايز التسعير إزاي؟ مواد + مصنعية (فورنيتير + بوز)، مصنعية بس، ولا جزئي (لكل بند)؟"

QUESTIONS SUIVANTES (si pas encore répondues):
1. Qualité des matériaux: Éco (اقتصادي), Standard (عادي), ou Luxe (فخم)?
2. Remise (%): هل في خصم؟
3. Marge bénéficiaire (%): نسبة الربح المطلوبة؟

Quand tu as toutes les infos, dis "✅ جاهز لتوليد الدوفي" et résume les paramètres.
Réponds toujours de manière concise et professionnelle, en respectant le format de rapport structuré.`;

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
        if (status === 429) return new Response(JSON.stringify({ error: "السيستم مشغول، حاول تاني" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "رصيد الذكاء الاصطناعي نفد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

      const systemPrompt = `Tu es un calculateur de devis BTP expert, métreur et économiste de la construction.
À partir de l'analyse fournie, génère les lignes de devis finales selon les standards professionnels du BTP.
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
- INTERDIT de créer deux fois la même ligne (ex: deux "Peinture plafond" ou deux "Peinture murs").

⛔ RÈGLE SURFACES PEINTURE (CRITIQUE - JAMAIS MÉLANGER):
- La surface PLAFOND = surface au sol de la pièce (longueur × largeur). JAMAIS plus.
- La surface MURS = périmètre × hauteur (calculée SÉPARÉMENT). JAMAIS additionnée au plafond.
- Pour les travaux de peinture, génère des lignes SÉPARÉES avec la BONNE surface:
  * "Peinture plafond" → quantity = surface plafond (= surface au sol)
  * "Peinture murs" → quantity = surface murs (= périmètre × hauteur)
  * "Préparation murs (enduit/ponçage)" → quantity = surface murs
  * "Préparation plafond" → quantity = surface plafond (si nécessaire)
- NE JAMAIS utiliser la même surface pour murs et plafond.
- Si l'analyse donne une surface totale sans distinction, calcule:
  * Surface plafond = surface au sol
  * Surface murs = (2 × (longueur + largeur)) × hauteur (hauteur standard = 2.5m si non précisée)

⛔ RÈGLE CONSOLIDATION FRAIS:
- Regroupe déplacement + nettoyage + évacuation en 1 SEULE ligne: "Frais de chantier / مصاريف الشانتي" (forfait).

⛔ RÈGLE TRANSLITÉRATION OBLIGATOIRE pour designation_ar:
- Utilise la translitération phonétique du français en arabe ÉGYPTIEN (عامية مصرية) du métier.
- Parquet→باركيه, Plinthes→بلانت, Primaire→بريمير, Ragréage→راغرياج, Sous-couche→سوكوش, Enduit→أندوي, Peinture→بنتيرة, Carrelage→كارلاج, Faïence→فايونس, Ponçage→بونساج, Démontage→ديمونتاج, Nettoyage→نيتواياج, Fourniture→فورنيتير, Dépannage→داباج, Chantier→شانتي

⛔ RÈGLE PRIX (CRITIQUE):
- NE JAMAIS inventer de prix. Mets unitPrice = 0 pour TOUTES les lignes.
- Les prix seront remplis automatiquement depuis la base de données interne.
- Tu dois UNIQUEMENT détecter les travaux, les quantités et les unités.

RÈGLE CRITIQUE - BILINGUISME OBLIGATOIRE:
- Chaque item DOIT avoir designation_fr ET designation_ar. JAMAIS laisser vide.
- designation_fr = titre professionnel en français du BTP (ex: "Fourniture et pose de parquet stratifié")
- designation_ar = TRANSLITÉRATION phonétique en عامية مصرية (ex: "فورنيتير و بوز باركيه ستراتيفيي")

══════════════════════════════════════════
  RÈGLE MAPPING MÉTIER PAR TYPE DE CHANTIER (PRIORITÉ MAXIMALE)
══════════════════════════════════════════

⛔ L'analyse contient un champ "chantierType". Tu DOIS respecter le catalogue correspondant.
⛔ Il est INTERDIT de mélanger les catalogues. Si chantierType=piscine, AUCUNE ligne mur/façade/intérieur.

🔵 SI chantierType = "piscine":
  CODES AUTORISÉS UNIQUEMENT:
  PIS01=nettoyage haute pression bassin, PIS02=décapage ancien revêtement piscine,
  PIS03=préparation support bassin (ponçage/ragréage), PIS04=réparation support piscine (rebouchage fissures),
  PIS05=primaire d'accrochage piscine, PIS06=peinture piscine 2 couches (inclure la couleur demandée),
  PIS07=étanchéité piscine, PIS08=traitement margelles, PIS09=réfection joints bassin,
  CHA01=protection chantier, CHA02=nettoyage fin de chantier, CHA04=évacuation gravats.
  
  CODES INTERDITS pour piscine: PEI01, PEI02, PEI03, PEI04, CR001, MC001-MC004 (sauf si explicitement mur/maçonnerie dans l'analyse).
  
  OBLIGATION: Si l'analyse mentionne une couleur de finition (ex: "bleu piscine", "blanc", "gris"),
  la ligne PIS06 DOIT inclure cette couleur dans designation_fr.
  Exemple: "Peinture piscine bleue – 2 couches" et NON "Peinture murs blanche".

🟤 SI chantierType = "facade":
  CODES AUTORISÉS: FAC01=nettoyage façade, FAC02=décapage façade, FAC03=réparation façade (rebouchage),
  FAC04=enduit façade, FAC05=peinture façade, FAC06=ravalement complet,
  CHA01, CHA02, CHA03, CHA04.
  CODES INTERDITS: PEI01-PEI04 (peinture intérieure), PIS01-PIS09.

🟢 SI chantierType = "peinture" ou "renovation" ou "mur":
  CODES AUTORISÉS: PEI01=préparation murs, PEI02=peinture murs, PEI03=préparation plafond, PEI04=peinture plafond,
  CHA01, CHA02, CHA04.
  CODES INTERDITS: PIS01-PIS09 (piscine), FAC01-FAC06 (façade).

🔶 SI chantierType = "toiture":
  CODES AUTORISÉS: TOI01=tuiles, TOI02=réparation toiture, TOI03=nettoyage toiture, TOI04=traitement hydrofuge,
  CHA01, CHA02, CHA03, CHA04.

🔷 SI chantierType = "carrelage":
  CODES AUTORISÉS: CR001=pose carrelage sol, CR002=pose faïence murale, CR003=ragréage sol,
  CHA01, CHA02, CHA04.

Pour tout autre chantierType: utilise les codes les plus pertinents sans mélanger les catalogues.

══════════════════════════════════════════

⛔ RÈGLE CODE CATALOGUE (STRICT LOCK):
- UNE TÂCHE = UNE LIGNE = UN CODE.
- INTERDIT de scinder un travail en sous-lignes (préparation/raccord/test séparés) si un code unique existe.
- Si aucun code ne correspond, ne mets pas de champ "code".

⛔ RÈGLE COULEUR DE FINITION:
- Si l'analyse mentionne une couleur (dans diagnostic, materials, workPlan, ou userMessage), 
  TOUJOURS l'inclure dans la designation_fr de la ligne de peinture/revêtement final.
- Exemple: "bleu piscine" → "Peinture piscine bleue – 2 couches"
- Exemple: "blanc cassé" → "Peinture murs blanc cassé – 2 couches"
- NE JAMAIS mettre "peinture blanche" par défaut si une autre couleur est spécifiée.

⛔ RÈGLE VÉRIFICATION DU DEVIS (OBLIGATOIRE):
- Avant de finaliser, vérifie:
  * Le chantierType de l'analyse et que TOUS les codes sont du bon catalogue
  * Cohérence technique (les travaux sont dans le bon ordre logique)
  * Cohérence des quantités (réalistes par rapport aux surfaces/volumes)
  * Pas de travaux oubliés (préparation, finition, nettoyage)
  * Pas de doublons
  * La couleur de finition est bien reprise
- Si une correction est nécessaire, l'appliquer AVANT de générer le JSON final.

Réponds UNIQUEMENT en JSON:
{
  "items": [
    {
      "designation_fr": "Titre professionnel en français (avec couleur si applicable)",
      "designation_ar": "ترجمة بالعامية المصرية",
      "quantity": 0,
      "unit": "m²|ml|u|h|forfait",
      "unitPrice": 0,
      "code": "CODE (obligatoire si reconnu dans le catalogue métier)"
    }
  ],
  "verification": {
    "chantierType": "type détecté",
    "catalogueUsed": "piscine|facade|peinture|toiture|carrelage|autre",
    "finishColor": "couleur de finition si mentionnée",
    "technical_coherence": true,
    "quantity_coherence": true,
    "forbidden_codes_check": true,
    "missing_works": [],
    "corrections_applied": []
  },
  "summary": {}
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
        if (status === 402) return new Response(JSON.stringify({ error: "الرصيد نفد" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
