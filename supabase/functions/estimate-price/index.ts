import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

type PriceBand = { min: number; max: number; source: string };
type AdjustedBand = PriceBand & { target: number };

type PriceRule = {
  label: string;
  keywords: string[];
  category: string;
  units?: string[];
  direct: [number, number];   // F+P client direct
  sousTrait: [number, number]; // MO seule sous-traitance
};

// ─── QUALITY PROFILES ───
// Standard = base compétitive, Pro = matériaux meilleurs, Luxury = premium
const QUALITY_PROFILE: Record<QualityTier, {
  materialFactor: number;
  directTargetRatio: number;
  laborTargetRatio: number;
}> = {
  standard: { materialFactor: 1, directTargetRatio: 0.35, laborTargetRatio: 0.40 },
  pro:      { materialFactor: 1.15, directTargetRatio: 0.45, laborTargetRatio: 0.42 },
  luxury:   { materialFactor: 1.35, directTargetRatio: 0.55, laborTargetRatio: 0.45 },
};

// ─── PRICE RULES (France 2024-2025) ───
// RULE: Peinture sous-traitance MAX 18€/m² — Peinture direct MAX 45€/m²
// RULE: NO STACKING — ponçage + sous-couche + peinture = 1 pack price
const PRICE_RULES: PriceRule[] = [
  {
    label: "Peinture murs (pack complet)",
    keywords: ["peinture mur", "murs", "mur", "peinture acrylique"],
    category: "peinture",
    units: ["m²"],
    direct: [22, 35],
    sousTrait: [10, 18],
  },
  {
    label: "Peinture plafonds (pack complet)",
    keywords: ["plafond", "plafonds"],
    category: "peinture",
    units: ["m²"],
    direct: [25, 38],
    sousTrait: [12, 18],
  },
  {
    label: "Sous-couche / impression",
    keywords: ["sous-couche", "sous couche", "impression"],
    category: "preparation",
    units: ["m²"],
    direct: [6, 12],
    sousTrait: [4, 7],
  },
  {
    label: "Ponçage / décollage",
    keywords: ["poncage", "ponçage", "decapage", "décapage", "papier peint", "decollage", "décollage"],
    category: "preparation",
    units: ["m²"],
    direct: [6, 14],
    sousTrait: [4, 9],
  },
  {
    label: "Ratissage / enduit",
    keywords: ["ratissage", "enduit", "rebouchage", "lissage"],
    category: "preparation",
    units: ["m²"],
    direct: [14, 25],
    sousTrait: [8, 14],
  },
  {
    label: "Boiseries / huisseries",
    keywords: ["boiserie", "huisserie", "porte", "fenetre", "fenêtre", "volet", "plinthe"],
    category: "boiserie",
    units: ["ml", "u"],
    direct: [18, 32],
    sousTrait: [10, 16],
  },
  {
    label: "Traitement humidité",
    keywords: ["hydrofuge", "anti humidite", "anti-humidite", "humidité", "humidite", "salpetre", "salpêtre"],
    category: "traitement",
    units: ["m²"],
    direct: [8, 16],
    sousTrait: [5, 9],
  },
  {
    label: "Carrelage sol",
    keywords: ["carrelage sol", "sol carrelage", "carrelage"],
    category: "carrelage",
    units: ["m²"],
    direct: [40, 65],
    sousTrait: [22, 40],
  },
  {
    label: "Faïence murale",
    keywords: ["faience", "faïence", "carrelage mural", "mural"],
    category: "carrelage",
    units: ["m²"],
    direct: [45, 75],
    sousTrait: [25, 45],
  },
  {
    label: "Dépose / démolition",
    keywords: ["depose", "dépose", "demolition", "démolition", "depose ancien", "piquage"],
    category: "demolition",
    direct: [12, 40],
    sousTrait: [8, 28],
  },
  {
    label: "Ragréage / chape",
    keywords: ["ragreage", "ragréage", "chape"],
    category: "sol",
    units: ["m²"],
    direct: [12, 35],
    sousTrait: [7, 20],
  },
  {
    label: "WC / sanitaire",
    keywords: ["wc", "toilette", "lavabo", "vasque", "evier", "évier", "robinetterie", "colonne de douche", "douche"],
    category: "plomberie",
    units: ["u", "ens"],
    direct: [120, 600],
    sousTrait: [50, 200],
  },
  {
    label: "Électricité",
    keywords: ["prise", "interrupteur", "point lumineux", "tableau electrique", "tableau électrique", "luminaire"],
    category: "electricite",
    units: ["u", "ens"],
    direct: [60, 1200],
    sousTrait: [30, 550],
  },
  {
    label: "Protection / nettoyage",
    keywords: ["protection chantier", "nettoyage", "evacuation", "évacuation", "gravats", "bache", "bâche"],
    category: "divers",
    direct: [3, 50],
    sousTrait: [2, 35],
  },
];

// ─── ANTI-STACKING CATEGORIES ───
// Items in these categories should NOT stack on top of peinture
const STACKING_ABSORB_CATEGORIES = new Set(["preparation"]);
const PAINT_CATEGORIES = new Set(["peinture"]);

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(normalizeText(kw)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundPrice(value: number): number {
  return Math.round(value);
}

// ─── DETECT RULE FOR AN ITEM ───
function detectRule(item: EstimateItem): PriceRule | null {
  const text = normalizeText(`${item.designation_fr} ${item.designation_ar}`);
  for (const rule of PRICE_RULES) {
    const unitOk = !rule.units || rule.units.map(u => u.toLowerCase()).includes(item.unit.toLowerCase());
    if (unitOk && includesAny(text, rule.keywords)) return rule;
  }
  return null;
}

// ─── UNIT FLOOR (never go below) ───
function getUnitFloor(item: EstimateItem, projectType: ProjectType): number {
  const isST = projectType === "sous_traitance" || item.laborOnly;
  const u = item.unit.toLowerCase();
  if (u === "m²" || u === "m2") return isST ? 4 : 10;
  if (u === "ml") return isST ? 6 : 12;
  if (u === "u") return isST ? 25 : 60;
  if (u === "m³" || u === "m3") return 25;
  if (u === "j") return isST ? 200 : 280;
  if (u === "ens") return isST ? 40 : 100;
  return 3;
}

// ─── FALLBACK BAND ───
function getFallbackBand(item: EstimateItem, projectType: ProjectType): PriceBand {
  const isST = projectType === "sous_traitance" || item.laborOnly;
  const u = item.unit.toLowerCase();
  if (u === "m²" || u === "m2") {
    return isST
      ? { min: 6, max: 18, source: "fallback m² MO" }
      : { min: 15, max: 40, source: "fallback m² F+P" };
  }
  if (u === "ml") {
    return isST
      ? { min: 8, max: 16, source: "fallback ml MO" }
      : { min: 14, max: 30, source: "fallback ml F+P" };
  }
  if (u === "u") {
    return isST
      ? { min: 30, max: 150, source: "fallback u MO" }
      : { min: 80, max: 350, source: "fallback u F+P" };
  }
  if (u === "m³" || u === "m3") return { min: 30, max: 60, source: "fallback m³" };
  if (u === "j") return isST
    ? { min: 200, max: 350, source: "fallback j MO" }
    : { min: 280, max: 450, source: "fallback j F+P" };
  if (u === "ens") {
    return isST
      ? { min: 50, max: 180, source: "fallback ens MO" }
      : { min: 120, max: 350, source: "fallback ens F+P" };
  }
  return isST
    ? { min: 15, max: 60, source: "fallback generic MO" }
    : { min: 30, max: 100, source: "fallback generic F+P" };
}

// ─── REFERENCE BAND ───
function getReferenceBand(item: EstimateItem, projectType: ProjectType): PriceBand {
  const rule = detectRule(item);
  if (!rule) return getFallbackBand(item, projectType);

  const isST = projectType === "sous_traitance" || item.laborOnly;
  const [min, max] = isST ? rule.sousTrait : rule.direct;
  return { min, max, source: rule.label };
}

// ─── SMALL JOB FACTOR ───
function getSmallJobFactor(totalSurface: number, itemCount: number): number {
  if (totalSurface > 0 && totalSurface < 10) return 1.18;
  if (totalSurface >= 10 && totalSurface < 20) return 1.08;
  if (totalSurface === 0 && itemCount <= 2) return 1.05;
  return 1;
}

// ─── BUNDLE FACTOR ───
function getBundleFactor(itemCount: number): number {
  if (itemCount >= 12) return 0.95;
  if (itemCount >= 8) return 0.97;
  if (itemCount >= 5) return 0.985;
  return 1;
}

// ─── COMPLEXITY FACTOR ───
function getComplexityFactor(item: EstimateItem): number {
  const text = normalizeText(`${item.designation_fr} ${item.designation_ar}`);
  let f = 1;
  if (includesAny(text, ["plafond", "hauteur", "echafaudage", "échafaudage", "escalier"])) f += 0.04;
  if (includesAny(text, ["hydrofuge", "humidite", "humidité", "salpetre", "salpêtre", "fissure"])) f += 0.05;
  if (includesAny(text, ["faience", "faïence", "grand format", "rectifie", "rectifié"])) f += 0.04;
  if (includesAny(text, ["depose", "dépose", "demolition", "démolition"])) f += 0.04;
  return Math.min(f, 1.12);
}

// ─── BUILD ADJUSTED BAND ───
function buildAdjustedBand(
  item: EstimateItem,
  qualityTier: QualityTier,
  projectType: ProjectType,
  totalSurface: number,
  itemCount: number,
): AdjustedBand {
  const reference = getReferenceBand(item, projectType);
  const quality = QUALITY_PROFILE[qualityTier];
  const isST = projectType === "sous_traitance" || item.laborOnly;

  // Material factor only applies to direct (F+P)
  const materialFactor = isST ? 1 : quality.materialFactor;
  const smallJobFactor = getSmallJobFactor(totalSurface, itemCount);
  const bundleFactor = getBundleFactor(itemCount);
  const complexityFactor = getComplexityFactor(item);

  let min = reference.min * materialFactor * smallJobFactor * bundleFactor;
  let max = reference.max * materialFactor * smallJobFactor * bundleFactor * complexityFactor;

  // Enforce unit floor
  const floor = getUnitFloor(item, projectType);
  min = Math.max(min, floor);
  max = Math.max(max, min * 1.10);

  // ─── HARD CAPS (Step 3 guardrails) ───
  const rule = detectRule(item);
  if (rule && PAINT_CATEGORIES.has(rule.category)) {
    const u = item.unit.toLowerCase();
    if (u === "m²" || u === "m2") {
      if (isST) {
        // Sous-traitance peinture: MAX 18€/m²
        max = Math.min(max, 18 * quality.materialFactor);
        min = Math.min(min, max * 0.7);
      } else {
        // Direct peinture: MAX 45€/m²
        max = Math.min(max, 45 * quality.materialFactor);
        min = Math.min(min, max * 0.65);
      }
    }
  }

  const ratio = isST ? quality.laborTargetRatio : quality.directTargetRatio;
  const target = min + (max - min) * ratio;

  return { min, max, target, source: reference.source };
}

// ─── ANTI-STACKING LOGIC ───
// Detect if devis has both painting AND preparation items on the same unit
// If so, reduce preparation prices significantly (they're included in the paint pack)
function applyAntiStacking(
  items: EstimateItem[],
  prices: Map<string, number>,
  _qualityTier: QualityTier,
  projectType: ProjectType,
): void {
  // Find all paint items (m² based)
  const paintItems = items.filter(i => {
    const rule = detectRule(i);
    return rule && PAINT_CATEGORIES.has(rule.category) && ["m²", "m2"].includes(i.unit.toLowerCase());
  });

  if (paintItems.length === 0) return;

  // When painting is present, prep items (ponçage, sous-couche, enduit) are 
  // INCLUDED in the paint pack price. Their standalone price should be 
  // reduced to a minimal technical supplement only.
  for (const item of items) {
    const rule = detectRule(item);
    if (!rule || !STACKING_ABSORB_CATEGORIES.has(rule.category)) continue;
    if (!["m²", "m2"].includes(item.unit.toLowerCase())) continue;

    const currentPrice = prices.get(item.id);
    if (currentPrice === undefined) continue;

    const isST = projectType === "sous_traitance" || item.laborOnly;
    // Aggressive pack absorption: prep is already in paint price
    // Only charge a small technical supplement
    const maxPrepPrice = isST ? 5 : 8; // €/m² max when paint is present
    const reduced = Math.min(currentPrice, maxPrepPrice);
    const floor = getUnitFloor(item, projectType);
    prices.set(item.id, Math.max(reduced, floor));
  }
}

// ─── COMPETITIVE PRICE BLENDING ───
function getCompetitivePrice(aiPrice: number | undefined, band: AdjustedBand): number {
  if (!Number.isFinite(aiPrice)) return roundPrice(band.target);

  const safe = aiPrice as number;
  // If AI price is wildly out of range, use our target
  if (safe < band.min * 0.80 || safe > band.max * 1.10) {
    return roundPrice(band.target);
  }

  // Blend: 30% AI + 70% our calculation (our rules dominate)
  const blended = safe * 0.30 + band.target * 0.70;
  return roundPrice(clamp(blended, band.min, band.max));
}

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

    const tier = qualityTier || "standard";
    const pType = projectType || "direct";
    const isSousTraitance = pType === "sous_traitance";

    const totalSurface = items
      .filter((i) => ["m²", "m2"].includes(i.unit.toLowerCase()))
      .reduce((sum, i) => sum + i.quantity, 0);
    const itemCount = items.length;
    const isSmallJob = totalSurface > 0 && totalSurface < 15;

    // ─── BUILD AI PROMPT ───
    const itemDescriptions = items.map((item) =>
      `Item ID="${item.id}" : "${item.designation_fr}" (${item.designation_ar}) — unité: ${item.unit}, qté: ${item.quantity}, ${item.laborOnly ? "MAIN D'OEUVRE SEULE" : "FOURNITURE ET POSE"}`
    ).join("\n");

    const contractContext = isSousTraitance
      ? `⚠️ CONTRAT SOUS-TRAITANCE : Tu es sous-traitant. Les prix sont MAIN D'OEUVRE SEULE.
Le total doit être environ 50% moins cher que le tarif client direct.
PLAFOND ABSOLU peinture : 18€/m² max (standard), incluant ponçage + impression + 2 couches.`
      : `CONTRAT CLIENT DIRECT : Tu es l'entreprise principale. Prix FOURNITURE + POSE.
PLAFOND peinture : 45€/m² max (standard), incluant préparation + impression + 2 couches.`;

    const systemPrompt = `Tu es شبيك لبيك (Shubbaik Lubbaik), métreur-chiffreur IA pour artisans BTP en France.

${contractContext}

GAMME : ${tier.toUpperCase()}
${tier === "standard" ? "Prix d'entrée compétitifs. Marge artisan ~15-20%." : ""}
${tier === "pro" ? "Matériaux de meilleure qualité. Hausse matériaux +12-18% vs standard. MO identique." : ""}
${tier === "luxury" ? "Matériaux premium. Hausse matériaux +30-40% vs standard. MO identique." : ""}

RÈGLES CRITIQUES :
1. PAS DE STACKING : Si le devis contient ponçage + sous-couche + peinture, le prix de la peinture INCLUT DÉJÀ la préparation. Les lignes de préparation doivent avoir un prix MINIMAL (supplément technique uniquement).
2. Surface sol A → Surface murs ≈ A × 3 (pour vérification cohérence).
3. PLAFONDS de prix STRICTS par unité et par type de contrat.
4. Prix COMPÉTITIFS : l'artisan doit gagner le marché TOUT en gagnant de l'argent.
5. Cohérence globale : le total du devis doit être réaliste pour un artisan français.

BARÈMES DE RÉFÉRENCE (Standard, Client Direct) :
- Peinture murs : 22-35€/m² F+P | 10-18€/m² MO
- Peinture plafonds : 25-38€/m² F+P | 12-18€/m² MO
- Sous-couche : 6-12€/m² F+P | 4-7€/m² MO
- Ratissage/enduit : 14-25€/m² F+P | 8-14€/m² MO
- Carrelage sol : 40-65€/m² F+P | 22-40€/m² MO
- Faïence : 45-75€/m² F+P | 25-45€/m² MO

FORMAT : JSON uniquement
{ "prices": [ { "id": "<EXACT ITEM ID>", "unitPrice": 28, "unit": "m²" } ] }`;

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
          { role: "user", content: `Chiffre ces ${itemCount} postes (${tier.toUpperCase()} / ${isSousTraitance ? "SOUS-TRAITANCE MO SEULE" : "CLIENT DIRECT F+P"}${isSmallJob ? " / PETIT CHANTIER" : ""}) :\n\n${itemDescriptions}\n\nJSON uniquement.` },
        ],
        temperature: 0.12,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Service surchargé, réessayez dans un instant." }), {
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
      console.error("Failed to parse AI price response:", rawContent);
      return new Response(JSON.stringify({ error: "Réponse IA invalide", raw: rawContent }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemMap = new Map(items.map((item) => [item.id, item]));

    // ─── POST-PROCESSING: Apply guardrails ───
    const priceMap = new Map<string, number>();

    if (parsed.prices) {
      // First pass: compute guardrailed prices
      for (const priceLine of parsed.prices) {
        const sourceItem = itemMap.get(priceLine.id);
        if (!sourceItem) {
          priceMap.set(priceLine.id, Math.max(priceLine.unitPrice, 3));
          continue;
        }
        const band = buildAdjustedBand(sourceItem, tier, pType, totalSurface, itemCount);
        priceMap.set(priceLine.id, getCompetitivePrice(priceLine.unitPrice, band));
      }

      // Fill missing items
      for (const item of items) {
        if (priceMap.has(item.id)) continue;
        const band = buildAdjustedBand(item, tier, pType, totalSurface, itemCount);
        priceMap.set(item.id, getCompetitivePrice(undefined, band));
      }

      // Second pass: apply anti-stacking
      applyAntiStacking(items, priceMap, tier, pType);

      // Rebuild prices array
      parsed.prices = items.map(item => ({
        id: item.id,
        unit: item.unit,
        unitPrice: priceMap.get(item.id) || 0,
      }));
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("estimate-price error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
