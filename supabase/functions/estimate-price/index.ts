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

type PriceBand = {
  min: number;
  max: number;
  source: string;
};

type AdjustedBand = PriceBand & {
  target: number;
};

type PriceRule = {
  label: string;
  keywords: string[];
  units?: string[];
  full: [number, number];
  labor: [number, number];
};

const QUALITY_PROFILE: Record<QualityTier, {
  materialFactor: number;
  fullTargetRatio: number;
  laborTargetRatio: number;
}> = {
  standard: { materialFactor: 1, fullTargetRatio: 0.34, laborTargetRatio: 0.42 },
  pro: { materialFactor: 1.15, fullTargetRatio: 0.48, laborTargetRatio: 0.46 },
  luxury: { materialFactor: 1.34, fullTargetRatio: 0.62, laborTargetRatio: 0.5 },
};

const PROJECT_FACTOR: Record<ProjectType, number> = {
  direct: 1,
  sous_traitance: 0.84,
};

const PRICE_RULES: PriceRule[] = [
  {
    label: "Peinture murs",
    keywords: ["peinture mur", "murs", "mur", "peinture acrylique"],
    units: ["m²"],
    full: [25, 35],
    labor: [14, 20],
  },
  {
    label: "Peinture plafonds",
    keywords: ["plafond", "plafonds"],
    units: ["m²"],
    full: [28, 38],
    labor: [16, 22],
  },
  {
    label: "Boiseries / huisseries",
    keywords: ["boiserie", "huisserie", "porte", "fenetre", "fenêtre", "volet", "plinthe"],
    units: ["ml", "u"],
    full: [20, 35],
    labor: [12, 18],
  },
  {
    label: "Sous-couche / impression",
    keywords: ["sous-couche", "sous couche", "impression"],
    units: ["m²"],
    full: [8, 15],
    labor: [5, 8],
  },
  {
    label: "Traitement humidité",
    keywords: ["hydrofuge", "anti humidite", "anti-humidite", "humidité", "humidite", "salpetre", "salpêtre"],
    units: ["m²"],
    full: [10, 18],
    labor: [6, 10],
  },
  {
    label: "Ratissage / enduit",
    keywords: ["ratissage", "enduit", "rebouchage", "lissage"],
    units: ["m²"],
    full: [18, 28],
    labor: [10, 16],
  },
  {
    label: "Ponçage / décollage",
    keywords: ["poncage", "ponçage", "decapage", "décapage", "papier peint", "decollage", "décollage"],
    units: ["m²"],
    full: [8, 18],
    labor: [6, 12],
  },
  {
    label: "Carrelage sol",
    keywords: ["carrelage sol", "sol carrelage", "carrelage"],
    units: ["m²"],
    full: [45, 70],
    labor: [28, 45],
  },
  {
    label: "Faïence murale",
    keywords: ["faience", "faïence", "carrelage mural", "mural"],
    units: ["m²"],
    full: [50, 85],
    labor: [30, 50],
  },
  {
    label: "Dépose / démolition",
    keywords: ["depose", "dépose", "demolition", "démolition", "depose ancien", "piquage"],
    full: [15, 50],
    labor: [12, 35],
  },
  {
    label: "Ragréage / chape",
    keywords: ["ragreage", "ragréage", "chape"],
    units: ["m²"],
    full: [15, 40],
    labor: [8, 25],
  },
  {
    label: "WC / sanitaire",
    keywords: ["wc", "toilette", "lavabo", "vasque", "evier", "évier", "robinetterie", "colonne de douche", "douche"],
    units: ["u", "ens"],
    full: [150, 700],
    labor: [60, 250],
  },
  {
    label: "Électricité",
    keywords: ["prise", "interrupteur", "point lumineux", "tableau electrique", "tableau électrique", "luminaire"],
    units: ["u", "ens"],
    full: [80, 1500],
    labor: [40, 700],
  },
  {
    label: "Protection / nettoyage",
    keywords: ["protection chantier", "nettoyage", "evacuation", "évacuation", "gravats", "bache", "bâche"],
    full: [3, 60],
    labor: [3, 40],
  },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundPrice(value: number): number {
  return Math.round(value);
}

function getUnitFloor(item: EstimateItem): number {
  switch (item.unit.toLowerCase()) {
    case "m²":
    case "m2":
      return item.laborOnly ? 8 : 14;
    case "ml":
      return item.laborOnly ? 10 : 16;
    case "u":
      return item.laborOnly ? 60 : 120;
    case "m³":
    case "m3":
      return 35;
    case "j":
      return 280;
    case "ens":
      return 120;
    default:
      return 5;
  }
}

function getFallbackBand(item: EstimateItem): PriceBand {
  const unit = item.unit.toLowerCase();

  if (unit === "m²" || unit === "m2") {
    return item.laborOnly
      ? { min: 12, max: 24, source: "fallback m² MO" }
      : { min: 22, max: 48, source: "fallback m² F+P" };
  }

  if (unit === "ml") {
    return item.laborOnly
      ? { min: 10, max: 18, source: "fallback ml MO" }
      : { min: 18, max: 35, source: "fallback ml F+P" };
  }

  if (unit === "u") {
    return item.laborOnly
      ? { min: 60, max: 180, source: "fallback u MO" }
      : { min: 120, max: 450, source: "fallback u F+P" };
  }

  if (unit === "m³" || unit === "m3") {
    return { min: 35, max: 70, source: "fallback m³" };
  }

  if (unit === "j") {
    return { min: 280, max: 450, source: "fallback journée" };
  }

  if (unit === "ens") {
    return item.laborOnly
      ? { min: 90, max: 220, source: "fallback ens MO" }
      : { min: 180, max: 420, source: "fallback ens F+P" };
  }

  return item.laborOnly
    ? { min: 25, max: 80, source: "fallback generic MO" }
    : { min: 40, max: 140, source: "fallback generic F+P" };
}

function getReferenceBand(item: EstimateItem): PriceBand {
  const text = normalizeText(`${item.designation_fr} ${item.designation_ar}`);

  for (const rule of PRICE_RULES) {
    const unitMatches = !rule.units || rule.units.map((unit) => unit.toLowerCase()).includes(item.unit.toLowerCase());
    if (unitMatches && includesAny(text, rule.keywords)) {
      const [min, max] = item.laborOnly ? rule.labor : rule.full;
      return { min, max, source: rule.label };
    }
  }

  return getFallbackBand(item);
}

function getSmallJobFactor(totalSurface: number, itemCount: number): number {
  if (totalSurface > 0 && totalSurface < 10) return 1.2;
  if (totalSurface >= 10 && totalSurface < 20) return 1.1;
  if (totalSurface === 0 && itemCount <= 2) return 1.05;
  return 1;
}

function getBundleFactor(itemCount: number): number {
  if (itemCount >= 12) return 0.95;
  if (itemCount >= 8) return 0.97;
  if (itemCount >= 5) return 0.985;
  return 1;
}

function getComplexityFactor(item: EstimateItem): number {
  const text = normalizeText(`${item.designation_fr} ${item.designation_ar}`);
  let factor = 1;

  if (includesAny(text, ["plafond", "hauteur", "echafaudage", "échafaudage", "escalier"])) factor += 0.05;
  if (includesAny(text, ["boiserie", "huisserie", "porte", "fenetre", "fenêtre"])) factor += 0.04;
  if (includesAny(text, ["hydrofuge", "humidite", "humidité", "salpetre", "salpêtre", "fissure"])) factor += 0.06;
  if (includesAny(text, ["faience", "faïence", "grand format", "rectifie", "rectifié"])) factor += 0.05;
  if (includesAny(text, ["depose", "dépose", "demolition", "démolition", "evacuation", "évacuation"])) factor += 0.05;

  return Math.min(factor, item.laborOnly ? 1.12 : 1.18);
}

function buildAdjustedBand(item: EstimateItem, qualityTier: QualityTier, projectType: ProjectType, totalSurface: number, itemCount: number): AdjustedBand {
  const reference = getReferenceBand(item);
  const quality = QUALITY_PROFILE[qualityTier];
  const materialFactor = item.laborOnly ? 1 : quality.materialFactor;
  const projectFactor = PROJECT_FACTOR[projectType];
  const smallJobFactor = getSmallJobFactor(totalSurface, itemCount);
  const bundleFactor = getBundleFactor(itemCount);
  const complexityFactor = getComplexityFactor(item);

  let min = reference.min * materialFactor * projectFactor * smallJobFactor * bundleFactor * Math.min(complexityFactor, 1.08);
  let max = reference.max * materialFactor * projectFactor * smallJobFactor * bundleFactor * complexityFactor;

  min = Math.max(min, getUnitFloor(item));
  max = Math.max(max, min * 1.12);

  const ratio = item.laborOnly ? quality.laborTargetRatio : quality.fullTargetRatio;
  const target = min + (max - min) * ratio;

  return {
    min,
    max,
    target,
    source: reference.source,
  };
}

function getCompetitivePrice(aiPrice: number | undefined, adjustedBand: AdjustedBand): number {
  if (!Number.isFinite(aiPrice)) {
    return roundPrice(adjustedBand.target);
  }

  const safeAiPrice = aiPrice as number;
  if (safeAiPrice < adjustedBand.min * 0.85 || safeAiPrice > adjustedBand.max * 1.15) {
    return roundPrice(adjustedBand.target);
  }

  const blended = safeAiPrice * 0.35 + adjustedBand.target * 0.65;
  return roundPrice(clamp(blended, adjustedBand.min, adjustedBand.max));
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

    // Calculate total quantity to detect small jobs
    const totalSurface = items
      .filter((i) => i.unit === "m²" || i.unit === "m2")
      .reduce((sum, i) => sum + i.quantity, 0);
    const isSmallJob = totalSurface > 0 && totalSurface < 15;
    const itemCount = items.length;

    const itemDescriptions = items.map((item) =>
      `Item ID="${item.id}" : "${item.designation_fr}" (${item.designation_ar}) — unité: ${item.unit}, qté: ${item.quantity}, ${item.laborOnly ? "MAIN D'OEUVRE SEULE (pas de fourniture)" : "FOURNITURE ET POSE (matériaux + main d'oeuvre)"}`
    ).join("\n");

    const systemPrompt = `Tu es شبيك لبيك (Shubbaik Lubbaik), le métreur-chiffreur IA de l'artisan.
⛔ MARCHÉ FRANÇAIS UNIQUEMENT — prix BTP France métropolitaine 2024-2025.

MISSION : retourner des prix unitaires RENTABLES, COMPÉTITIFS et LOGIQUES.
Tu dois standardiser ton raisonnement pour que l'artisan gagne de l'argent tout en restant assez bien placé pour décrocher le marché.

LOGIQUE OBLIGATOIRE POUR CHAQUE LIGNE :
1. Partir du marché FRANÇAIS en gamme standard / client direct.
2. Couvrir obligatoirement : matériaux (si F+P), main d'oeuvre, frais fixes, marge positive.
3. Viser plutôt le bas / milieu de fourchette du marché, pas le haut de fourchette, sauf contrainte claire.
4. Appliquer la qualité :
   - standard = base compétitive
   - pro = hausse MATÉRIAUX modérée (+12% à +18%), pas de surenchère sur la MO seule
   - luxury = hausse premium raisonnée (+28% à +40%), pas de prix extravagants
5. Appliquer le type de client :
   - client direct = prix marché normal
   - sous-traitance = réduction finale d'environ -15% à -20% par rapport au direct, sans vendre à perte
6. Appliquer le contexte :
   - petit chantier < 10 m² = majoration raisonnable +15% à +25%
   - chantier 10 à 20 m² = légère majoration +8% à +12%
   - multi-postes (8 lignes ou plus) = optimisation légère -3% à -5%
7. Ne majorer davantage que si la désignation indique réellement une difficulté : humidité, hauteur, dépose, démolition, finition haut de gamme, etc.

BARÈMES DE RÉFÉRENCE FRANCE 2024-2025 (client direct, standard) :
- peinture murs 2 couches : 25-35€/m² F+P | 14-20€/m² MO
- peinture plafonds : 28-38€/m² F+P | 16-22€/m² MO
- boiseries / huisseries : 20-35€/ml F+P | 12-18€/ml MO
- sous-couche / impression : 8-15€/m² F+P | 5-8€/m² MO
- ratissage / enduit : 18-28€/m² F+P | 10-16€/m² MO
- ponçage / décapage : 8-18€/m² F+P | 6-12€/m² MO
- traitement humidité / hydrofuge : 10-18€/m² F+P | 6-10€/m² MO
- carrelage sol : 45-70€/m² F+P | 28-45€/m² MO
- faïence murale : 50-85€/m² F+P | 30-50€/m² MO
- plomberie sanitaire : 150-700€/u F+P | 60-250€/u MO
- électricité : 80-1500€/u F+P | 40-700€/u MO
- dépose / démolition : 15-50€/m² selon poste
- protection / nettoyage : 3-60€ selon unité et nature du poste

FORMAT DE RÉPONSE :
Réponds UNIQUEMENT avec un JSON valide :
{ "prices": [ { "id": "<EXACT ITEM ID>", "unitPrice": 35, "unit": "m²" } ] }

RÈGLES :
- "id" = copie EXACTE de l'Item ID fourni en entrée
- unitPrice = nombre entier arrondi
- Pour MO seule : prix main d'œuvre uniquement (la MO ne varie PAS selon la gamme)
- Pour F+P : prix total matériaux + main d'œuvre (les matériaux varient selon la gamme)
- Pas de texte, pas d'explication, JUSTE le JSON`;

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
          { role: "user", content: `Chiffre ces ${itemCount} postes BTP avec une logique COMPÉTITIVE et RENTABLE (${tier.toUpperCase()} / ${pType === "direct" ? "CLIENT DIRECT" : "SOUS-TRAITANCE"}${isSmallJob ? " / PETIT CHANTIER" : ""}) :\n\n${itemDescriptions}\n\nPrends bien en compte la gamme, le type de client, la rentabilité artisan et le fait qu'il faut rester assez agressif pour gagner le marché. JSON uniquement.` },
        ],
        temperature: 0.15,
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
    
    // Extract JSON from response (handle markdown code blocks)
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

    // Post-processing: standardize prices with competitive French-market guardrails
    if (parsed.prices) {
      parsed.prices = parsed.prices.map((priceLine) => {
        const sourceItem = itemMap.get(priceLine.id);

        if (!sourceItem) {
          return {
            ...priceLine,
            unitPrice: Math.max(priceLine.unitPrice, 5),
          };
        }

        const adjustedBand = buildAdjustedBand(sourceItem, tier, pType, totalSurface, itemCount);

        return {
          ...priceLine,
          unit: priceLine.unit || sourceItem.unit,
          unitPrice: getCompetitivePrice(priceLine.unitPrice, adjustedBand),
        };
      });

      const pricedIds = new Set(parsed.prices.map((priceLine) => priceLine.id));
      for (const item of items) {
        if (pricedIds.has(item.id)) continue;
        const adjustedBand = buildAdjustedBand(item, tier, pType, totalSurface, itemCount);
        parsed.prices.push({
          id: item.id,
          unit: item.unit,
          unitPrice: getCompetitivePrice(undefined, adjustedBand),
        });
      }
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
