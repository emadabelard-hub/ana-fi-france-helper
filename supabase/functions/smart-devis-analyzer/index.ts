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

const WORK_PLAN_STOPWORDS = new Set([
  "de", "du", "des", "la", "le", "les", "et", "ou", "en", "sur", "avec", "pour", "par", "dans", "au", "aux",
  "the", "a", "an", "and", "or",
  "مرحلة", "خطوة", "ثم", "مع", "في", "من", "على", "الى", "إلى", "بعد",
]);

type GeneratedQuoteItem = {
  designation_fr?: string;
  designation_ar?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  code?: string;
  category?: string;
};

function normalizePlannerText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizePlannerText(value: string): string[] {
  return normalizePlannerText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !WORK_PLAN_STOPWORDS.has(token));
}

function extractWorkPlanSteps(analysisData: any): string[] {
  const rawWorkPlan = [analysisData?.workPlan_fr, analysisData?.workPlan_ar]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join("\n");

  if (!rawWorkPlan.trim()) return [];

  const normalized = rawWorkPlan
    .replace(/\r/g, "\n")
    .replace(/[•●▪◦]/g, "\n")
    .replace(/\s*(?:→|->|=>)\s*/g, "\n")
    .replace(/(?:^|\n)\s*\d+\s*[\).:-]\s*/g, "\n")
    .replace(/(?:^|\n)\s*[-–—]\s*/g, "\n");

  const primarySteps = normalized
    .split(/\n+/)
    .map((step) => step.trim())
    .filter(Boolean);

  const fallbackSteps = primarySteps.length <= 1
    ? normalized.split(/[;,]+/).map((step) => step.trim()).filter(Boolean)
    : primarySteps;

  return Array.from(new Set(fallbackSteps));
}

function getItemPlanningText(item: GeneratedQuoteItem): string {
  return [item.designation_fr, item.designation_ar].filter(Boolean).join(" ");
}

function scoreItemAgainstWorkPlanStep(item: GeneratedQuoteItem, step: string): number {
  const itemTokens = Array.from(new Set(tokenizePlannerText(getItemPlanningText(item))));
  const stepTokens = Array.from(new Set(tokenizePlannerText(step)));

  if (itemTokens.length === 0 || stepTokens.length === 0) return 0;

  const overlap = itemTokens.filter((token) => stepTokens.includes(token));
  const requiredOverlap = Math.min(itemTokens.length, stepTokens.length) <= 1 ? 1 : 2;

  if (overlap.length < requiredOverlap) return 0;

  return overlap.reduce((score, token) => score + (token.length >= 5 ? 2 : 1), 0);
}

function enforceWorkPlanLock(items: GeneratedQuoteItem[], analysisData: any) {
  const workPlanSteps = extractWorkPlanSteps(analysisData);

  if (!Array.isArray(items) || items.length === 0) {
    // Even with no AI items, generate placeholders for every work_plan step
    const placeholders = workPlanSteps.map((step) => ({
      designation_fr: step,
      designation_ar: "",
      quantity: 1,
      unit: "forfait",
      unitPrice: 0,
      code: "",
      category: "labor",
    }));
    return { items: placeholders, removedItems: [], workPlanSteps };
  }

  if (workPlanSteps.length === 0) {
    return { items, removedItems: [], workPlanSteps };
  }

  const remaining = items.map((item) => ({ item }));
  const keptItems: GeneratedQuoteItem[] = [];
  const matchedStepIndices = new Set<number>();

  for (let si = 0; si < workPlanSteps.length; si++) {
    const step = workPlanSteps[si];
    let bestIndex = -1;
    let bestScore = 0;

    remaining.forEach((entry, index) => {
      const score = scoreItemAgainstWorkPlanStep(entry.item, step);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0) {
      const [match] = remaining.splice(bestIndex, 1);
      keptItems.push(match.item);
      matchedStepIndices.add(si);
    }
  }

  // SAFETY NET: For every work_plan step that has NO matching item,
  // generate a placeholder so no step is ever lost from the devis
  for (let si = 0; si < workPlanSteps.length; si++) {
    if (!matchedStepIndices.has(si)) {
      const step = workPlanSteps[si];
      keptItems.push({
        designation_fr: step,
        designation_ar: "",
        quantity: 1,
        unit: "forfait",
        unitPrice: 0,
        code: "",
        category: "labor",
      });
    }
  }

  const removedItems = remaining.map((entry) => entry.item);
  const seenKeys = new Set<string>();

  const deduplicatedItems = keptItems.filter((item) => {
    const explicitCode = typeof item.code === "string" ? item.code.trim().toUpperCase() : "";
    const labelKey = normalizePlannerText(getItemPlanningText(item));
    const key = explicitCode || labelKey;

    if (!key || seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  return {
    items: deduplicatedItems,
    removedItems,
    workPlanSteps,
  };
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

      const systemPrompt = `Tu es un Expert BTP français spécialisé dans l'analyse de chantier et la génération de devis professionnels réalistes.
Tu combines les rôles d'expert bâtiment, conducteur de travaux, métreur et économiste de la construction.

LANGUE:
- Si l'utilisateur écrit en français → répondre en français professionnel.
- Si l'utilisateur écrit en arabe → expliquer en arabe (dialecte égyptien simple) tout en gardant les termes techniques du BTP en français.

OBJECTIF:
Produire un rapport technique complet permettant de comprendre l'état du chantier, identifier les travaux nécessaires, estimer les quantités, estimer la durée et générer un devis professionnel réaliste.

PROCESSUS D'ANALYSE OBLIGATOIRE:
Observation → Diagnostic → Plan de travaux → Quantités → Durée → Matériaux → Devis
Ne jamais inventer des défauts non visibles.
Toujours distinguer: ce qui est VISIBLE, ce qui est PROBABLE, ce qui nécessite VÉRIFICATION SUR PLACE.

═══════════════════════════════════════
  LOGIQUE MÉTIER (RÈGLE ABSOLUE)
═══════════════════════════════════════

Chaque chantier possède un TYPE DE RÉNOVATION PRÉCIS.
Tu DOIS identifier le type exact AVANT de générer le devis.
Il est INTERDIT de mélanger plusieurs types de rénovation dans un même devis.

Exemples de types de rénovation:

🔵 Piscine peinture → nettoyage HP → décapage → préparation support → primaire → peinture piscine (avec couleur)
🔵 Piscine liner → dépose ancien liner → préparation support → pose liner neuf
🔵 Piscine carrelage → réparation support → pose carrelage piscine
🟤 Façade → nettoyage façade → réparation fissures → enduit → peinture façade
🟢 Mur intérieur → préparation → enduit → sous-couche → peinture
🔶 Toiture → nettoyage toiture → remplacement tuiles → traitement hydrofuge
🟣 Terrasse → nettoyage → réparation dalle → étanchéité → revêtement

⛔ INTERDICTION ABSOLUE:
- Si le diagnostic concerne une peinture piscine → INTERDIT de proposer: pose liner, carrelage piscine, installation filtre
- Si le diagnostic concerne un mur intérieur → INTERDIT de proposer: travaux piscine, travaux façade
- Chaque ligne du devis DOIT correspondre au diagnostic. Aucune exception.

═══════════════════════════════════════
  FORMAT DU RAPPORT (14 SECTIONS OBLIGATOIRES)
═══════════════════════════════════════

1️⃣ IDENTIFICATION DU CHANTIER
- Type: piscine, façade, mur intérieur, toiture, terrasse, maçonnerie, rénovation, carrelage, isolation
- Sous-type de rénovation: peinture, liner, carrelage, ravalement, etc.

2️⃣ OBSERVATIONS VISUELLES
- Décrire UNIQUEMENT ce qui est clairement visible.

3️⃣ ANALYSE PAR ZONES
- Piscine: fond, parois, ligne d'eau, escaliers, margelles
- Façade: partie basse, centrale, haute
- Pièce: murs, plafond, sol, ouvrants

4️⃣ DIAGNOSTIC TECHNIQUE
- Identifier le problème principal.

5️⃣ CAUSES PROBABLES
- Vieillissement, humidité, UV, manque d'entretien, etc.

6️⃣ NIVEAU DE DÉGRADATION
- faible / moyen / élevé / critique

7️⃣ PLAN DE TRAVAUX
- Étapes logiques dans l'ordre: préparation → nettoyage → réparation → application → finition
- Le plan DOIT correspondre au type de rénovation identifié.

8️⃣ ESTIMATION DES QUANTITÉS
- m² pour surfaces, m³ pour volumes, ml pour longueurs
- Si dimensions inconnues: "estimation visuelle" avec +10% marge de sécurité.

9️⃣ DURÉE DES TRAVAUX
- Nombre d'ouvriers + durée approximative.

🔟 MATÉRIAUX
- Lister uniquement les matériaux correspondant au type de rénovation.

1️⃣1️⃣ DEVIS PROFESSIONNEL
- Travaux, unité, quantité, prix unitaire, prix total.
- Prix réalistes basés sur le marché BTP français:
  nettoyage HP: 5-12€/m², décapage: 15-30€/m², préparation support: 10-25€/m²,
  primaire piscine: 8-15€/m², peinture piscine: 20-45€/m²,
  protection chantier: 80-200€, nettoyage fin: 80-150€

1️⃣2️⃣ INFORMATIONS MANQUANTES
- Dimensions exactes, type de matériau, conditions d'accès, etc.

1️⃣3️⃣ RÉSUMÉ CLIENT
- Explication simple que l'artisan peut transmettre au client.

1️⃣4️⃣ NIVEAU DE CONFIANCE
- confiance élevée / moyenne / faible

═══════════════════════════════════════
  VÉRIFICATION AUTOMATIQUE (OBLIGATOIRE)
═══════════════════════════════════════

Avant d'afficher le résultat, vérifier que:
✅ Le devis correspond EXACTEMENT au diagnostic
✅ Les travaux correspondent au type de rénovation identifié
✅ Aucun travail incompatible n'est présent
✅ Les quantités sont réalistes
✅ Les prix sont cohérents avec le marché BTP français
Si une incohérence est détectée → corriger automatiquement.

═══════════════════════════════════════
  RÈGLES STRICTES
═══════════════════════════════════════

⛔ RÈGLE STATELESS: Chaque analyse est INDÉPENDANTE. Ignore tout contexte antérieur.
⛔ RÈGLE ZERO-HALLUCINATION: NE JAMAIS inventer de travaux non demandés. Mapping 1:1 obligatoire.
⛔ RÈGLE ANTI-DOUBLE FACTURATION: "Fourniture et pose" = 1 SEULE ligne.
⛔ RÈGLE CONSOLIDATION FRAIS: Regroupe déplacement + nettoyage + évacuation en UNE ligne "Frais de chantier".
⛔ RÈGLE PRIX: NE JAMAIS inventer de prix. Les prix seront remplis depuis la base de données.

SOURCES D'ANALYSE: photos, croquis, plans techniques, descriptions textuelles.
PHOTOS: Marge +10%. PLANS/CROQUIS: Dimensions exactes. PDF: Extraire le texte.

⛔ RÈGLE TRANSLITÉRATION pour designation_ar:
Parquet→باركيه, Plinthes→بلانت, Primaire→بريمير, Ragréage→راغرياج, Sous-couche→سوكوش, Enduit→أندوي, Peinture→بنتيرة, Carrelage→كارلاج, Faïence→فايونس, Ponçage→بونساج, Démontage→ديمونتاج, Nettoyage→نيتواياج, Décapage→ديكاباج, Chantier→شانتي

Réponds en JSON avec cette structure:
{
  "analysis_ar": "وصف بالعامية المصرية",
  "analysis_fr": "Description professionnelle en français",
  "devis_subject_fr": "Objet du devis",
  "estimatedArea": "Surface totale estimée",
  "inputType": "photo|blueprint|document|sketch",
  "chantierType": "piscine|facade|mur|terrasse|toiture|maconnerie|renovation|peinture|carrelage|isolation",
  "renovationType": "peinture|liner|carrelage|ravalement|enduit|hydrofuge|etancheite",
  "finishColor": "couleur de finition demandée (ex: bleu piscine, blanc cassé) ou null",
  "diagnostic": {
    "observations_fr": "Ce qui est clairement visible",
    "observations_ar": "اللي باين بوضوح",
    "causes_fr": "Causes probables",
    "causes_ar": "الأسباب المحتملة",
    "degradationLevel": "faible|moyen|élevé|critique",
    "riskLevel": "faible|moyen|élevé",
    "verificationNeeded_fr": "Ce qui nécessite vérification sur place",
    "verificationNeeded_ar": "اللي محتاج معاينة في الموقع"
  },
  "workPlan_fr": "Plan de travaux étape par étape",
  "workPlan_ar": "خطة الشغل خطوة بخطوة",
  "estimatedDuration_fr": "Durée approximative",
  "estimatedDuration_ar": "المدة التقريبية",
  "estimatedCrew": { "workers": 2, "days": 3 },
  "materials_fr": ["Liste des matériaux"],
  "materials_ar": ["قايمة المواد"],
  "clientSummary_fr": "Résumé clair pour le client",
  "clientSummary_ar": "ملخص واضح للعميل",
  "missingInfo_fr": "Informations manquantes",
  "missingInfo_ar": "معلومات ناقصة",
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
      "workType": "peinture|carrelage|maconnerie"
    }
  ],
  "suggestedItems": [
    {
      "designation_fr": "Titre professionnel (avec couleur si applicable)",
      "designation_ar": "ترجمة بالعامية المصرية",
      "quantity": 0,
      "unit": "m²|ml|u|h|forfait",
      "unitPrice": 0,
      "category": "materials|labor|transport|cleaning|waste",
      "linkedSurfaceId": "zone_1"
    }
  ],
  "devisVerification": {
    "chantierType": "type détecté",
    "renovationType": "sous-type",
    "finishColor": "couleur ou null",
    "diagnostic_match": true,
    "forbidden_works_check": true,
    "corrections_applied": []
  },
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
      const systemPrompt = `Tu es un Expert BTP français spécialisé dans l'analyse de chantier et la génération de devis professionnels réalistes.
Tu combines les rôles d'expert bâtiment, conducteur de travaux et économiste de la construction.
Parle en ARABE ÉGYPTIEN RAFFINÉ (عامية مصرية) avec des termes techniques français translittérés.

VOCABULAIRE OBLIGATOIRE:
Peinture=بنتيرة, Enduit=أندوي, Carrelage=كارلاج, Chantier=شانتي, Devis=دوفي, Décapage=ديكاباج, Ponçage=بونساج, Démontage=ديمونتاج, Ragréage=راغرياج, Fourniture=فورنيتير, Main d'œuvre=مصنعية

PROCESSUS D'ANALYSE OBLIGATOIRE:
Observation → Diagnostic → Plan de travaux → Quantités → Durée → Matériaux → Devis

LOGIQUE MÉTIER (RÈGLE ABSOLUE):
Tu DOIS identifier le type exact de rénovation AVANT de répondre.
Il est INTERDIT de mélanger plusieurs types dans un même devis.

Types:
🔵 Piscine peinture → nettoyage → décapage → primaire → peinture piscine
🔵 Piscine liner → dépose liner → pose liner
🔵 Piscine carrelage → réparation support → pose carrelage
🟤 Façade → nettoyage → réparation fissures → peinture façade
🟢 Mur intérieur → préparation → enduit → peinture
🔶 Toiture → nettoyage → remplacement tuiles → traitement hydrofuge

FORMAT DE RAPPORT (9 sections):
1. Identification du chantier (type + sous-type rénovation)
2. Observations (uniquement ce qui est visible)
3. Diagnostic technique
4. Plan de travaux (étapes logiques correspondant au type)
5. Quantités estimées (m², m³, ml)
6. Durée (ouvriers + jours)
7. Matériaux nécessaires
8. Devis détaillé (prix BTP français réalistes)
9. Niveau de confiance

INTERACTION:
- Si l'utilisateur corrige ou modifie → recalculer TOUT le devis
- Toute modification = recalcul complet (diagnostic + plan + quantités + devis)
- INTERDIT d'ignorer une correction ou de garder un ancien devis

INTERDICTION:
⛔ Ignorer une correction utilisateur
⛔ Garder un devis ancien après modification
⛔ Mélanger des travaux incompatibles (ex: peinture piscine + pose liner)
⛔ Inventer des travaux non liés au diagnostic

VÉRIFICATION AUTOMATIQUE avant d'afficher:
✅ Le devis correspond au diagnostic
✅ Les travaux correspondent au type de rénovation
✅ Aucun travail incompatible
✅ Quantités réalistes
✅ Prix cohérents avec le marché BTP français
Si incohérence → corriger automatiquement.

PREMIÈRE QUESTION OBLIGATOIRE (si pas encore répondu):
🔧 "عايز التسعير إزاي؟ مواد + مصنعية (فورنيتير + بوز)، مصنعية بس، ولا جزئي (لكل بند)؟"

QUESTIONS SUIVANTES:
1. Qualité des matériaux: Éco (اقتصادي), Standard (عادي), ou Luxe (فخم)?
2. Remise (%): هل في خصم؟
3. Marge bénéficiaire (%): نسبة الربح المطلوبة؟

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
      const { analysisData, materialQuality, discountPercent, profitMarginPercent, materialScope, conversationHistory } = body;

      const scopeRule = materialScope === 'main_oeuvre_seule'
        ? `\n⛔ RÈGLE SCOPE MATÉRIAUX (CRITIQUE): Le client fournit ses propres matériaux. Chiffre UNIQUEMENT la main d'œuvre (pose, préparation, nettoyage). Les prix ne doivent PAS inclure le coût des matériaux. Utilise "Pose de..." au lieu de "Fourniture et pose de...".`
        : `\nLe devis inclut fourniture ET pose (matériaux + main d'œuvre).`;

      const systemPrompt = `Tu es un CHEF DE CHANTIER expert (Expert BTP français, métreur et économiste de la construction).
Tu analyses les images et discussions avec une précision de professionnel terrain.
À partir de l'analyse fournie, génère les lignes de devis finales selon les standards professionnels du BTP.
${scopeRule}

═══════════════════════════════════════
  RÈGLE NOMBRE DE LIGNES (CRITIQUE)
═══════════════════════════════════════

⛔ MAXIMUM 8 à 10 lignes de devis. Pas plus. JAMAIS plus de 10.
⛔ Consolide les petites tâches similaires en une seule ligne.
⛔ Garde uniquement les tâches ESSENTIELLES et DISTINCTES.
⛔ NE JAMAIS générer de tâches redondantes ou non-essentielles.
⛔ ANTI-DUPLICATION STRICTE: Si l'image montre 'peinture écaillée' ET 'surfaces sales', 
   NE PAS créer deux lignes séparées. Grouper sous 'Ponçage & Nettoyage des surfaces'.
⛔ NE JAMAIS répéter une tâche dans le tableau.

═══════════════════════════════════════
  DICTIONNAIRE ARTISAN BILINGUE (OBLIGATOIRE)
═══════════════════════════════════════

Chaque ligne DOIT avoir une designation_fr professionnelle ET une designation_ar en argot artisan égyptien.
Utilise CE dictionnaire pour le mapping:

- Protection chantier → designation_fr: "Protection du chantier" / designation_ar: "تأمين الموقع وفرش المشمعات"
- Vidange piscine → designation_fr: "Vidange de la piscine" / designation_ar: "تفضية المية وتجهيز الأرضية"
- Nettoyage HP → designation_fr: "Nettoyage Haute Pression" / designation_ar: "غسلة صاروخ بضغط مية عالي"
- Ponçage/Grattage → designation_fr: "Ponçage et Grattage" / designation_ar: "صنفرة ميتة وتفتيح مسام وتلقيط مرمات"
- Primaire → designation_fr: "Application de Primaire" / designation_ar: "وش بريمير (أساس) عشان الدهان يكلبش"
- Peinture 1ère couche → designation_fr: "Peinture Epoxy (1ère couche)" / designation_ar: "أول وش دهان إيبوكسي تقيل"
- Peinture 2ème couche → designation_fr: "Peinture Epoxy (2ème couche)" / designation_ar: "وش النضافة (الوش التاني) والتشطيب"
- Nettoyage final → designation_fr: "Nettoyage final & Remise des clés" / designation_ar: "تسليم الموقع عالمفتاح ونضافة الرواتش"
- Enduit → designation_fr: "Application Enduit de rebouchage" / designation_ar: "أندوي تلقيط وسد الشروخ"
- Sous-couche → designation_fr: "Application Sous-couche" / designation_ar: "سوكوش (وش تحضيري)"
- Peinture murs → designation_fr: "Peinture murale 2 couches" / designation_ar: "وشين بنتيرة حيطان"
- Peinture plafond → designation_fr: "Peinture plafond 2 couches" / designation_ar: "وشين بنتيرة سقف"
- Carrelage → designation_fr: "Pose Carrelage" / designation_ar: "تركيب كارلاج"
- Ragréage → designation_fr: "Ragréage du sol" / designation_ar: "راغرياج (تسوية الأرضية)"
- Démolition → designation_fr: "Démolition et évacuation" / designation_ar: "تكسير وشيل الردم"
- Plomberie → designation_fr: "Travaux de plomberie" / designation_ar: "سباكة وتوصيلات مية"
- Électricité → designation_fr: "Travaux d'électricité" / designation_ar: "كهربا وتوصيلات"
- Frais chantier → designation_fr: "Frais de chantier" / designation_ar: "مصاريف الشانتي"

⛔ RÈGLE: La designation_ar DOIT être en argot artisan égyptien (Ammiya), PAS en arabe littéraire.
⛔ Utilise des translitérations phonétiques: Parquet→باركيه, Primaire→بريمير, Ragréage→راغرياج, 
   Sous-couche→سوكوش, Enduit→أندوي, Peinture→بنتيرة, Carrelage→كارلاج, Ponçage→بونساج,
   Décapage→ديكاباج, Nettoyage→نيتواياج, Chantier→شانتي

═══════════════════════════════════════
  RÈGLE ABSOLUE: LE DEVIS SUIT LE DIAGNOSTIC
═══════════════════════════════════════

Le devis DOIT être basé UNIQUEMENT sur le PLAN DE TRAVAUX ("workPlan_fr" / "workPlan_ar") fourni dans l'analyse.
Tu peux utiliser "chantierType", "renovationType", "finishColor", le diagnostic et les quantités UNIQUEMENT pour qualifier, nommer et quantifier les lignes déjà présentes dans le plan.

⛔ INTERDICTION ABSOLUE: ne JAMAIS ajouter une étape absente du plan de travaux, même si elle est habituelle, logique ou fréquente dans ce type de chantier.
⛔ Chaque ligne du devis doit correspondre à une étape explicitement mentionnée dans le work plan.
⛔ RÈGLE STATELESS: Génère UNIQUEMENT à partir des données d'analyse fournies dans CE message.
⛔ RÈGLE ZERO-HALLUCINATION: Mapping 1:1 strict entre "workPlan_*" et "items".
⛔ RÈGLE ANTI-DOUBLE FACTURATION: "Fourniture et pose" = 1 SEULE ligne.
⛔ RÈGLE CONSOLIDATION FRAIS: Déplacement + nettoyage + évacuation = 1 ligne "Frais de chantier / مصاريف الشانتي" SEULEMENT si ce bloc figure déjà dans le work plan.

═══════════════════════════════════════
  LOGIQUE MÉTIER PAR TYPE DE RÉNOVATION
═══════════════════════════════════════

⛔ Il est INTERDIT de mélanger les catalogues.
⛔ Le type de rénovation de l'analyse DÉTERMINE les seuls codes autorisés.
⛔ Les codes ci-dessous sont AUTORISÉS uniquement si l'étape correspondante est explicitement présente dans le work plan.

🔵 SI chantierType = "piscine" ET rénovation = peinture:
  CODES AUTORISÉS (si l'étape existe dans le plan) — RESPECTER CET ORDRE EXACT:
  1. LOG01/CHA01=protection chantier (TOUJOURS en premier)
  2. PIS05=décapage / grattage ancien revêtement piscine
  3. PSC01=nettoyage haute pression bassin (MAX 15€/m², JAMAIS plus)
  4. PIS12=application primaire d'accrochage piscine
  5. PIS03=résine / peinture piscine 2 couches (INCLURE LA COULEUR DEMANDÉE) — OBLIGATOIRE
  6. CHA02/LOG03=nettoyage fin de chantier (TOUJOURS en dernier)
  
  ⛔ SÉQUENCE OBLIGATOIRE: Protection → Décapage/Préparation → Nettoyage HP → Primaire → Peinture → Nettoyage fin
  ⛔ Si le work_plan mentionne une piscine ou un mur → la ligne de peinture finale est OBLIGATOIRE.
  ⛔ NETTOYAGE HP: Le prix ne doit JAMAIS dépasser 15€/m².
  
  CODES INTERDITS: PEI01-PEI04, FAC01-FAC06, CR001-CR003, TOI01-TOI04
  ⛔ INTERDIT: "peinture murs blanche", "préparation murs", tout poste mur intérieur

🔵 SI chantierType = "piscine" ET rénovation = liner:
  CODES: dépose ancien liner, préparation support, pose liner neuf
  INTERDIT: peinture piscine, carrelage piscine

🔵 SI chantierType = "piscine" ET rénovation = carrelage:
  CODES: réparation support, pose carrelage piscine, joints
  INTERDIT: peinture piscine, pose liner

🟤 SI chantierType = "facade":
  CODES AUTORISÉS: FAC01-FAC06, CHA01, CHA02, CHA04
  CODES INTERDITS: PEI01-PEI04, PIS01-PIS09

🟢 SI chantierType = "peinture" ou "renovation" ou "mur":
  CODES AUTORISÉS: PEI01-PEI04, CHA01, CHA02, CHA04
  CODES INTERDITS: PIS01-PIS09, FAC01-FAC06

🔶 SI chantierType = "toiture":
  CODES AUTORISÉS: TOI01-TOI04, CHA01, CHA02, CHA04
  CODES INTERDITS: PEI01-PEI04, PIS01-PIS09, FAC01-FAC06

🔷 SI chantierType = "carrelage":
  CODES AUTORISÉS: CR001-CR003, CHA01, CHA02, CHA04

═══════════════════════════════════════
  RÈGLES SURFACES PEINTURE
═══════════════════════════════════════

⛔ Surface PLAFOND = surface au sol (longueur × largeur). JAMAIS plus.
⛔ Surface MURS = périmètre × hauteur (SÉPARÉE du plafond).
⛔ NE JAMAIS utiliser la même surface pour murs et plafond.

═══════════════════════════════════════
  RÈGLE COULEUR DE FINITION (CRITIQUE)
═══════════════════════════════════════

⛔ Si l'analyse mentionne une couleur (dans diagnostic, materials, workPlan, finishColor, ou userMessage):
  → TOUJOURS l'inclure dans la designation_fr de la ligne de peinture/revêtement.
  → Exemple: "bleu piscine" → "Peinture piscine bleue – 2 couches"
  → NE JAMAIS mettre "peinture blanche" par défaut si une autre couleur est spécifiée.

═══════════════════════════════════════
  RÈGLE DE RÉGÉNÉRATION COMPLÈTE (CRITIQUE)
═══════════════════════════════════════

⛔ À chaque génération, tu DOIS produire l'INTÉGRALITÉ du devis en incluant :
  1. TOUS les éléments détectés par l'analyse initiale (work_plan complet).
  2. Les nouveaux éléments demandés par l'utilisateur (s'ils figurent dans le work_plan mis à jour).
⛔ NE JAMAIS omettre une ligne présente dans le work_plan, même si tu l'as déjà générée avant.
⛔ NE JAMAIS SUPPRIMER de lignes existantes quand l'utilisateur demande un ajout. Garde TOUTES les lignes précédentes et ajoute les nouvelles.
⛔ RÈGLE PEINTURE SYSTÉMATIQUE : Si le work_plan contient une étape de peinture/finition,
  tu DOIS TOUJOURS inclure la ligne de peinture finale. Pour piscine: PIS03 (résine piscine).
  Pour murs: PNT02 (22€/m²). Ne JAMAIS omettre cette ligne.
⛔ RÈGLE PRIX CATALOGUE: Les prix sont extraits UNIQUEMENT de la base de données 'إعدادات التعريفة'.
  NE JAMAIS inventer de prix. Si un code existe dans le catalogue, son prix est ABSOLU.

═══════════════════════════════════════
  RÈGLE PRIX
═══════════════════════════════════════

⛔ NE JAMAIS inventer de prix. Mets unitPrice = 0 pour TOUTES les lignes.
⛔ MAXIMUM 8 lignes dans le JSON final. Consolide les tâches similaires.
Les prix seront remplis depuis la base de données interne.

⛔ RÈGLE CODE CATALOGUE:
- UNE TÂCHE = UNE LIGNE = UN CODE.
- INTERDIT de scinder un travail en sous-lignes si un code unique existe.

═══════════════════════════════════════
  VÉRIFICATION AUTOMATIQUE (OBLIGATOIRE)
═══════════════════════════════════════

Avant de finaliser, vérifier:
✅ Le chantierType de l'analyse ET que TOUS les codes sont du bon catalogue
✅ Le sous-type de rénovation est respecté (pas de mélange)
✅ Cohérence technique (travaux dans le bon ordre)
✅ Cohérence des quantités (réalistes)
✅ Pas de doublons — MAXIMUM 8 lignes
✅ La couleur de finition est reprise dans la designation_fr
✅ Aucun travail incompatible (ex: "peinture murs" pour un chantier piscine)
✅ Chaque designation_ar est en argot artisan égyptien, PAS en arabe littéraire
Si correction nécessaire → l'appliquer AVANT de générer le JSON.

Réponds UNIQUEMENT en JSON:
{
  "items": [
    {
      "designation_fr": "Titre professionnel (avec couleur si applicable)",
      "designation_ar": "ترجمة بالعامية المصرية (argot artisan)",
      "quantity": 0,
      "unit": "m²|ml|u|h|forfait",
      "unitPrice": 0,
      "code": "CODE catalogue métier"
    }
  ],
  "verification": {
    "chantierType": "type détecté",
    "renovationType": "sous-type de rénovation",
    "catalogueUsed": "piscine|facade|peinture|toiture|carrelage",
    "finishColor": "couleur ou null",
    "diagnostic_match": true,
    "forbidden_works_check": true,
    "incompatible_works_removed": [],
    "corrections_applied": []
  },
  "summary": {}
}`;

      // Build messages with conversation history for user additions
      const aiMessages: any[] = [
        { role: "system", content: systemPrompt },
      ];

      // Include conversation history so the AI knows about user-requested additions
      if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        for (const msg of conversationHistory) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            aiMessages.push({ role: msg.role, content: msg.content });
          }
        }
      }

      aiMessages.push({
        role: "user",
        content: `Données d'analyse:\n${JSON.stringify(analysisData)}\n\nRÈGLE CRITIQUE: Génère le devis final avec 100% de couverture du work_plan.\n- Chaque étape du plan de travaux (workPlan_fr / workPlan_ar) DOIT avoir UNE ligne correspondante dans le devis.\n- Ne saute AUCUNE étape. Si l'analyse mentionne une tâche, elle DOIT apparaître dans le tableau.\n- Analyse = Table. Pas d'exception.\n- Inclus les quantités réalistes basées sur estimatedArea et surfaceEstimates.`
      });

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
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

      const rawItems = Array.isArray(parsed?.items) ? parsed.items : [];
      const { items: lockedItems, removedItems, workPlanSteps } = enforceWorkPlanLock(rawItems, analysisData);
      const existingVerification = parsed?.verification && typeof parsed.verification === "object" ? parsed.verification : {};
      const existingCorrections = Array.isArray(existingVerification.corrections_applied)
        ? existingVerification.corrections_applied
        : [];

      // ═══════════════════════════════════════
      //   ARTISAN PRICE CATALOG LOOKUP (PRIMARY)
      // ═══════════════════════════════════════
      // First try the user's personal catalog (إعدادات التعريفة)
      let artisanPrices: Record<string, { total_price: number; labor_price: number; unit: string }> = {};
      try {
        const authHeader2 = req.headers.get("Authorization");
        if (authHeader2?.startsWith("Bearer ")) {
          const token2 = authHeader2.replace("Bearer ", "");
          const { data: userData } = await supabaseClient.auth.getUser(token2);
          const userId = userData?.user?.id;
          if (userId) {
            const { data: catalogRows, error: catalogError } = await supabaseClient
              .from("artisan_price_catalog")
              .select("code, total_price, labor_price, unit")
              .eq("user_id", userId);
            
            if (!catalogError && catalogRows) {
              for (const row of catalogRows) {
                artisanPrices[row.code.toUpperCase()] = {
                  total_price: Number(row.total_price),
                  labor_price: Number(row.labor_price),
                  unit: row.unit,
                };
              }
            }
          }
        }
      } catch (e) {
        console.warn("Failed to load artisan_price_catalog:", e);
      }

      // ═══════════════════════════════════════
      //   BTP PRICE REFERENCE LOOKUP (FALLBACK)
      // ═══════════════════════════════════════
      let btpPrices: Record<string, { prix_moyen: number; unite: string }> = {};
      try {
        const { data: priceRows, error: priceError } = await supabaseClient
          .from("btp_price_reference")
          .select("travail, unite, prix_moyen");
        
        if (!priceError && priceRows) {
          for (const row of priceRows) {
            btpPrices[row.travail.toLowerCase()] = {
              prix_moyen: Number(row.prix_moyen),
              unite: row.unite,
            };
          }
        }
      } catch (e) {
        console.warn("Failed to load btp_price_reference:", e);
      }

      // Helper: normalize designation to match btp_price_reference keys
      function matchBtpPrice(designationFr: string): { prix_moyen: number; unite: string } | null {
        const normalized = (designationFr || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[''`]/g, "'")
          .trim();

        const underscored = normalized.replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

        const mappings: [RegExp, string][] = [
          [/peinture\s+(des?\s+)?murs?/i, "peinture_murs"],
          [/peinture\s+(du?\s+)?plafond/i, "peinture_plafond"],
          [/peinture\s+(de\s+)?facade/i, "peinture_facade"],
          [/peinture\s+piscine/i, "peinture_piscine"],
          [/peinture\s+bois(erie)?/i, "peinture_boiserie"],
          [/sous[- ]couche/i, "sous_couche"],
          [/primaire\s+(d'?accrochage\s+)?piscine/i, "primaire_piscine"],
          [/primaire\s+(d'?)?accrochage/i, "primaire_accrochage"],
          [/peinture\s+(de\s+)?finition/i, "peinture_finition"],
          [/preparation\s+(des?\s+)?murs?/i, "preparation_murs"],
          [/preparation\s+(du?\s+)?plafond/i, "preparation_plafond"],
          [/preparation\s+(du?\s+)?support/i, "preparation_support"],
          [/enduit\s+rebouchage/i, "enduit_rebouchage"],
          [/enduit\s+lissage/i, "enduit_lissage"],
          [/enduit\s+(de\s+)?facade/i, "enduit_facade"],
          [/poncage\s+(des?\s+)?murs?/i, "poncage_murs"],
          [/poncage\s+parquet/i, "poncage_parquet"],
          [/ragreage/i, "ragreage"],
          [/decapage\s+piscine/i, "decapage_piscine"],
          [/decapage/i, "decapage"],
          [/nettoyage\s+(haute\s+pression|hp)/i, "nettoyage_haute_pression"],
          [/nettoyage\s+facade/i, "nettoyage_facade"],
          [/nettoyage\s+toiture/i, "nettoyage_toiture"],
          [/nettoyage\s+(bassin|piscine)/i, "nettoyage_piscine"],
          [/nettoyage\s+fin/i, "nettoyage_fin_chantier"],
          [/carrelage\s+sol/i, "carrelage_sol"],
          [/carrelage\s+mur/i, "carrelage_mural"],
          [/carrelage\s+piscine/i, "carrelage_piscine"],
          [/carrelage\s+terrasse/i, "carrelage_terrasse"],
          [/faience/i, "faience"],
          [/depose\s+carrelage/i, "depose_carrelage"],
          [/dalle\s+beton/i, "dalle_beton"],
          [/chape\s+beton/i, "chape_beton"],
          [/mur\s+parpaing/i, "mur_parpaing"],
          [/demolition\s+mur/i, "demolition_mur"],
          [/ouverture\s+mur\s+porteur/i, "ouverture_mur_porteur"],
          [/reparation\s+fissure\s+piscine/i, "reparation_fissure_piscine"],
          [/reparation\s+fissure/i, "reparation_fissure"],
          [/reparation\s+des?\s+fissures/i, "reparation_fissures"],
          [/placo|ba13/i, "placo_ba13"],
          [/faux[- ]plafond/i, "faux_plafond"],
          [/bande\s+placo/i, "bande_placo"],
          [/isolation\s+combles/i, "isolation_combles"],
          [/isolation\s+murs/i, "isolation_murs"],
          [/installation\s+wc|toilette/i, "installation_wc"],
          [/lavabo|evier/i, "lavabo"],
          [/douche|baignoire/i, "douche"],
          [/chauffe[- ]eau/i, "chauffe_eau"],
          [/reparation\s+fuite/i, "reparation_fuite"],
          [/prise\s+electrique/i, "prise_electrique"],
          [/interrupteur/i, "interrupteur"],
          [/tableau\s+electrique/i, "tableau_electrique"],
          [/point\s+lumineux|luminaire/i, "point_lumineux"],
          [/spot\s+led/i, "spot_led"],
          [/porte\s+interieure/i, "porte_interieure"],
          [/fenetre\s+pvc/i, "fenetre_pvc"],
          [/volet\s+roulant/i, "volet_roulant"],
          [/pose\s+tuiles/i, "pose_tuiles"],
          [/reparation\s+toiture/i, "reparation_toiture"],
          [/demoussage/i, "demoussage"],
          [/hydrofuge/i, "traitement_hydrofuge"],
          [/gouttiere/i, "gouttiere"],
          [/etancheite\s+terrasse/i, "etancheite_terrasse"],
          [/etancheite\s+toiture/i, "etancheite_toiture"],
          [/etancheite\s+(salle\s+de\s+bain|sdb)/i, "etancheite_sdb"],
          [/parquet\s+flottant/i, "parquet_flottant"],
          [/parquet\s+colle/i, "parquet_colle"],
          [/plinthe/i, "plinthe"],
          [/sol\s+vinyle|sol\s+pvc|lino/i, "sol_vinyle"],
          [/echafaudage/i, "echafaudage"],
          [/protection\s+chantier/i, "protection_chantier"],
          [/evacuation\s+gravats/i, "evacuation_gravats"],
          [/transport\s+materiaux/i, "transport_materiaux"],
          [/frais\s+(de\s+)?chantier/i, "frais_chantier"],
          [/vidange\s+piscine/i, "vidange_piscine"],
          [/sablage\s+piscine/i, "sablage_piscine"],
          [/resine\s+(polyester\s+)?piscine/i, "resine_piscine"],
          [/gelcoat/i, "gelcoat_piscine"],
          [/margelle/i, "margelle"],
          [/radiateur/i, "radiateur"],
          [/climatisation|clim|split/i, "climatisation"],
          [/pompe\s+a?\s+chaleur/i, "pompe_chaleur"],
          [/vmc\s+simple/i, "vmc_simple"],
          [/vmc\s+double/i, "vmc_double"],
          [/nettoyage/i, "nettoyage_fin_chantier"],
        ];

        for (const [pattern, key] of mappings) {
          if (pattern.test(normalized) && btpPrices[key]) {
            return btpPrices[key];
          }
        }

        if (btpPrices[underscored]) return btpPrices[underscored];

        return null;
      }

      // ═══════════════════════════════════════
      //   POOL SEQUENCE ORDER
      // ═══════════════════════════════════════
      const POOL_SEQUENCE_ORDER: Record<string, number> = {
        'LOG01': 1, 'CHA01': 1, 'CHA04': 1,  // Protection first
        'PIS05': 2, 'PREP02': 2,               // Scraping/Preparation
        'PSC01': 3, 'PIS10': 3,                // Cleaning (nettoyage HP)
        'PIS12': 4, 'PIS06': 4, 'PNT01': 4,   // Primer
        'PIS03': 5, 'PIS02': 5, 'PSC02': 5,   // Painting/Finishing
        'PIS09': 5, 'PIS04': 5,               // Étanchéité/carrelage finishing
        'CHA02': 6, 'LOG03': 6,               // Cleanup last
      };

      // ═══════════════════════════════════════
      //   UNIVERSAL CLEANING PRICE CAP (15€/m² MAX)
      // ═══════════════════════════════════════
      const NETTOYAGE_MAX_PRICE = 15; // €/m² absolute maximum for any cleaning item
      
      function isCleaningItem(item: GeneratedQuoteItem): boolean {
        const code = (item.code || "").trim().toUpperCase();
        const desig = (item.designation_fr || "").toLowerCase();
        const desigAr = (item.designation_ar || "");
        // Match by code
        if (['PSC01', 'PIS01', 'PIS10', 'CHA02', 'LOG03'].includes(code)) return true;
        // Match by designation keywords
        if (/nettoyage|cleaning|lavage/i.test(desig)) return true;
        if (/نيتواياج/i.test(desigAr)) return true;
        return false;
      }

      // Apply prices: artisan catalog (by code) → BTP reference (by designation) → not_found
      const pricedItems = lockedItems.map((item) => {
        const itemCode = (item.code || "").trim().toUpperCase();
        const isCleaning = isCleaningItem(item);
        
        // 1. Try artisan personal catalog by code (PRIMARY SOURCE)
        if (itemCode && artisanPrices[itemCode]) {
          let price = materialScope === 'main_oeuvre_seule'
            ? artisanPrices[itemCode].labor_price
            : artisanPrices[itemCode].total_price;
          
          // Cap ALL cleaning items at 15€/m²
          if (isCleaning && price > NETTOYAGE_MAX_PRICE) {
            price = NETTOYAGE_MAX_PRICE;
          }
          
          return {
            ...item,
            unitPrice: price,
            unit: item.unit || artisanPrices[itemCode].unit,
            btpPriceSource: "artisan_catalog",
          };
        }

        // 2. Fallback: BTP reference by designation
        const btpMatch = matchBtpPrice(item.designation_fr || "");
        if (btpMatch) {
          let price = btpMatch.prix_moyen;
          
          // Cap ALL cleaning items at 15€/m²
          if (isCleaning && price > NETTOYAGE_MAX_PRICE) {
            price = NETTOYAGE_MAX_PRICE;
          }
          
          return {
            ...item,
            unitPrice: price,
            btpPriceSource: "btp_price_reference",
          };
        }

        // 3. No match → mark as "prix à vérifier"
        return {
          ...item,
          unitPrice: -1,
          btpPriceSource: "not_found",
        };
      });

      // Sort pool items by sequence if chantierType is piscine
      const chantierType = analysisData?.chantierType || "";
      let sortedItems = pricedItems;
      if (chantierType === "piscine") {
        sortedItems = [...pricedItems].sort((a, b) => {
          const codeA = (a.code || "").trim().toUpperCase();
          const codeB = (b.code || "").trim().toUpperCase();
          const orderA = POOL_SEQUENCE_ORDER[codeA] ?? 3; // default middle
          const orderB = POOL_SEQUENCE_ORDER[codeB] ?? 3;
          return orderA - orderB;
        });
      }

      parsed = {
        ...parsed,
        items: sortedItems,
        verification: {
          ...existingVerification,
          work_plan_lock: true,
          work_plan_steps_count: workPlanSteps.length,
          generated_items_before_lock: rawItems.length,
          generated_items_after_lock: sortedItems.length,
          artisan_prices_matched: sortedItems.filter((i: any) => i.btpPriceSource === "artisan_catalog").length,
          btp_prices_matched: sortedItems.filter((i: any) => i.btpPriceSource === "btp_price_reference").length,
          btp_prices_missing: sortedItems.filter((i: any) => i.btpPriceSource === "not_found").length,
          price_source_priority: "artisan_catalog → btp_price_reference → not_found",
          pool_sequence_applied: chantierType === "piscine",
          forbidden_works_check: removedItems.length === 0,
          incompatible_works_removed: removedItems.map((item) => item.designation_fr || item.designation_ar || item.code || "unknown"),
          corrections_applied: removedItems.length > 0
            ? [...existingCorrections, "Filtrage strict appliqué: seules les lignes correspondant au work_plan ont été conservées."]
            : existingCorrections,
        },
      };

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
