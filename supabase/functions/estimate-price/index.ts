import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

type QualityTier = "standard" | "pro" | "luxury";
type ProjectType = "direct" | "sous_traitance";

type EstimateItem = {
  id: string;
  designation_fr: string;
  designation_ar: string;
  unit: string;
  quantity: number;
  laborOnly: boolean;
};

type TradeRule = {
  label: string;
  keywords: string[];
  trade: string;           // corps d'état
  stackGroup?: string;     // anti-stacking group key
  isPrep: boolean;         // is this a preparatory task?
  isLogistic: boolean;     // protection/nettoyage → auto-remove in sous-traitance
  direct: [number, number];     // F+P price range
  sousTrait: [number, number];  // MO-only price range
  units?: string[];
};

// ═══════════════════════════════════════════════════════════════
//  [1] SCOPE ANALYSIS — Trade detection & calibration
// ═══════════════════════════════════════════════════════════════

const TRADE_RULES: TradeRule[] = [
  // ─── PEINTURE ───
  {
    label: "Peinture murs",
    keywords: ["peinture mur", "peinture murs", "peinture acrylique", "peinture glycero", "2 couches mur", "peinture 2 couches"],
    trade: "peinture", stackGroup: "peinture_murs", isPrep: false, isLogistic: false,
    units: ["m²"], direct: [22, 35], sousTrait: [8, 14],
  },
  {
    label: "Peinture plafonds",
    keywords: ["plafond", "plafonds", "peinture plafond"],
    trade: "peinture", stackGroup: "peinture_plafonds", isPrep: false, isLogistic: false,
    units: ["m²"], direct: [25, 38], sousTrait: [10, 16],
  },
  {
    label: "Sous-couche / impression",
    keywords: ["sous-couche", "sous couche", "impression", "primaire"],
    trade: "peinture", stackGroup: "peinture_murs", isPrep: true, isLogistic: false,
    units: ["m²"], direct: [6, 12], sousTrait: [3, 6],
  },
  {
    label: "Ponçage / décollage",
    keywords: ["poncage", "ponçage", "decapage", "décapage", "papier peint", "decollage", "décollage"],
    trade: "peinture", stackGroup: "peinture_murs", isPrep: true, isLogistic: false,
    units: ["m²"], direct: [5, 12], sousTrait: [3, 7],
  },
  {
    label: "Ratissage / enduit",
    keywords: ["ratissage", "enduit", "rebouchage", "lissage", "dégrossissage"],
    trade: "peinture", stackGroup: "peinture_murs", isPrep: true, isLogistic: false,
    units: ["m²"], direct: [12, 22], sousTrait: [6, 12],
  },
  {
    label: "Boiseries / huisseries",
    keywords: ["boiserie", "huisserie", "porte", "fenetre", "fenêtre", "volet", "plinthe"],
    trade: "peinture", isPrep: false, isLogistic: false,
    units: ["ml", "u"], direct: [18, 32], sousTrait: [8, 15],
  },
  {
    label: "Traitement humidité",
    keywords: ["hydrofuge", "anti humidite", "anti-humidite", "humidité", "humidite", "salpetre", "salpêtre"],
    trade: "peinture", isPrep: false, isLogistic: false,
    units: ["m²"], direct: [8, 16], sousTrait: [4, 9],
  },

  // ─── CARRELAGE / FAIENCE ───
  {
    label: "Carrelage sol",
    keywords: ["carrelage sol", "sol carrelage", "carrelage", "gres", "grès"],
    trade: "carrelage", stackGroup: "carrelage_sol", isPrep: false, isLogistic: false,
    units: ["m²"], direct: [40, 65], sousTrait: [18, 35],
  },
  {
    label: "Faïence murale",
    keywords: ["faience", "faïence", "carrelage mural", "mural"],
    trade: "carrelage", stackGroup: "faience", isPrep: false, isLogistic: false,
    units: ["m²"], direct: [45, 75], sousTrait: [20, 40],
  },
  {
    label: "Ragréage / chape",
    keywords: ["ragreage", "ragréage", "chape", "nivellement"],
    trade: "carrelage", stackGroup: "carrelage_sol", isPrep: true, isLogistic: false,
    units: ["m²"], direct: [10, 30], sousTrait: [6, 18],
  },
  {
    label: "Joints carrelage",
    keywords: ["joint", "joints", "jointement", "jointoiement"],
    trade: "carrelage", stackGroup: "carrelage_sol", isPrep: true, isLogistic: false,
    units: ["m²"], direct: [4, 10], sousTrait: [3, 6],
  },

  // ─── DEMOLITION / DEPOSE ───
  {
    label: "Dépose / démolition",
    keywords: ["depose", "dépose", "demolition", "démolition", "piquage", "depose ancien"],
    trade: "demolition", isPrep: true, isLogistic: false,
    direct: [12, 40], sousTrait: [8, 25],
  },

  // ─── PLOMBERIE / SANITAIRE ───
  {
    label: "WC / sanitaire",
    keywords: ["wc", "toilette", "lavabo", "vasque", "evier", "évier", "robinetterie", "colonne de douche", "douche", "baignoire", "bidet"],
    trade: "plomberie", stackGroup: "sanitaire", isPrep: false, isLogistic: false,
    units: ["u", "ens"], direct: [120, 600], sousTrait: [50, 180],
  },
  {
    label: "Tuyauterie / raccordement",
    keywords: ["tuyau", "tuyauterie", "raccord", "raccordement", "alimentation", "evacuation eau", "évacuation eau", "siphon", "vanne"],
    trade: "plomberie", stackGroup: "sanitaire", isPrep: true, isLogistic: false,
    units: ["ml", "u", "ens"], direct: [15, 80], sousTrait: [8, 40],
  },

  // ─── ELECTRICITE ───
  {
    label: "Électricité point",
    keywords: ["prise", "interrupteur", "point lumineux", "spot", "luminaire", "va-et-vient", "va et vient"],
    trade: "electricite", stackGroup: "elec_point", isPrep: false, isLogistic: false,
    units: ["u"], direct: [60, 180], sousTrait: [25, 80],
  },
  {
    label: "Tableau électrique",
    keywords: ["tableau electrique", "tableau électrique", "differentiel", "disjoncteur"],
    trade: "electricite", isPrep: false, isLogistic: false,
    units: ["u", "ens"], direct: [250, 1500], sousTrait: [120, 600],
  },
  {
    label: "Câblage / saignée",
    keywords: ["cable", "câble", "cablage", "câblage", "saignee", "saignée", "goulotte", "gaine"],
    trade: "electricite", stackGroup: "elec_point", isPrep: true, isLogistic: false,
    units: ["ml", "u"], direct: [8, 30], sousTrait: [4, 15],
  },

  // ─── MENUISERIE ───
  {
    label: "Pose porte",
    keywords: ["pose porte", "bloc porte", "porte interieure", "porte intérieure"],
    trade: "menuiserie", isPrep: false, isLogistic: false,
    units: ["u"], direct: [150, 450], sousTrait: [60, 180],
  },
  {
    label: "Pose fenêtre",
    keywords: ["pose fenetre", "pose fenêtre", "fenetre pvc", "fenêtre pvc", "double vitrage"],
    trade: "menuiserie", isPrep: false, isLogistic: false,
    units: ["u"], direct: [200, 800], sousTrait: [80, 250],
  },

  // ─── PLATRERIE ───
  {
    label: "Placo / cloison",
    keywords: ["placo", "placoplatre", "cloison", "ba13", "doublage"],
    trade: "platrerie", isPrep: false, isLogistic: false,
    units: ["m²"], direct: [35, 65], sousTrait: [15, 30],
  },
  {
    label: "Faux plafond",
    keywords: ["faux plafond", "faux-plafond", "plafond suspendu", "dalles plafond"],
    trade: "platrerie", isPrep: false, isLogistic: false,
    units: ["m²"], direct: [40, 80], sousTrait: [18, 38],
  },

  // ─── LOGISTIQUE (auto-supprimé en sous-traitance) ───
  {
    label: "Protection chantier",
    keywords: ["protection chantier", "protection", "bache", "bâche", "film plastique"],
    trade: "logistique", isPrep: false, isLogistic: true,
    direct: [3, 8], sousTrait: [0, 0],
  },
  {
    label: "Nettoyage / évacuation",
    keywords: ["nettoyage", "evacuation", "évacuation", "gravats", "dechets", "déchets", "nettoyage fin de chantier"],
    trade: "logistique", isPrep: false, isLogistic: true,
    direct: [3, 50], sousTrait: [0, 0],
  },
];

// ═══════════════════════════════════════════════════════════════
//  [2] CONTRACT MULTIPLIERS
// ═══════════════════════════════════════════════════════════════
//  Direct = 1.0 (full price: materials + labor + protection + margin)
//  Sous-traitance = 0.4 to 0.5 (MO only, ~50-60% discount)
//  → Each trade rule already has separate direct/sousTrait ranges
//  → Logistic items auto-removed for sous-traitance

const QUALITY_PROFILE: Record<QualityTier, {
  materialFactor: number;   // only applies to direct (F+P)
  targetRatio: number;      // where in the band to target (0=min, 1=max)
}> = {
  standard: { materialFactor: 1.0, targetRatio: 0.35 },
  pro:      { materialFactor: 1.15, targetRatio: 0.45 },
  luxury:   { materialFactor: 1.35, targetRatio: 0.55 },
};

// ═══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(normalizeText(kw)));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function roundPrice(v: number): number {
  return Math.round(v);
}

function detectRule(item: EstimateItem): TradeRule | null {
  const text = normalizeText(`${item.designation_fr} ${item.designation_ar}`);
  for (const rule of TRADE_RULES) {
    const unitOk = !rule.units || rule.units.map(u => u.toLowerCase()).includes(item.unit.toLowerCase());
    if (unitOk && includesAny(text, rule.keywords)) return rule;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  [3] ANTI-STACKING — Merge prep into main task pack
// ═══════════════════════════════════════════════════════════════
//  Rule: If a main task AND its prep tasks share the same stackGroup,
//  the prep tasks get absorbed (price → 0 or near-zero supplement).
//  Examples:
//    Peinture (main) + Ponçage + Sous-couche (prep) → pack price on paint only
//    Carrelage (main) + Ragréage + Joints (prep) → pack price on carrelage only
//    Electricité point (main) + Câblage (prep) → pack price on point only

function applyAntiStacking(
  items: EstimateItem[],
  prices: Map<string, number>,
): void {
  // Build a map: stackGroup → { hasMain, prepItemIds[] }
  const stackMap = new Map<string, { hasMain: boolean; prepIds: string[] }>();

  for (const item of items) {
    const rule = detectRule(item);
    if (!rule || !rule.stackGroup) continue;

    if (!stackMap.has(rule.stackGroup)) {
      stackMap.set(rule.stackGroup, { hasMain: false, prepIds: [] });
    }
    const entry = stackMap.get(rule.stackGroup)!;

    if (rule.isPrep) {
      entry.prepIds.push(item.id);
    } else {
      entry.hasMain = true;
    }
  }

  // For each group where main task exists, zero out prep tasks
  for (const [_group, entry] of stackMap) {
    if (!entry.hasMain) continue;
    for (const prepId of entry.prepIds) {
      // Prep is absorbed into the main task pack → price = 0
      prices.set(prepId, 0);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  [4] VOLUME & DIFFICULTY — Economy of scale + surcharges
// ═══════════════════════════════════════════════════════════════

function getVolumeFactor(quantity: number): number {
  // Economy of scale: > 100 units → -10%, > 200 → -15%
  if (quantity >= 200) return 0.85;
  if (quantity >= 100) return 0.90;
  if (quantity >= 50) return 0.95;
  // Small jobs: < 10 units → +18%, < 20 → +10%
  if (quantity > 0 && quantity < 10) return 1.18;
  if (quantity >= 10 && quantity < 20) return 1.10;
  return 1.0;
}

function getDifficultyFactor(item: EstimateItem): number {
  const text = normalizeText(`${item.designation_fr} ${item.designation_ar}`);
  let f = 1.0;
  // Height / scaffolding → +10%
  if (includesAny(text, ["hauteur", "echafaudage", "échafaudage", "escalier", "cage d'escalier"])) f += 0.10;
  // Tight spaces → +8%
  if (includesAny(text, ["etroit", "étroit", "difficile", "acces", "accès", "sous pente", "sous-pente"])) f += 0.08;
  // Humidity / treatment → +5%
  if (includesAny(text, ["humidite", "humidité", "salpetre", "salpêtre", "fissure", "moisissure"])) f += 0.05;
  // Night work → +15%
  if (includesAny(text, ["nuit", "nocturne", "travail de nuit"])) f += 0.15;
  // Large format tiles → +5%
  if (includesAny(text, ["grand format", "rectifie", "rectifié", "60x60", "80x80", "120"])) f += 0.05;

  return Math.min(f, 1.30); // Cap at +30%
}

function getBundleFactor(itemCount: number): number {
  if (itemCount >= 12) return 0.95;
  if (itemCount >= 8) return 0.97;
  return 1.0;
}

// ═══════════════════════════════════════════════════════════════
//  PRICE CALCULATION
// ═══════════════════════════════════════════════════════════════

function getUnitFloor(unit: string, isST: boolean): number {
  const u = unit.toLowerCase();
  if (u === "m²" || u === "m2") return isST ? 3 : 8;
  if (u === "ml") return isST ? 4 : 10;
  if (u === "u") return isST ? 20 : 50;
  if (u === "m³" || u === "m3") return 20;
  if (u === "j") return isST ? 180 : 280;
  if (u === "ens") return isST ? 30 : 80;
  return 3;
}

function getFallbackBand(item: EstimateItem, isST: boolean): [number, number] {
  const u = item.unit.toLowerCase();
  if (u === "m²" || u === "m2") return isST ? [5, 16] : [12, 38];
  if (u === "ml") return isST ? [6, 14] : [12, 28];
  if (u === "u") return isST ? [25, 120] : [60, 300];
  if (u === "m³" || u === "m3") return [25, 55];
  if (u === "j") return isST ? [180, 320] : [280, 450];
  if (u === "ens") return isST ? [40, 150] : [90, 300];
  return isST ? [10, 50] : [25, 90];
}

function computeGuardrailedPrice(
  item: EstimateItem,
  aiPrice: number | undefined,
  qualityTier: QualityTier,
  projectType: ProjectType,
  itemCount: number,
): number {
  const rule = detectRule(item);
  const isST = projectType === "sous_traitance" || item.laborOnly;
  const quality = QUALITY_PROFILE[qualityTier];

  // If logistic item in sous-traitance → price = 0
  if (rule?.isLogistic && isST) return 0;

  // Get base range
  let [baseMin, baseMax] = rule
    ? (isST ? rule.sousTrait : rule.direct)
    : getFallbackBand(item, isST);

  // Apply quality material factor (only for direct/F+P)
  const matFactor = isST ? 1.0 : quality.materialFactor;
  baseMin *= matFactor;
  baseMax *= matFactor;

  // Apply volume factor
  const volFactor = getVolumeFactor(item.quantity);
  baseMin *= volFactor;
  baseMax *= volFactor;

  // Apply difficulty factor
  const diffFactor = getDifficultyFactor(item);
  baseMin *= diffFactor;
  baseMax *= Math.min(diffFactor, 1.15); // don't blow up the max too much

  // Apply bundle discount
  const bundleFactor = getBundleFactor(itemCount);
  baseMin *= bundleFactor;
  baseMax *= bundleFactor;

  // Enforce floor
  const floor = getUnitFloor(item.unit, isST);
  baseMin = Math.max(baseMin, floor);
  baseMax = Math.max(baseMax, baseMin * 1.08);

  // Target within the band
  const target = baseMin + (baseMax - baseMin) * quality.targetRatio;

  // Blend with AI price (if valid)
  if (Number.isFinite(aiPrice)) {
    const safe = aiPrice as number;
    if (safe >= baseMin * 0.75 && safe <= baseMax * 1.15) {
      // AI price is reasonable → blend 25% AI + 75% our calculation
      const blended = safe * 0.25 + target * 0.75;
      return roundPrice(clamp(blended, baseMin, baseMax));
    }
  }

  return roundPrice(target);
}

// ═══════════════════════════════════════════════════════════════
//  EDGE FUNCTION HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { items, qualityTier, projectType } = await req.json() as {
      items: EstimateItem[];
      qualityTier?: QualityTier;
      projectType?: ProjectType;
    };

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const tier: QualityTier = qualityTier || "standard";
    const pType: ProjectType = projectType || "direct";
    const isSousTraitance = pType === "sous_traitance";
    const itemCount = items.length;

    // ─── Filter out logistic items for sous-traitance ───
    const pricingItems = isSousTraitance
      ? items.filter(i => { const r = detectRule(i); return !r?.isLogistic; })
      : items;

    // ─── Build AI prompt ───
    const itemDescriptions = pricingItems.map((item) =>
      `ID="${item.id}": "${item.designation_fr}" (${item.designation_ar}) — ${item.unit}, qté: ${item.quantity}, ${item.laborOnly ? "MO SEULE" : "F+P"}`
    ).join("\n");

    const contractDesc = isSousTraitance
      ? `SOUS-TRAITANCE (مقاول باطن):
- Prix = MAIN D'OEUVRE SEULE (مصنعية فقط)
- Réduction ~50-60% par rapport au prix client direct
- NE PAS inclure les matériaux, protection, ni nettoyage
- Plafond peinture MO : 14€/m² standard`
      : `CLIENT DIRECT (عميل مباشر):
- Prix = FOURNITURE + POSE (توريد وتركيب)
- Inclure : matériaux + MO + protection + marge
- Plafond peinture F+P : 35€/m² standard`;

    const systemPrompt = `Tu es شبيك لبيك, métreur-chiffreur IA multi-métiers pour artisans BTP en France.

CONTRAT: ${contractDesc}

GAMME: ${tier.toUpperCase()}
${tier === "standard" ? "Base compétitive. Matériaux entrée de gamme." : ""}
${tier === "pro" ? "Matériaux moyenne gamme (+15%). MO identique." : ""}
${tier === "luxury" ? "Matériaux haut de gamme (+35%). MO identique." : ""}

RÈGLES CRITIQUES:
1. ANTI-STACKING: Si peinture + ponçage + sous-couche sont dans le devis, le prix de la peinture INCLUT la prépa. Les lignes prépa = 0€.
   Même logique pour: carrelage + ragréage + joints = 1 pack. Électricité + câblage = 1 pack.
2. VOLUME: > 100 unités = -10%. > 200 = -15%. < 10m² = +18%.
3. DIFFICULTÉ: Hauteur/échafaudage/accès difficile = +10-15% sur MO.
4. ${isSousTraitance ? "SUPPRIMER toute ligne Protection/Nettoyage → prix 0€." : ""}

BARÈMES FRANCE 2024-2025 (Standard):
${isSousTraitance ? `
- Peinture murs MO: 8-14€/m²
- Peinture plafonds MO: 10-16€/m²
- Carrelage sol MO: 18-35€/m²
- Faïence MO: 20-40€/m²
- Électricité point MO: 25-80€/u
- Plomberie sanitaire MO: 50-180€/u
- Placo/cloison MO: 15-30€/m²
- Dépose MO: 8-25€/m²`
: `
- Peinture murs F+P: 22-35€/m²
- Peinture plafonds F+P: 25-38€/m²
- Carrelage sol F+P: 40-65€/m²
- Faïence F+P: 45-75€/m²
- Électricité point F+P: 60-180€/u
- Plomberie sanitaire F+P: 120-600€/u
- Placo/cloison F+P: 35-65€/m²
- Dépose: 12-40€/m²
- Protection: 3-8€/m²`}

FORMAT: JSON uniquement
{ "prices": [ { "id": "<ID>", "unitPrice": 28, "unit": "m²" } ] }
Lignes absorbées par anti-stacking → unitPrice: 0`;

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
          { role: "user", content: `Chiffre ${pricingItems.length} postes (${tier} / ${isSousTraitance ? "SOUS-TRAITANCE" : "CLIENT DIRECT"}):\n\n${itemDescriptions}\n\nJSON.` },
        ],
        temperature: 0.10,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Service surchargé, réessayez." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA indisponibles." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erreur estimation IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];

    let parsed: { prices: Array<{ id: string; unitPrice: number; unit?: string }> };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(JSON.stringify({ error: "Réponse IA invalide", raw: rawContent }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── POST-PROCESSING: Apply guardrails ───
    const aiPriceMap = new Map<string, number>();
    if (parsed.prices) {
      for (const p of parsed.prices) aiPriceMap.set(p.id, p.unitPrice);
    }

    const priceMap = new Map<string, number>();

    // Compute guardrailed price for every item
    for (const item of items) {
      const aiPrice = aiPriceMap.get(item.id);
      priceMap.set(item.id, computeGuardrailedPrice(item, aiPrice, tier, pType, itemCount));
    }

    // Apply anti-stacking (zeroes out prep items when main task exists)
    applyAntiStacking(items, priceMap);

    // Build final response
    const finalPrices = items.map(item => ({
      id: item.id,
      unit: item.unit,
      unitPrice: priceMap.get(item.id) || 0,
    }));

    return new Response(JSON.stringify({ prices: finalPrices }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("estimate-price error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
