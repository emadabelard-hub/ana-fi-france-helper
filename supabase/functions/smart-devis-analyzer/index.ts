import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Arabic construction term dictionary (Egyptian Ammiya / عامية مصرية)
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

function extractOrderedWorkPlanSteps(rawWorkPlan: string): string[] {
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

function extractWorkPlanSteps(analysisData: any): string[] {
  const rawWorkPlan = typeof analysisData?.workPlan_fr === "string" && analysisData.workPlan_fr.trim().length > 0
    ? analysisData.workPlan_fr
    : (typeof analysisData?.workPlan_ar === "string" ? analysisData.workPlan_ar : "");

  return extractOrderedWorkPlanSteps(rawWorkPlan);
}

function extractWorkPlanArabicSteps(analysisData: any): string[] {
  const rawWorkPlanAr = typeof analysisData?.workPlan_ar === "string" ? analysisData.workPlan_ar : "";
  return extractOrderedWorkPlanSteps(rawWorkPlanAr);
}

const ARABIC_DESIGNATION_FALLBACKS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /protection.*chantier|protection du chantier/i, value: "تأمين الموقع وفرش المشمعات" },
  { pattern: /vidange/i, value: "تفضية المية وتجهيز الأرضية" },
  { pattern: /nettoyage.*haute.*pression|nettoyage.*hp|lavage/i, value: "غسلة صاروخ بضغط مية عالي" },
  { pattern: /fissures?|points faibles|rebouchage/i, value: "تلقيط الشروخ ومعالجة المناطق الضعيفة" },
  { pattern: /pon[çc]age|grattage|d[ée]capage/i, value: "صنفرة ميتة وتفتيح مسام وتلقيط مرمات" },
  { pattern: /primaire/i, value: "وش بريمير (أساس) عشان الدهان يكلبش" },
  { pattern: /sous[\s-]?couche/i, value: "سوكوش (وش تحضيري)" },
  { pattern: /enduit/i, value: "أندوي تلقيط وسد الشروخ" },
  { pattern: /peinture.*plafond/i, value: "وشين بنتيرة سقف" },
  { pattern: /peinture.*mur|murale/i, value: "وشين بنتيرة حيطان" },
  { pattern: /peinture.*epoxy/i, value: "وش دهان إيبوكسي وتشطيب" },
  { pattern: /peinture/i, value: "وش دهان وتشطيب" },
  { pattern: /pose.*fa[iï]ence|fa[iï]ence/i, value: "تركيب فايونس الحيطان" },
  { pattern: /carrelage.*sol/i, value: "تركيب كارلاج الأرضية" },
  { pattern: /carrelage/i, value: "تركيب كارلاج" },
  { pattern: /[ée]tanch[ée]it[ée]/i, value: "عزل مية (إيطونشيتي)" },
  { pattern: /plomberie|sanitaires?/i, value: "سباكة وتركيب الأطقم" },
  { pattern: /[ée]lectricit[ée]/i, value: "كهربا وتوصيلات" },
  { pattern: /nettoyage final|remise des cl[ée]s/i, value: "تسليم الموقع عالمفتاح ونضافة الرواتش" },
  { pattern: /frais de chantier/i, value: "مصاريف الشانتي" },
];

function isMissingArabicDesignation(value?: string): boolean {
  const normalized = typeof value === "string" ? value.trim() : "";
  return !normalized || [
    "الوصف بالعامية",
    "وصف بالعامية",
    "ترجمة بالعامية المصرية",
    "ترجمة بالعامية المصرية (argot artisan)",
  ].includes(normalized);
}

function getFallbackArabicDesignation(stepFr: string, stepAr?: string): string {
  const explicitArabic = typeof stepAr === "string" ? stepAr.trim() : "";
  if (explicitArabic) return explicitArabic;

  const sourceFr = typeof stepFr === "string" ? stepFr.trim() : "";
  if (!sourceFr) return "";

  const match = ARABIC_DESIGNATION_FALLBACKS.find(({ pattern }) => pattern.test(sourceFr));
  return match?.value ?? "";
}

function getItemPlanningText(item: GeneratedQuoteItem): string {
  return [item.designation_fr, item.designation_ar].filter(Boolean).join(" ");
}

type LiteralSuggestedItem = {
  designation_fr: string;
  designation_ar: string;
  quantity?: number;
  unit?: string;
  code?: string;
  category?: string;
};

function parseLiteralQuantity(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim().replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function getLiteralSuggestedItems(analysisData: any): LiteralSuggestedItem[] {
  const source = Array.isArray(analysisData?.suggestedItems) ? analysisData.suggestedItems : [];
  return source
    .map((item: any) => ({
      designation_fr: typeof item?.designation_fr === "string" ? item.designation_fr.trim() : "",
      designation_ar: typeof item?.designation_ar === "string" ? item.designation_ar.trim() : "",
      quantity: parseLiteralQuantity(item?.quantity),
      unit: typeof item?.unit === "string" ? item.unit.trim() : "",
      code: typeof item?.code === "string" ? item.code.trim() : "",
      category: typeof item?.category === "string" ? item.category.trim() : "",
    }))
    .filter((item) => item.designation_fr || item.designation_ar);
}

function buildLiteralSuggestedItem(literalItem: LiteralSuggestedItem): GeneratedQuoteItem {
  const designationFr = literalItem.designation_fr || "";
  const literalArabic = literalItem.designation_ar || "";

  return {
    designation_fr: designationFr,
    designation_ar: !isMissingArabicDesignation(literalArabic)
      ? literalArabic
      : getFallbackArabicDesignation(designationFr, literalArabic),
    quantity: literalItem.quantity ?? 1,
    unit: literalItem.unit || "Ens",
    unitPrice: 0,
    code: literalItem.code || "",
    category: literalItem.category || "labor",
  };
}

function applyLiteralSuggestedItem(item: GeneratedQuoteItem, literalItem?: LiteralSuggestedItem): GeneratedQuoteItem {
  const literalFr = typeof literalItem?.designation_fr === "string" ? literalItem.designation_fr.trim() : "";
  const literalArabic = typeof literalItem?.designation_ar === "string" ? literalItem.designation_ar.trim() : "";
  const existingArabic = typeof item.designation_ar === "string" ? item.designation_ar.trim() : "";
  const resolvedFr = literalFr || (typeof item.designation_fr === "string" ? item.designation_fr.trim() : "");

  return {
    ...item,
    designation_fr: resolvedFr,
    designation_ar: !isMissingArabicDesignation(literalArabic)
      ? literalArabic
      : (!isMissingArabicDesignation(existingArabic)
        ? existingArabic
        : getFallbackArabicDesignation(resolvedFr, literalArabic)),
    quantity: literalItem?.quantity ?? item.quantity ?? 1,
    unit: literalItem?.unit || item.unit || "Ens",
    code: (typeof item.code === "string" && item.code.trim()) ? item.code.trim() : (literalItem?.code || ""),
    category: (typeof item.category === "string" && item.category.trim()) ? item.category.trim() : (literalItem?.category || "labor"),
  };
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
  const workPlanArabicSteps = extractWorkPlanArabicSteps(analysisData);
  const literalSuggestedItems = getLiteralSuggestedItems(analysisData);
  const literalSteps = literalSuggestedItems.map((item) => item.designation_fr || item.designation_ar).filter(Boolean);

  if ((!Array.isArray(items) || items.length === 0) && literalSuggestedItems.length > 0) {
    return { items: literalSuggestedItems.map(buildLiteralSuggestedItem), removedItems: [], workPlanSteps: literalSteps };
  }

  if (!Array.isArray(items) || items.length === 0) {
    const placeholders = workPlanSteps.map((step, index) => buildLiteralSuggestedItem({
      designation_fr: step,
      designation_ar: workPlanArabicSteps[index] || "",
      quantity: 1,
      unit: "Ens",
      code: "",
      category: "labor",
    }));
    return { items: placeholders, removedItems: [], workPlanSteps };
  }

  if (workPlanSteps.length === 0) {
    return literalSuggestedItems.length > 0
      ? { items: literalSuggestedItems.map(buildLiteralSuggestedItem), removedItems: [], workPlanSteps: literalSteps }
      : { items, removedItems: [], workPlanSteps };
  }

  const remaining = items.map((item) => ({ item }));
  const keptItems: GeneratedQuoteItem[] = [];
  const matchedStepIndices = new Set<number>();

  for (let si = 0; si < workPlanSteps.length; si++) {
    const step = workPlanSteps[si];
    const literalItem = literalSuggestedItems[si];
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
      keptItems.push(applyLiteralSuggestedItem({
        ...match.item,
        designation_ar: isMissingArabicDesignation(match.item.designation_ar)
          ? getFallbackArabicDesignation(match.item.designation_fr || step, workPlanArabicSteps[si] || literalItem?.designation_ar)
          : (typeof match.item.designation_ar === "string" ? match.item.designation_ar.trim() : ""),
      }, literalItem));
      matchedStepIndices.add(si);
    }
  }

  for (let si = 0; si < workPlanSteps.length; si++) {
    if (!matchedStepIndices.has(si)) {
      const step = workPlanSteps[si];
      keptItems.push(applyLiteralSuggestedItem({
        designation_fr: step,
        designation_ar: getFallbackArabicDesignation(step, workPlanArabicSteps[si]),
        quantity: 1,
        unit: "Ens",
        unitPrice: 0,
        code: "",
        category: "labor",
      }, literalSuggestedItems[si]));
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
      try {
        const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
        if (userError || !userData?.user) {
          console.warn("Invalid auth token, continuing as public call");
        }
      } catch (authErr) {
        console.warn("Auth check failed, continuing as public call:", authErr);
      }
    }

    const body = await req.json();
    const { action, imageData, mimeType, conversationHistory, userMessage, preferences, qualityTier, projectType } = body;
    const tier = qualityTier || 'standard';
    const pType = projectType || 'direct';
    const tierLabels: Record<string, string> = {
      standard: 'GAMME STANDARD — matériaux économiques, entrée de gamme, finitions basiques',
      pro: 'GAMME PRO — matériaux de qualité professionnelle, marques reconnues, finitions soignées (+15-25%)',
      luxury: 'GAMME LUXURY — matériaux haut de gamme, finitions luxueuses, marques premium (+40-60%)',
    };
    const tierInstruction = `\n\n🎯 GAMME DE QUALITÉ: ${tierLabels[tier]}. Adapte tes recommandations de matériaux et tes descriptions à cette gamme.`;
    const projectTypeInstruction = pType === 'sous_traitance'
      ? `\n\n🏗️ TYPE DE PROJET: SOUS-TRAITANCE. Logique: Main d'œuvre seule. Le prix cible = 45-50% du tarif Client Direct. Protection et Nettoyage = masqués ou à 0.00€. Regrouper les étapes techniques en UNE ligne "Main d'œuvre : [Métier] - Pose Seule".`
      : `\n\n🏗️ TYPE DE PROJET: CLIENT DIRECT. Logique: Prix plein (Matériel + Main d'œuvre + Marge 15%). Format "Pack Fourniture & Pose". AUCUN prix à 0€. Barèmes: Électricité ~300€/point, Peinture ~45€/m², Placo ~125€/m², Parquet ~110€/m².`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI service not configured");

    // Action: analyze_image - Vision analysis of photo/blueprint/document
    if (action === "analyze_image") {
      const { files } = body;

      const systemPrompt = `Tu es شبيك لبيك, l'expert qui représente l'Artisan (المعلم). Tu es propre, extrêmement professionnel et tu possèdes une expertise terrain indiscutable. Ton objectif est de conseiller l'artisan pour que ses devis soient techniquement parfaits et rentables.
${tierInstruction}
${projectTypeInstruction}

⛔ RÈGLE CRITIQUE — MARCHÉ FRANÇAIS UNIQUEMENT:
- Tous les prix, tarifs et références de coûts sont EXCLUSIVEMENT basés sur le marché BTP FRANÇAIS (France métropolitaine, 2024-2025).
- Tu parles en dialecte égyptien (عامية مصرية) pour la LANGUE uniquement, mais les PRIX sont ceux du marché FRANÇAIS, JAMAIS du marché égyptien.
- Ne JAMAIS mentionner "السوق المصري" ou "marché égyptien" dans tes réponses. Dis toujours "السوق الفرنسي" / "marché français".

LANGUE:
- Si l'utilisateur écrit en français → répondre en français professionnel.
- Si l'utilisateur écrit en arabe → expliquer en arabe (dialecte égyptien simple) tout en gardant les termes techniques du BTP en français.

🧠 ANALYSE TECHNIQUE & DIAGNOSTIC:
- Ne te limite pas à la demande du client. Si les photos révèlent un problème sous-jacent (humidité, fissures, salpêtre), tu IMPOSES les travaux correctifs nécessaires. La qualité de l'exécution prime sur tout.
- Structure TOUJOURS les travaux selon le phasage métier logique:
  1. Préparation: Protection, nettoyage et mise à nu des supports.
  2. Traitement: Consolidation et assainissement (anti-salpêtre, rebouchage, ragréage).
  3. Finition: Mise en peinture et finitions soignées.

💰 INTELLIGENCE DES PRIX:
- Évalue la complexité réelle (accès, hauteur, état de dégradation) et ajuste les tarifs.
- RÈGLE PETITES SURFACES: Pour tout chantier de moins de 10 m², applique systématiquement une tarification au forfait ou un prix unitaire plus élevé pour couvrir les frais fixes.

✍️ STYLE DE RÉDACTION PROFESSIONNEL:
- Vocabulaire Noble: Utilise les termes techniques précis du bâtiment (ex: "Ratissage", "Impression hydrofuge", "Dégrossissage").
- Libellé Direct: Va droit au but dans la description des tâches pour que le devis soit clair, pro et facile à lire pour le client final.

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

1️⃣5️⃣ LISTE FINALE DES TRAVAUX (OBLIGATOIRE)
- À la fin de l'analyse, affiche une liste finale numérotée: 1, 2, 3...
- Un seul travail par ligne. Interdiction de regrouper plusieurs tâches.
- Chaque ligne doit reprendre exactement un travail du plan.
- Chaque ligne doit contenir le français technique, puis l'arabe égyptien, puis la quantité, puis l'unité correspondante.
- La quantité est OBLIGATOIRE pour CHAQUE ligne, même pour Ens / U / j.
- Les quantités mesurables doivent rester exactes dans suggestedItems et ne jamais être converties, simplifiées ou recalculées.

═══════════════════════════════════════
  VÉRIFICATION AUTOMATIQUE (OBLIGATOIRE)
═══════════════════════════════════════

Avant d'afficher le résultat, vérifier que:
✅ Le devis correspond EXACTEMENT au diagnostic
✅ Les travaux correspondent au type de rénovation identifié
✅ Aucun travail incompatible n'est présent
✅ Les quantités sont réalistes
✅ La liste finale des travaux est affichée en format numéroté 1, 2, 3...
✅ Chaque item de suggestedItems correspond à UNE ligne future du devis
Si une incohérence est détectée → corriger automatiquement.

═══════════════════════════════════════
  RÈGLES STRICTES
═══════════════════════════════════════

⛔ RÈGLE STATELESS: Chaque analyse est INDÉPENDANTE. Ignore tout contexte antérieur.
⛔ RÈGLE ZERO-HALLUCINATION: NE JAMAIS inventer de travaux non demandés. Mapping 1:1 obligatoire.
⛔ RÈGLE ANTI-DOUBLE FACTURATION: "Fourniture et pose" = 1 SEULE ligne.
⛔ RÈGLE CONSOLIDATION FRAIS: Regroupe déplacement + nettoyage + évacuation en UNE ligne "Frais de chantier" seulement si ce poste existe réellement.
⛔ RÈGLE PRIX: NE JAMAIS inventer de prix. unitPrice doit toujours être 0.
⛔ RÈGLE PRÉSENTATION: La liste finale des travaux doit être visible à la fin de l'analyse, numérotée, un travail par ligne.

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
      "unit": "m²|ml|U|h|Ens|j",
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
                image_url: { url: file.data.startsWith("data:") ? file.data : "data:" + (file.mimeType || "image/jpeg") + ";base64," + file.data }
              });
            }
            // PDFs: use pre-extracted text (much faster than sending raw base64)
            if (file.type === 'pdf') {
              if (file.extractedText) {
                contentParts.push({
                  type: "text",
                  text: "\n--- Contenu du document PDF " + file.name + " ---\n" + file.extractedText + "\n--- Fin du document ---\n"
                });
              } else if (file.data) {
                // Legacy fallback: send as image_url
                contentParts.push({
                  type: "image_url",
                  image_url: { url: file.data.startsWith("data:") ? file.data : "data:" + (file.mimeType || "application/pdf") + ";base64," + file.data }
                });
              }
            }
          }
        } else if (hasLegacyImage) {
          contentParts.push({
            type: "image_url",
            image_url: { url: imageData.startsWith("data:") ? imageData : "data:" + (mimeType || "image/jpeg") + ";base64," + imageData }
          });
        }

        messages.push({ role: "user", content: contentParts });
      } else {
        messages.push({ role: "user", content: userMessage || "Analyse ce document." });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + LOVABLE_API_KEY,
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
        throw new Error("AI error: " + status);
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
      const systemPrompt = `أنت شبيك لبيك — الخبير اللي بيمثل المعلم (l'Artisan). أنت نضيف، محترف جداً وعندك خبرة ميدانية ما حدش يقدر يشكك فيها. هدفك إنك تنصح المعلم عشان دوفيهاته تبقى تحفة تقنياً ومربحة.
${tierInstruction}
${projectTypeInstruction}

  اللغة: عامية مصرية فقط ⛔ مش مغربي
  الأسعار: السوق الفرنسي فقط ⛔ مش مصري
═══════════════════════════════════════

اتكلم بالعامية المصرية الصريحة مع مصطلحات فرنسية تقنية.
⛔ ممنوع: دارجة مغربية أو عربي فصحى. مصري بس.
⛔ الأسعار والتكاليف كلها حسب السوق الفرنسي (فرنسا). ممنوع تذكر "السوق المصري" خالص. قول دايماً "السوق الفرنسي" أو "le marché français".

VOCABULAIRE OBLIGATOIRE (translittération):
Peinture=بنتيرة, Enduit=أندوي, Carrelage=كارلاج, Chantier=شانتي, Devis=دوفي, Décapage=ديكاباج, Ponçage=بونساج, Démontage=ديمونتاج, Ragréage=راغرياج, Fourniture=فورنيتير, Main d'œuvre=مصنعية, Forfait=فورفيه, Ratissage=راتيساج, Impression hydrofuge=أمبريسيون إيدروفيج, Dégrossissage=ديغروسيساج

🧠 التحليل الفني والتشخيص:
- ما تقفش عند طلب الزبون وبس. لو الصور كاشفة مشاكل تحتية (رطوبة، شروخ، سلبتر)، فرض الأشغال التصحيحية اللازمة. جودة التنفيذ فوق كل حاجة.
- رتب الشغل دايماً حسب الترتيب المنطقي للمهنة:
  1. التحضير: حماية، تنظيف وتعرية الدعامات.
  2. المعالجة: تقوية وتطهير (مضاد سلبتر، سد، راغرياج).
  3. التشطيب: دهان وتشطيبات أنيقة.

💰 ذكاء الأسعار:
- قيّم التعقيد الحقيقي (وصول، ارتفاع، حالة التدهور) وعدّل الأسعار على أساسه.
- قاعدة المساحات الصغيرة: أي شانتي أقل من 10 م² → تسعير فورفيه أو سعر وحدة أعلى عشان تغطي المصاريف الثابتة.

✍️ أسلوب الكتابة الاحترافي:
- استخدم المصطلحات التقنية الدقيقة للبناء: "Ratissage" (راتيساج)، "Impression hydrofuge" (أمبريسيون إيدروفيج)، "Dégrossissage" (ديغروسيساج).
- روح على طول في الموضوع في وصف المهام عشان الدوفي يبقى واضح ومحترف.

═══════════════════════════════════════
  عملية التحليل الإلزامية
═══════════════════════════════════════

Observation → Diagnostic → Plan de travaux → Quantités → Durée → Matériaux

LOGIQUE MÉTIER (RÈGLE ABSOLUE):
لازم تحدد نوع التجديد بالظبط قبل ما ترد.
ممنوع تخلط أنواع مختلفة في دوفي واحد.

أنواع الشغل:
🔵 بيسين بنتيرة → نيتواياج → ديكاباج → بريمير → بنتيرة بيسين
🔵 بيسين لينير → شيل اللينير القديم → تركيب لينير جديد
🟤 فاصاد → نيتواياج → إصلاح شروخ → بنتيرة فاصاد
🟢 حوائط داخلية → تجهيز → أندوي → بنتيرة
🔶 سقف → نيتواياج → تغيير القرميد → معالجة

FORMAT DE RAPPORT:
1. نوع الشانتي (type + sous-type)
2. الملاحظات (اللي باين بس)
3. التشخيص الفني
4. خطة الشغل (الخطوات بالترتيب)
5. الكميات المقدرة (m², m³, ml)
6. المدة (عمال + أيام)
7. المواد المطلوبة
8. مستوى الثقة

═══════════════════════════════════════
  قائمة الأعمال في نهاية التحليل (إلزامي)
═══════════════════════════════════════

⛔ في نهاية كل تحليل، لازم تعرض قائمة الأعمال بالشكل ده:

📋 **قائمة الأعمال المحددة / Liste des travaux:**

كل شغلانة في سطر منفصل بالفرنساوي والعربي مع الكمية والوحدة:

- **Protection du chantier** (تأمين الموقع وفرش المشمعات) → 1 Ens
- **Nettoyage Haute Pression** (غسلة صاروخ بضغط مية عالي) → 146 m²
- **Ponçage et Grattage** (صنفرة ميتة وتفتيح مسام) → 146 m²
- **Application Primaire** (وش بريمير عشان الدهان يكلبش) → 146 m²
- **Peinture 2 couches** (وشين بنتيرة) → 146 m²
- **Nettoyage final** (نضافة نهائية وتسليم) → 1 Ens

⛔ كل سطر لازم يبين الكمية + الوحدة: m² أو h (ساعة) أو U (وحدة) أو Ens (مجموعة) أو j (يوم شغل) حسب السوق الفرنسي
⛔ ممنوع سطر بالعربي من غير الفرنساوي فوقيه
⛔ ممنوع تجمع شغلانتين في سطر واحد
⛔ الأسعار هيحددها شبيك لبيك لما المستخدم يدوس على زر ✨

═══════════════════════════════════════
  التفاعل مع المستخدم
═══════════════════════════════════════

- لو المستخدم عدّل حاجة → أعد حساب كل حاجة من الأول
- كل تعديل = إعادة حساب كاملة
- ممنوع تتجاهل تعديل المستخدم

⛔ ممنوع:
- تتجاهل تعديل المستخدم
- تخلي دوفي قديم بعد تعديل
- تخلط شغلانات مش متوافقة
- تخترع شغل مش مطلوب

لما تخلص التحليل وتعرض قائمة الأعمال، قول:
"✅ التحليل خلص! دوس على زر 'إنشاء الدوفي' عشان القائمة دي تتحول لجدول الدوفي. والأسعار هيجيبها شبيك لبيك  لما تدوس على ✨"`;


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
          Authorization: "Bearer " + LOVABLE_API_KEY,
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
        throw new Error("AI error: " + status);
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Action: generate_items - Final generation with preferences applied
    if (action === "generate_items") {
      const { analysisData, materialQuality, discountPercent, profitMarginPercent, materialScope, conversationHistory } = body;
      const literalSuggestedItems = getLiteralSuggestedItems(analysisData);

      // ═══════════════════════════════════════
      //   FAST PATH: literal suggestedItems exist → apply pricing guardrails directly
      //   NO LONGER bypasses pricing — شبيك لبيك prices everything inline
      // ═══════════════════════════════════════
      if (literalSuggestedItems.length > 0) {
        const passthroughItems = literalSuggestedItems.map((literalItem) => ({
          ...buildLiteralSuggestedItem(literalItem),
          code: literalItem.code || "",
          category: literalItem.category || "labor",
          unitPrice: 0, // Will be overridden by guardrails below
          btpPriceSource: "literal_suggested_items",
        }));

        // ── Apply the SAME pricing guardrails as the AI path ──
        // (Moved inline pricing logic to a shared section below)
        // We skip the AI call but still apply guardrails
        const lockedItems = passthroughItems;
        const isSousTraitance = pType === 'sous_traitance';

        // ── PRICING GUARDRAILS (shared) ──
        const PRICING_RULES_FAST: Array<{
          keywords: string[];
          stackGroup?: string;
          isPrep: boolean;
          isLogistic: boolean;
          direct: [number, number];
          sousTrait: [number, number];
        }> = [
          // === PEINTURE (bundled ~45€/m² Direct) ===
          { keywords: ["peinture mur", "peinture murs", "peinture acrylique", "peinture 2 couches", "murale", "prestation complete", "prestation complète"], stackGroup: "peinture_murs", isPrep: false, isLogistic: false, direct: [35, 55], sousTrait: [14, 22] },
          { keywords: ["plafond", "plafonds", "peinture plafond"], stackGroup: "peinture_plafonds", isPrep: false, isLogistic: false, direct: [38, 58], sousTrait: [16, 24] },
          { keywords: ["sous-couche", "sous couche", "impression", "primaire", "بريمير", "سوكوش"], stackGroup: "peinture_murs", isPrep: true, isLogistic: false, direct: [6, 12], sousTrait: [3, 6] },
          { keywords: ["poncage", "ponçage", "decapage", "décapage", "بونساج", "ديكاباج"], stackGroup: "peinture_murs", isPrep: true, isLogistic: false, direct: [5, 12], sousTrait: [3, 7] },
          { keywords: ["ratissage", "enduit", "rebouchage", "lissage", "أندوي"], stackGroup: "peinture_murs", isPrep: true, isLogistic: false, direct: [12, 22], sousTrait: [6, 12] },
          { keywords: ["boiserie", "huisserie", "porte", "fenetre", "fenêtre", "volet", "plinthe"], isPrep: false, isLogistic: false, direct: [18, 32], sousTrait: [8, 15] },
          { keywords: ["hydrofuge", "humidité", "salpetre", "salpêtre"], isPrep: false, isLogistic: false, direct: [8, 16], sousTrait: [4, 9] },
          // === CARRELAGE ===
          { keywords: ["carrelage sol", "sol carrelage", "carrelage", "gres", "grès", "كارلاج"], stackGroup: "carrelage_sol", isPrep: false, isLogistic: false, direct: [55, 85], sousTrait: [22, 38] },
          { keywords: ["faience", "faïence", "carrelage mural", "فايونس"], stackGroup: "faience", isPrep: false, isLogistic: false, direct: [60, 90], sousTrait: [25, 45] },
          { keywords: ["ragreage", "ragréage", "chape", "nivellement", "راغرياج"], stackGroup: "carrelage_sol", isPrep: true, isLogistic: false, direct: [10, 30], sousTrait: [6, 18] },
          { keywords: ["joint", "joints", "jointement"], stackGroup: "carrelage_sol", isPrep: true, isLogistic: false, direct: [4, 10], sousTrait: [3, 6] },
          { keywords: ["depose", "dépose", "demolition", "démolition", "piquage", "تكسير"], isPrep: true, isLogistic: false, direct: [12, 40], sousTrait: [8, 25] },
          // === PLOMBERIE / SANITAIRE ===
          { keywords: ["wc", "toilette", "lavabo", "vasque", "evier", "douche", "baignoire", "sanitaire", "سباكة"], stackGroup: "sanitaire", isPrep: false, isLogistic: false, direct: [150, 650], sousTrait: [60, 200] },
          { keywords: ["tuyau", "tuyauterie", "raccord", "alimentation", "evacuation eau"], stackGroup: "sanitaire", isPrep: true, isLogistic: false, direct: [15, 80], sousTrait: [8, 40] },
          // === ÉLECTRICITÉ (~300€/point Direct) ===
          { keywords: ["prise", "interrupteur", "point lumineux", "spot", "luminaire", "كهربا", "electricite", "électricité", "point electrique", "point électrique"], stackGroup: "elec_point", isPrep: false, isLogistic: false, direct: [220, 380], sousTrait: [100, 180] },
          { keywords: ["tableau electrique", "tableau électrique", "disjoncteur"], isPrep: false, isLogistic: false, direct: [350, 1800], sousTrait: [150, 700] },
          { keywords: ["cable", "câble", "cablage", "câblage", "saignee", "saignée", "goulotte"], stackGroup: "elec_point", isPrep: true, isLogistic: false, direct: [8, 30], sousTrait: [4, 15] },
          // === PLACO (~125€/m² Direct) ===
          { keywords: ["placo", "placoplatre", "cloison", "ba13", "doublage"], isPrep: false, isLogistic: false, direct: [95, 155], sousTrait: [40, 70] },
          { keywords: ["faux plafond", "faux-plafond", "plafond suspendu"], isPrep: false, isLogistic: false, direct: [80, 140], sousTrait: [35, 60] },
          // === PARQUET (~110€/m² Direct) ===
          { keywords: ["parquet", "باركيه", "parquet contrecolle", "parquet contrecollé", "parquet flottant", "parquet massif"], isPrep: false, isLogistic: false, direct: [85, 140], sousTrait: [30, 50] },
          // === LOGISTIQUE ===
          { keywords: ["protection chantier", "protection", "bache", "bâche", "تأمين الموقع"], isPrep: false, isLogistic: true, direct: [3, 8], sousTrait: [0, 0] },
          { keywords: ["nettoyage", "evacuation", "évacuation", "gravats", "نيتواياج", "نضافة"], isPrep: false, isLogistic: true, direct: [3, 50], sousTrait: [0, 0] },
          // === PISCINE ===
          { keywords: ["peinture piscine", "résine piscine", "epoxy piscine", "إيبوكسي"], isPrep: false, isLogistic: false, direct: [20, 45], sousTrait: [10, 25] },
          { keywords: ["nettoyage haute pression", "nettoyage hp", "غسلة صاروخ"], isPrep: false, isLogistic: false, direct: [5, 15], sousTrait: [3, 10] },
        ];

        const QUALITY_PROFILES_FAST: Record<string, { materialFactor: number; targetRatio: number }> = {
          standard: { materialFactor: 1.0, targetRatio: 0.35 },
          pro: { materialFactor: 1.15, targetRatio: 0.45 },
          luxury: { materialFactor: 1.35, targetRatio: 0.55 },
        };

        function normFast(v: string): string { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
        function incAnyFast(text: string, kws: string[]): boolean { return kws.some(kw => text.includes(normFast(kw))); }
        function detectRuleFast(item: any): any {
          const text = normFast(`${item.designation_fr || ''} ${item.designation_ar || ''}`);
          for (const rule of PRICING_RULES_FAST) { if (incAnyFast(text, rule.keywords)) return rule; }
          return null;
        }
        function getVolFast(q: number): number {
          if (q >= 200) return 0.85; if (q >= 100) return 0.90; if (q >= 50) return 0.95;
          if (q > 0 && q < 10) return 1.18; if (q >= 10 && q < 20) return 1.10; return 1.0;
        }
        function getDiffFast(item: any): number {
          const text = normFast(`${item.designation_fr || ''} ${item.designation_ar || ''}`);
          let f = 1.0;
          if (incAnyFast(text, ["hauteur", "echafaudage", "échafaudage", "escalier"])) f += 0.10;
          if (incAnyFast(text, ["etroit", "étroit", "difficile", "acces", "accès"])) f += 0.08;
          if (incAnyFast(text, ["humidite", "humidité", "salpetre", "salpêtre", "fissure"])) f += 0.05;
          return Math.min(f, 1.30);
        }
        function getFloorFast(unit: string, isST: boolean): number {
          const u = (unit || '').toLowerCase();
          if (u === "m²" || u === "m2") return isST ? 3 : 8;
          if (u === "ml") return isST ? 4 : 10;
          if (u === "u") return isST ? 20 : 50;
          if (u === "j") return isST ? 180 : 280;
          if (u === "ens") return isST ? 30 : 80;
          return 3;
        }
        function fallbackBandFast(unit: string, isST: boolean): [number, number] {
          const u = (unit || '').toLowerCase();
          if (u === "m²" || u === "m2") return isST ? [5, 16] : [12, 38];
          if (u === "ml") return isST ? [6, 14] : [12, 28];
          if (u === "u") return isST ? [25, 120] : [60, 300];
          if (u === "j") return isST ? [180, 320] : [280, 450];
          if (u === "ens") return isST ? [40, 150] : [90, 300];
          return isST ? [10, 50] : [25, 90];
        }

        const qpFast = QUALITY_PROFILES_FAST[tier] || QUALITY_PROFILES_FAST.standard;

        const pricedFast = lockedItems.map((item: any) => {
          const rule = detectRuleFast(item);
          if (rule?.isLogistic && isSousTraitance) return { ...item, unitPrice: 0, btpPriceSource: "shubbaik_lubbaik_inline" };

          let [bMin, bMax] = rule ? (isSousTraitance ? rule.sousTrait : rule.direct) : fallbackBandFast(item.unit || 'Ens', isSousTraitance);
          const matF = isSousTraitance ? 1.0 : qpFast.materialFactor;
          bMin *= matF; bMax *= matF;
          const qty = typeof item.quantity === 'number' ? item.quantity : 1;
          const vF = getVolFast(qty);
          bMin *= vF; bMax *= vF;
          const dF = getDiffFast(item);
          bMin *= dF; bMax *= Math.min(dF, 1.15);
          const bundleF = lockedItems.length >= 12 ? 0.95 : lockedItems.length >= 8 ? 0.97 : 1.0;
          bMin *= bundleF; bMax *= bundleF;
          const floor = getFloorFast(item.unit || 'Ens', isSousTraitance);
          bMin = Math.max(bMin, floor);
          bMax = Math.max(bMax, bMin * 1.08);
          const target = bMin + (bMax - bMin) * qpFast.targetRatio;
          return { ...item, unitPrice: Math.round(target), btpPriceSource: "shubbaik_lubbaik_inline" };
        });

        // Anti-stacking: Direct Client = keep bundled low price (never 0), Sous-traitance = zero out prep
        const stackMapFast = new Map<string, { hasMain: boolean; prepIndices: number[] }>();
        pricedFast.forEach((item: any, idx: number) => {
          const rule = detectRuleFast(item);
          if (!rule || !rule.stackGroup) return;
          if (!stackMapFast.has(rule.stackGroup)) stackMapFast.set(rule.stackGroup, { hasMain: false, prepIndices: [] });
          const entry = stackMapFast.get(rule.stackGroup)!;
          if (rule.isPrep) entry.prepIndices.push(idx);
          else entry.hasMain = true;
        });
        for (const [, entry] of stackMapFast) {
          if (!entry.hasMain) continue;
          for (const idx of entry.prepIndices) {
            if (isSousTraitance) {
              pricedFast[idx].unitPrice = 0;
            }
            // Direct Client: prep is BUNDLED into main item price — keep existing price, no zeroing
          }
        }

        // Nettoyage cap
        pricedFast.forEach((item: any) => {
          const desig = (item.designation_fr || "").toLowerCase();
          const desigAr = (item.designation_ar || "");
          if ((/nettoyage|lavage/i.test(desig) || /نيتواياج/i.test(desigAr)) && item.unitPrice > 15) {
            item.unitPrice = 15;
          }
        });

        // ═══════════════════════════════════════
        //   DYNAMIC SUBJECT — "Devis : [Trade] - [Total m²]"
        // ═══════════════════════════════════════
        const TRADE_SUBJECT_MAP: Record<string, string> = {
          peinture: 'Peinture', piscine: 'Rénovation piscine', facade: 'Ravalement de façade',
          carrelage: 'Carrelage', electricite: 'Mise aux normes électriques', électricité: 'Mise aux normes électriques',
          plomberie: 'Plomberie', maconnerie: 'Maçonnerie', toiture: 'Toiture',
          isolation: 'Isolation', renovation: 'Rénovation', mur: 'Peinture intérieure',
          salle_de_bain: 'Rénovation salle de bain', parquet: 'Pose de parquet', placo: 'Cloisons et doublage',
        };

        // Identify dominant trade from highest-priced item
        let dominantTrade = analysisData?.chantierType || 'rénovation';
        let maxTotal = 0;
        pricedFast.forEach((item: any) => {
          const itemTotal = (item.unitPrice || 0) * (item.quantity || 1);
          if (itemTotal > maxTotal) {
            maxTotal = itemTotal;
            const rule = detectRuleFast(item);
            if (rule) {
              const kw = rule.keywords[0] || '';
              for (const [key, label] of Object.entries(TRADE_SUBJECT_MAP)) {
                if (kw.includes(key) || (item.designation_fr || '').toLowerCase().includes(key)) {
                  dominantTrade = key;
                  break;
                }
              }
            }
          }
        });

        const tradeLabel = TRADE_SUBJECT_MAP[dominantTrade] || dominantTrade.charAt(0).toUpperCase() + dominantTrade.slice(1);
        const areaFast = analysisData?.estimatedArea || "";
        const areaStr = areaFast ? ` - ${areaFast} m²` : '';
        const devisSubjectFast = `Devis : ${tradeLabel}${areaStr}`;

        // ═══════════════════════════════════════
        //   MINIMUM FORFAIT — 1500€ for Direct Client
        // ═══════════════════════════════════════
        if (!isSousTraitance) {
          const totalHT = pricedFast.reduce((sum: number, it: any) => sum + (it.unitPrice || 0) * (it.quantity || 1), 0);
          if (totalHT > 0 && totalHT < 1500) {
            const scaleFactor = 1500 / totalHT;
            pricedFast.forEach((item: any) => {
              if (item.unitPrice > 0) {
                item.unitPrice = Math.round(item.unitPrice * scaleFactor);
              }
            });
          }
        }

        return new Response(JSON.stringify({
          items: pricedFast,
          devis_subject_fr: devisSubjectFast,
          verification: {
            chantierType: analysisData?.chantierType || null,
            renovationType: analysisData?.renovationType || null,
            literal_passthrough: true,
            generated_from_suggested_items: pricedFast.length,
            pricing_source: "shubbaik_lubbaik_inline",
            contract_type: pType,
            quality_tier: tier,
            corrections_applied: [],
          },
          summary: {},
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const scopeRule = materialScope === 'main_oeuvre_seule'
        ? `\n⛔ RÈGLE SCOPE MATÉRIAUX (CRITIQUE): Le client fournit ses propres matériaux. Chiffre UNIQUEMENT la main d'œuvre (pose, préparation, nettoyage). Les prix ne doivent PAS inclure le coût des matériaux. Utilise "Pose de..." au lieu de "Fourniture et pose de...".`
        : `\nLe devis inclut fourniture ET pose (matériaux + main d'œuvre).`;

      const systemPrompt = `Tu es شبيك لبيك, l'expert qui représente l'Artisan (المعلم). Tu es propre, extrêmement professionnel et tu possèdes une expertise terrain indiscutable.
À partir de l'analyse fournie, génère les lignes de devis finales selon les standards professionnels du BTP.
${tierInstruction}
${projectTypeInstruction}
⛔ MARCHÉ FRANÇAIS UNIQUEMENT: Tous les prix sont basés sur le marché BTP français. Ne JAMAIS mentionner le marché égyptien.

🧠 PHASAGE DU CHANTIER: Structure TOUJOURS les travaux selon l'ordre logique du métier:
  1. Préparation: Protection, nettoyage et mise à nu des supports.
  2. Traitement: Consolidation et assainissement (anti-salpêtre, rebouchage).
  3. Finition: Mise en peinture et finitions soignées.

💰 INTELLIGENCE DES PRIX:
- Ajuste les tarifs selon la difficulté réelle (accès, hauteur, état de dégradation).
- RÈGLE PETITES SURFACES: Pour tout chantier < 10 m², applique une tarification au forfait ou un prix unitaire plus élevé pour couvrir les frais fixes.

✍️ VOCABULAIRE NOBLE: Utilise les termes techniques précis du bâtiment (ex: "Ratissage", "Impression hydrofuge", "Dégrossissage"). Libellé direct, clair et professionnel.
${scopeRule}

═══════════════════════════════════════
  RÈGLE NOMBRE DE LIGNES (CRITIQUE)
═══════════════════════════════════════

✅ MAPPAGE DYNAMIQUE 1:1: Chaque étape du work_plan DOIT avoir SA PROPRE ligne dans le devis.
✅ Si le work_plan a 6 étapes → 6 lignes. Si 10 étapes → 10 lignes. AUCUNE limite artificielle.
⛔ NE JAMAIS fusionner deux étapes DISTINCTES du work_plan en une seule ligne.
⛔ ANTI-DUPLICATION: NE JAMAIS répéter la même tâche. Chaque ligne = une étape unique.
⛔ Si deux étapes sont vraiment identiques (doublon dans le work_plan), n'en garder qu'une.

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
- Préparation supports → designation_fr: "Préparation des supports" / designation_ar: "تجهيز الحوائط مية مية"
- Dépose ancien carrelage → designation_fr: "Dépose ancien carrelage" / designation_ar: "تكسير الكارلاج القديم وشيله"
- Pose carrelage sol → designation_fr: "Pose carrelage sol" / designation_ar: "تركيب كارلاج الأرضية"
- Pose faïence murale → designation_fr: "Pose faïence murale" / designation_ar: "تركيب فايونس الحيطان"
- Étanchéité → designation_fr: "Étanchéité zone humide" / designation_ar: "عزل مية (إيطونشيتي)"
- Installation sanitaires → designation_fr: "Installation appareils sanitaires" / designation_ar: "تركيب الأطقم (حوض وحنفيات)"
- Ragréage sol → designation_fr: "Ragréage du sol" / designation_ar: "راغرياج (تسوية الأرضية)"

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
⛔ RÈGLE STATELESS: Génère UNIQUEMENT à partir des données d'analyse fournies dans CE message. IGNORE tout contexte de projets précédents.
⛔ RÈGLE ANTI-CONTAMINATION: Si l'analyse dit "salle de bain" ou "bathroom", NE JAMAIS injecter des termes de piscine (206m², bassin, liner, résine piscine). Chaque projet est ISOLÉ.
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

🛁 SI chantierType = "salle_de_bain" ou "salle de bain" ou "bathroom":
  CODES AUTORISÉS: CR001-CR003 (carrelage sol/mur), PLB01-PLB09 (plomberie/sanitaire), 
    DEM01 (démolition), CHA01, CHA02, CHA04, PEI01-PEI04 (peinture plafond si applicable)
  CODES INTERDITS: PIS01-PIS12, FAC01-FAC06, TOI01-TOI04
  UNITÉS: m² pour carrelage et préparation, Ens ou U pour plomberie et nettoyage
  ⛔ INTERDIT: toute référence à "piscine", "206m²", "bassin", "liner", "résine piscine"
  ⛔ Les surfaces doivent correspondre aux dimensions de la salle de bain UNIQUEMENT

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

═══════════════════════════════════════
  RÈGLE PRIX — شبيك لبيك CHIFFRE DIRECTEMENT
═══════════════════════════════════════

✅ Tu es شبيك لبيك, tu CHIFFRES chaque ligne avec un unitPrice réaliste du marché BTP français 2024-2025.
✅ Le prix doit refléter le TYPE DE CONTRAT et la GAMME DE QUALITÉ.
✅ NE JAMAIS mettre unitPrice = 0 en mode CLIENT DIRECT. Tous les items doivent être BUNDLED (Fourniture + Pose) avec un prix > 0.
✅ En mode SOUS-TRAITANCE uniquement: les lignes prépa absorbées par la finition principale peuvent être à 0€.

BARÈMES FRANCE 2024-2025:
${pType === 'sous_traitance' ? `
SOUS-TRAITANCE (Main d'œuvre seule):
- Peinture murs MO: 8-14€/m²
- Peinture plafonds MO: 10-16€/m²
- Sous-couche/impression MO: 3-6€/m²
- Ponçage/décapage MO: 3-7€/m²
- Ratissage/enduit MO: 6-12€/m²
- Carrelage sol MO: 18-35€/m²
- Faïence MO: 20-40€/m²
- Ragréage MO: 6-18€/m²
- Électricité point MO: 25-80€/u
- Plomberie sanitaire MO: 50-180€/u
- Placo/cloison MO: 15-30€/m²
- Dépose MO: 8-25€/m²
- Protection/Nettoyage: 0€ (supprimé en sous-traitance)
` : `
CLIENT DIRECT (Fourniture + Pose):
- Peinture murs F+P: 22-35€/m²
- Peinture plafonds F+P: 25-38€/m²
- Sous-couche/impression F+P: 6-12€/m²
- Ponçage/décapage F+P: 5-12€/m²
- Ratissage/enduit F+P: 12-22€/m²
- Carrelage sol F+P: 40-65€/m²
- Faïence F+P: 45-75€/m²
- Ragréage F+P: 10-30€/m²
- Électricité point F+P: 60-180€/u
- Plomberie sanitaire F+P: 120-600€/u
- Placo/cloison F+P: 35-65€/m²
- Dépose: 12-40€/m²
- Protection: 3-8€/m²
- Nettoyage: 3-15€/m²
`}

GAMME: ${tier.toUpperCase()}
${tier === 'standard' ? 'Base compétitive. Viser le bas de la fourchette.' : ''}
${tier === 'pro' ? 'Matériaux qualité pro. Viser le milieu de la fourchette (+15%).' : ''}
${tier === 'luxury' ? 'Matériaux haut de gamme. Viser le haut de la fourchette (+35%).' : ''}

ANTI-STACKING:
${pType === 'sous_traitance' ? `Si peinture + ponçage + sous-couche → les lignes prépa = 0€ (absorbées par la finition).` : `DIRECT CLIENT: AUCUN PRIX À 0€. Les lignes prépa gardent un prix bas mais > 0 (bundled dans le pack Fourniture+Pose). Ex: ponçage 5€/m², sous-couche 6€/m².`}
Même logique: carrelage + ragréage + joints = 1 pack. Électricité + câblage = 1 pack.

VOLUME: > 100 unités = -10%. > 200 = -15%. < 10m² = +18%.
DIFFICULTÉ: Hauteur/échafaudage/accès difficile = +10-15%.

═══════════════════════════════════════
  OBJET DU DEVIS (OBLIGATOIRE)
═══════════════════════════════════════

Tu DOIS générer un champ "devis_subject_fr" décrivant l'objet du devis de manière claire et professionnelle.
Exemples:
- "Travaux de peinture — Appartement 3 pièces, 75m²"
- "Rénovation salle de bain — Dépose, carrelage et plomberie"
- "Ravalement de façade — Nettoyage HP et peinture, 120m²"
- "Peinture piscine — Décapage et application résine époxy bleue, 146m²"

Le sujet doit inclure: le type de travaux, le lieu/pièce si connu, et la surface totale estimée.

═══════════════════════════════════════

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
✅ Pas de doublons — chaque étape du work_plan a exactement 1 ligne
✅ La couleur de finition est reprise dans la designation_fr
✅ Aucun travail incompatible (ex: "peinture murs" pour un chantier piscine)
✅ Chaque designation_ar est en argot artisan égyptien, PAS en arabe littéraire
✅ Chaque unitPrice est > 0 et réaliste pour le marché français
Si correction nécessaire → l'appliquer AVANT de générer le JSON.

Réponds UNIQUEMENT en JSON:
{
  "devis_subject_fr": "Objet du devis clair et professionnel",
  "items": [
    {
      "designation_fr": "Titre professionnel (avec couleur si applicable)",
      "designation_ar": "ترجمة بالعامية المصرية (argot artisan)",
      "quantity": 0,
      "unit": "m²|ml|u|h|Ens",
      "unitPrice": 28,
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

      // Build the reference list from suggestedItems so the AI has the EXACT list to reproduce
      const suggestedItemsRef = Array.isArray(analysisData?.suggestedItems) && analysisData.suggestedItems.length > 0
        ? "\n\n=======================================\n  LISTE DE REFERENCE OBLIGATOIRE (suggestedItems de l'analyse initiale)\n=======================================\n Tu DOIS reproduire CHAQUE item de cette liste dans ton JSON final. Aucun ne doit manquer.\n" + JSON.stringify(analysisData.suggestedItems, null, 2)
        : '';

      aiMessages.push({
        role: "user",
        content: "Donnees d'analyse:\n" + JSON.stringify(analysisData) + suggestedItemsRef + "\n\nREGLE CRITIQUE: Genere le devis final avec 100% de couverture du work_plan ET des suggestedItems.\n- Chaque etape du plan de travaux (workPlan_fr / workPlan_ar) DOIT avoir UNE ligne correspondante dans le devis.\n- Chaque item de suggestedItems DOIT etre reproduit dans le JSON final.\n- Ne saute AUCUNE etape. Si l'analyse mentionne une tache, elle DOIT apparaitre dans le tableau.\n- Analyse = Table. Pas d'exception.\n- Inclus les quantites realistes basees sur estimatedArea et surfaceEstimates."
      });

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + LOVABLE_API_KEY,
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
        throw new Error("AI error: " + status);
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
      
      // SAFETY: If AI returned fewer items than suggestedItems from the analysis,
      // merge missing ones to ensure 1:1 mapping
      const originalSuggested = Array.isArray(analysisData?.suggestedItems) ? analysisData.suggestedItems : [];
      if (originalSuggested.length > rawItems.length) {
        const existingFrKeys = new Set(rawItems.map((it: any) => normalizePlannerText(it.designation_fr || '')));
        for (const suggested of originalSuggested) {
          const key = normalizePlannerText(suggested.designation_fr || '');
          if (key && !existingFrKeys.has(key)) {
            rawItems.push({
              designation_fr: suggested.designation_fr || '',
              designation_ar: suggested.designation_ar || '',
              quantity: parseLiteralQuantity(suggested.quantity) ?? 1,
              unit: typeof suggested.unit === 'string' && suggested.unit.trim() ? suggested.unit.trim() : 'Ens',
              unitPrice: 0,
              code: suggested.code || '',
              category: suggested.category || 'labor',
            });
            existingFrKeys.add(key);
          }
        }
      }
      
      const { items: lockedItems, removedItems, workPlanSteps } = enforceWorkPlanLock(rawItems, analysisData);
      const existingVerification = parsed?.verification && typeof parsed.verification === "object" ? parsed.verification : {};
      const existingCorrections = Array.isArray(existingVerification.corrections_applied)
        ? existingVerification.corrections_applied
        : [];

      // ═══════════════════════════════════════
      //   PRICING GUARDRAILS — شبيك لبيك inline pricing
      // ═══════════════════════════════════════

      type PricingTradeRule = {
        keywords: string[];
        stackGroup?: string;
        isPrep: boolean;
        isLogistic: boolean;
        direct: [number, number];
        sousTrait: [number, number];
      };

      const PRICING_RULES: PricingTradeRule[] = [
        // === PEINTURE (bundled: prep absorbed into main line price) ===
        { keywords: ["peinture mur", "peinture murs", "peinture acrylique", "peinture 2 couches", "murale", "prestation complete de peinture", "prestation complète de peinture"], stackGroup: "peinture_murs", isPrep: false, isLogistic: false, direct: [35, 55], sousTrait: [14, 22] },
        { keywords: ["plafond", "plafonds", "peinture plafond"], stackGroup: "peinture_plafonds", isPrep: false, isLogistic: false, direct: [38, 58], sousTrait: [16, 24] },
        { keywords: ["sous-couche", "sous couche", "impression", "primaire", "بريمير", "سوكوش"], stackGroup: "peinture_murs", isPrep: true, isLogistic: false, direct: [6, 12], sousTrait: [3, 6] },
        { keywords: ["poncage", "ponçage", "decapage", "décapage", "décollage", "بونساج", "ديكاباج"], stackGroup: "peinture_murs", isPrep: true, isLogistic: false, direct: [5, 12], sousTrait: [3, 7] },
        { keywords: ["ratissage", "enduit", "rebouchage", "lissage", "أندوي"], stackGroup: "peinture_murs", isPrep: true, isLogistic: false, direct: [12, 22], sousTrait: [6, 12] },
        { keywords: ["boiserie", "huisserie", "porte", "fenetre", "fenêtre", "volet", "plinthe"], isPrep: false, isLogistic: false, direct: [18, 32], sousTrait: [8, 15] },
        { keywords: ["hydrofuge", "humidité", "salpetre", "salpêtre"], isPrep: false, isLogistic: false, direct: [8, 16], sousTrait: [4, 9] },
        // === CARRELAGE ===
        { keywords: ["carrelage sol", "sol carrelage", "carrelage", "gres", "grès", "كارلاج"], stackGroup: "carrelage_sol", isPrep: false, isLogistic: false, direct: [55, 85], sousTrait: [22, 38] },
        { keywords: ["faience", "faïence", "carrelage mural", "فايونس"], stackGroup: "faience", isPrep: false, isLogistic: false, direct: [60, 90], sousTrait: [25, 45] },
        { keywords: ["ragreage", "ragréage", "chape", "nivellement", "راغرياج"], stackGroup: "carrelage_sol", isPrep: true, isLogistic: false, direct: [10, 30], sousTrait: [6, 18] },
        { keywords: ["joint", "joints", "jointement"], stackGroup: "carrelage_sol", isPrep: true, isLogistic: false, direct: [4, 10], sousTrait: [3, 6] },
        { keywords: ["depose", "dépose", "demolition", "démolition", "piquage", "تكسير"], isPrep: true, isLogistic: false, direct: [12, 40], sousTrait: [8, 25] },
        // === PLOMBERIE / SANITAIRE ===
        { keywords: ["wc", "toilette", "lavabo", "vasque", "evier", "douche", "baignoire", "sanitaire", "سباكة"], stackGroup: "sanitaire", isPrep: false, isLogistic: false, direct: [150, 650], sousTrait: [60, 200] },
        { keywords: ["tuyau", "tuyauterie", "raccord", "alimentation", "evacuation eau"], stackGroup: "sanitaire", isPrep: true, isLogistic: false, direct: [15, 80], sousTrait: [8, 40] },
        // === ÉLECTRICITÉ (~300€/point Direct) ===
        { keywords: ["prise", "interrupteur", "point lumineux", "spot", "luminaire", "كهربا", "electricite", "électricité", "point electrique", "point électrique"], stackGroup: "elec_point", isPrep: false, isLogistic: false, direct: [220, 380], sousTrait: [100, 180] },
        { keywords: ["tableau electrique", "tableau électrique", "disjoncteur"], isPrep: false, isLogistic: false, direct: [350, 1800], sousTrait: [150, 700] },
        { keywords: ["cable", "câble", "cablage", "câblage", "saignee", "saignée", "goulotte"], stackGroup: "elec_point", isPrep: true, isLogistic: false, direct: [8, 30], sousTrait: [4, 15] },
        // === PLACO (~125€/m² Direct) ===
        { keywords: ["placo", "placoplatre", "cloison", "ba13", "doublage"], isPrep: false, isLogistic: false, direct: [95, 155], sousTrait: [40, 70] },
        { keywords: ["faux plafond", "faux-plafond", "plafond suspendu"], isPrep: false, isLogistic: false, direct: [80, 140], sousTrait: [35, 60] },
        // === PARQUET (~110€/m² Direct) ===
        { keywords: ["parquet", "باركيه", "parquet contrecolle", "parquet contrecollé", "parquet flottant", "parquet massif"], isPrep: false, isLogistic: false, direct: [85, 140], sousTrait: [30, 50] },
        // === LOGISTIQUE ===
        { keywords: ["protection chantier", "protection", "bache", "bâche", "تأمين الموقع"], isPrep: false, isLogistic: true, direct: [3, 8], sousTrait: [0, 0] },
        { keywords: ["nettoyage", "evacuation", "évacuation", "gravats", "نيتواياج", "نضافة"], isPrep: false, isLogistic: true, direct: [3, 50], sousTrait: [0, 0] },
        // === PISCINE ===
        { keywords: ["peinture piscine", "résine piscine", "epoxy piscine", "إيبوكسي"], isPrep: false, isLogistic: false, direct: [20, 45], sousTrait: [10, 25] },
        { keywords: ["nettoyage haute pression", "nettoyage hp", "غسلة صاروخ"], isPrep: false, isLogistic: false, direct: [5, 15], sousTrait: [3, 10] },
      ];

      const QUALITY_PROFILES: Record<string, { materialFactor: number; targetRatio: number }> = {
        standard: { materialFactor: 1.0, targetRatio: 0.35 },
        pro: { materialFactor: 1.15, targetRatio: 0.45 },
        luxury: { materialFactor: 1.35, targetRatio: 0.55 },
      };

      function normalizeForPricing(value: string): string {
        return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      }

      function includesAnyPricing(text: string, keywords: string[]): boolean {
        return keywords.some(kw => text.includes(normalizeForPricing(kw)));
      }

      function detectPricingRule(item: GeneratedQuoteItem): PricingTradeRule | null {
        const text = normalizeForPricing(`${item.designation_fr || ''} ${item.designation_ar || ''}`);
        for (const rule of PRICING_RULES) {
          if (includesAnyPricing(text, rule.keywords)) return rule;
        }
        return null;
      }

      function getVolumeFactor(quantity: number): number {
        if (quantity >= 200) return 0.85;
        if (quantity >= 100) return 0.90;
        if (quantity >= 50) return 0.95;
        if (quantity > 0 && quantity < 10) return 1.18;
        if (quantity >= 10 && quantity < 20) return 1.10;
        return 1.0;
      }

      function getDifficultyFactor(item: GeneratedQuoteItem): number {
        const text = normalizeForPricing(`${item.designation_fr || ''} ${item.designation_ar || ''}`);
        let f = 1.0;
        if (includesAnyPricing(text, ["hauteur", "echafaudage", "échafaudage", "escalier"])) f += 0.10;
        if (includesAnyPricing(text, ["etroit", "étroit", "difficile", "acces", "accès"])) f += 0.08;
        if (includesAnyPricing(text, ["humidite", "humidité", "salpetre", "salpêtre", "fissure"])) f += 0.05;
        return Math.min(f, 1.30);
      }

      function getUnitFloor(unit: string, isST: boolean): number {
        const u = (unit || '').toLowerCase();
        if (u === "m²" || u === "m2") return isST ? 3 : 8;
        if (u === "ml") return isST ? 4 : 10;
        if (u === "u") return isST ? 20 : 50;
        if (u === "j") return isST ? 180 : 280;
        if (u === "ens") return isST ? 30 : 80;
        return 3;
      }

      function getFallbackBandForUnit(unit: string, isST: boolean): [number, number] {
        const u = (unit || '').toLowerCase();
        if (u === "m²" || u === "m2") return isST ? [5, 16] : [12, 38];
        if (u === "ml") return isST ? [6, 14] : [12, 28];
        if (u === "u") return isST ? [25, 120] : [60, 300];
        if (u === "j") return isST ? [180, 320] : [280, 450];
        if (u === "ens") return isST ? [40, 150] : [90, 300];
        return isST ? [10, 50] : [25, 90];
      }

      function computeGuardrailedPrice(item: GeneratedQuoteItem, aiPrice: number, isST: boolean, qualityProfileRef: { materialFactor: number; targetRatio: number }, itemCount: number): number {
        const rule = detectPricingRule(item);
        if (rule?.isLogistic && isST) return 0;

        let [baseMin, baseMax] = rule ? (isST ? rule.sousTrait : rule.direct) : getFallbackBandForUnit(item.unit || 'Ens', isST);
        const matFactor = isST ? 1.0 : qualityProfileRef.materialFactor;
        baseMin *= matFactor;
        baseMax *= matFactor;

        const qty = typeof item.quantity === 'number' ? item.quantity : 1;
        const volFactor = getVolumeFactor(qty);
        baseMin *= volFactor;
        baseMax *= volFactor;

        const diffFactor = getDifficultyFactor(item);
        baseMin *= diffFactor;
        baseMax *= Math.min(diffFactor, 1.15);

        const bundleFactor = itemCount >= 12 ? 0.95 : itemCount >= 8 ? 0.97 : 1.0;
        baseMin *= bundleFactor;
        baseMax *= bundleFactor;

        const floor = getUnitFloor(item.unit || 'Ens', isST);
        baseMin = Math.max(baseMin, floor);
        baseMax = Math.max(baseMax, baseMin * 1.08);

        const target = baseMin + (baseMax - baseMin) * qualityProfileRef.targetRatio;

        if (Number.isFinite(aiPrice) && aiPrice > 0) {
          if (aiPrice >= baseMin * 0.75 && aiPrice <= baseMax * 1.15) {
            return Math.round(aiPrice * 0.25 + target * 0.75);
          }
        }
        return Math.round(target);
      }

      function applyAntiStackingPricing(pricedList: Array<GeneratedQuoteItem & { unitPrice: number }>, isST: boolean): void {
        const stackMap = new Map<string, { hasMain: boolean; prepIndices: number[] }>();
        pricedList.forEach((item, idx) => {
          const rule = detectPricingRule(item);
          if (!rule || !rule.stackGroup) return;
          if (!stackMap.has(rule.stackGroup)) stackMap.set(rule.stackGroup, { hasMain: false, prepIndices: [] });
          const entry = stackMap.get(rule.stackGroup)!;
          if (rule.isPrep) entry.prepIndices.push(idx);
          else entry.hasMain = true;
        });
        for (const [, entry] of stackMap) {
          if (!entry.hasMain) continue;
          for (const idx of entry.prepIndices) {
            if (isST) {
              pricedList[idx].unitPrice = 0;
            }
            // Direct Client: prep items keep their bundled price — NO ZERO PRICES
          }
        }
      }

      const isSousTraitance = pType === 'sous_traitance';
      const qualityProfile = QUALITY_PROFILES[tier] || QUALITY_PROFILES.standard;

      const pricedItems = lockedItems.map((item) => {
        const aiPrice = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
        const guardrailedPrice = computeGuardrailedPrice(item, aiPrice, isSousTraitance, qualityProfile, lockedItems.length);
        return { ...item, unitPrice: guardrailedPrice, btpPriceSource: "shubbaik_lubbaik_inline" };
      });

      applyAntiStackingPricing(pricedItems, isSousTraitance);

      const NETTOYAGE_MAX_PRICE = 15;
      function isCleaningItem(item: GeneratedQuoteItem): boolean {
        const code = (item.code || "").trim().toUpperCase();
        const desig = (item.designation_fr || "").toLowerCase();
        const desigAr = (item.designation_ar || "");
        if (['PSC01', 'PIS01', 'PIS10', 'CHA02', 'LOG03'].includes(code)) return true;
        if (/nettoyage|cleaning|lavage/i.test(desig)) return true;
        if (/نيتواياج/i.test(desigAr)) return true;
        return false;
      }
      pricedItems.forEach(item => {
        if (isCleaningItem(item) && typeof item.unitPrice === 'number' && item.unitPrice > NETTOYAGE_MAX_PRICE) {
          item.unitPrice = NETTOYAGE_MAX_PRICE;
        }
      });

      // ═══════════════════════════════════════
      //   POOL SEQUENCE ORDER
      // ═══════════════════════════════════════
      const POOL_SEQUENCE_ORDER: Record<string, number> = {
        'LOG01': 1, 'CHA01': 1, 'CHA04': 1,
        'PIS05': 2, 'PREP02': 2,
        'PSC01': 3, 'PIS10': 3,
        'PIS12': 4, 'PIS06': 4, 'PNT01': 4,
        'PIS03': 5, 'PIS02': 5, 'PSC02': 5,
        'PIS09': 5, 'PIS04': 5,
        'CHA02': 6, 'LOG03': 6,
      };

      const chantierType = analysisData?.chantierType || "";
      let sortedItems = pricedItems;
      if (chantierType === "piscine") {
        sortedItems = [...pricedItems].sort((a, b) => {
          const codeA = (a.code || "").trim().toUpperCase();
          const codeB = (b.code || "").trim().toUpperCase();
          return (POOL_SEQUENCE_ORDER[codeA] ?? 3) - (POOL_SEQUENCE_ORDER[codeB] ?? 3);
        });
      }

      const devisSubject = typeof parsed?.devis_subject_fr === 'string' && parsed.devis_subject_fr.trim()
        ? parsed.devis_subject_fr.trim()
        : null;

      parsed = {
        ...parsed,
        items: sortedItems,
        devis_subject_fr: devisSubject,
        verification: {
          ...existingVerification,
          work_plan_lock: true,
          work_plan_steps_count: workPlanSteps.length,
          generated_items_before_lock: rawItems.length,
          generated_items_after_lock: sortedItems.length,
          pricing_source: "shubbaik_lubbaik_inline",
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
