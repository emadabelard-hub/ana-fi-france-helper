/**
 * CONTRAT UNIQUE DE FAIT BTP
 *
 * Source de vérité partagée entre :
 *   documents → extraction IA → validation serveur → rapport approfondi → devis.
 *
 * Une fois un fait validé ici, aucune étape suivante ne doit réinterpréter
 * sa nature (factType), sa quantité, son unité ou son statut de transfert.
 *
 * Aucune invention : ni quantité, ni unité, ni prix, ni prestation.
 */

export type BtpFactType =
  | "billable_work"
  | "technical_annotation"
  | "dimension"
  | "information"
  | "to_confirm";

export type BtpQuantityType =
  | "count"
  | "length"
  | "area"
  | "volume"
  | "time"
  | "package"
  | "unknown";

export type BtpUnit =
  | "u"
  | "ml"
  | "m²"
  | "m³"
  | "h"
  | "jour"
  | "forfait"
  | "ens"
  | null;

export type BtpTransferStatus = "ready" | "pending" | "excluded";

export type ValidatedBtpFact = {
  factId: string;
  lot: string;
  category: string;
  factType: BtpFactType;

  descriptionExact: string;
  evidenceText: string;

  quantity: number | null;
  quantityType: BtpQuantityType;
  unit: BtpUnit;

  clientSupplied: boolean | null;

  transferStatus: BtpTransferStatus;
  technicalReservation: string | null;

  sourceFile: string;
  sourcePage: number | null;
  location: string | null;
  material: string | null;

  /** Motifs déterministes de la décision (diagnostic, jamais affiché comme prix). */
  reasons: string[];
};

export type BtpFactsContract = {
  version: 1;
  facts: ValidatedBtpFact[];
  counts: { ready: number; pending: number; excluded: number; total: number };
};

// ── Utilitaires de lecture tolérante ──────────────────────────────────────

const str = (o: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
};

const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// ── Unités : normalisation typographique STRICTE (aucune conversion) ───────
const UNIT_MAP: Record<string, Exclude<BtpUnit, null>> = {
  "u": "u", "un": "u", "unite": "u", "unité": "u", "unites": "u", "unités": "u",
  "pce": "u", "pièce": "u", "piece": "u", "pièces": "u", "pieces": "u", "nb": "u",
  "ml": "ml", "m/l": "ml", "mL": "ml", "metre lineaire": "ml", "mètre linéaire": "ml",
  "m": "ml", "mètre": "ml", "metre": "ml", "mètres": "ml", "metres": "ml",
  "m2": "m²", "m²": "m²", "m^2": "m²", "metre carre": "m²", "mètre carré": "m²",
  "m3": "m³", "m³": "m³", "m^3": "m³",
  "h": "h", "heure": "h", "heures": "h",
  "j": "jour", "jour": "jour", "jours": "jour", "jr": "jour",
  "forfait": "forfait", "ft": "forfait", "fft": "forfait",
  "ens": "ens", "ensemble": "ens", "ens.": "ens",
};

const QTY_TYPE_BY_UNIT: Record<Exclude<BtpUnit, null>, BtpQuantityType> = {
  u: "count",
  ml: "length",
  "m²": "area",
  "m³": "volume",
  h: "time",
  jour: "time",
  forfait: "package",
  ens: "package",
};

export const normalizeUnit = (raw: unknown): BtpUnit => {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (["?", "-", "null", "n/a", "na", "à définir", "a definir", "indéterminé"].includes(low)) {
    return null;
  }
  return UNIT_MAP[low] ?? UNIT_MAP[s] ?? null;
};

// ── Nature du fait ────────────────────────────────────────────────────────
const ACTION_RE =
  /(d[ée]pose|d[ée]molition|d[ée]construction|pose|poser|installation|installer|cr[ée]ation|cr[ée]er|r[ée]alisation|fourniture|peinture|peindre|enduit|ragr[ée]age|carrelage|rev[êe]tement|cloison|doublage|isolation|pl[âa]trerie|placo|raccordement|remplacement|remplacer|r[ée]fection|r[ée]novation|reprise|ouverture|perc(?:ement|er)|pon[çc]age|rebouchage|scellement|renforcement|coffrage|ferraillage|ma[çc]onnerie|plomberie|[ée]lectricit[ée]|menuiserie|application|traitement|mise\s+en\s+(?:œuvre|oeuvre|place|service)|d[ée]capage|d[ée]capage|fabrication|fabriquer|confection|montage|assemblage|habillage|r[ée]paration|r[ée]parer|branchement)/i;

const ANNOTATION_RE =
  /(^charge\b|\bcharge\s+(?:à|a|de|sur)\b|^cote\b|^section\b|^port[ée]e\b|^longueur\b|^largeur\b|^hauteur\b|^[ée]paisseur\b|^dimension|^calcul|^annotation|^cotation|^rep[èe]re\b|^niveau\b|^descente\s+de\s+charge|^entraxe\b|^\s*[LlHhØø]\s*=)/i;

const DIMENSION_WORD_RE = /\b(longueur|largeur|hauteur|port[ée]e|entraxe|[ée]paisseur)\b/i;

/**
 * Une cote structurelle énoncée EN TÊTE de libellé (« Largeur de reprise de
 * charge », « Portée de poutre », « Section du profilé », « Charge admissible »)
 * décrit une caractéristique technique, jamais une prestation : le fait est une
 * dimension, même si un mot d'action apparaît plus loin dans le libellé.
 */
const LEADING_STRUCTURAL_RE =
  /^\s*(?:la|le|les|l['’])?\s*(largeur|longueur|hauteur|profondeur|[ée]paisseur|port[ée]e|section|charge|surcharge|cote|cotation|entraxe|diam[èe]tre|[øØ]|niveau|dimensions?|reprise\s+de\s+charge|descente\s+de\s+charge|report\s+de\s+charge)\b/i;

const BILLABLE_METRIC_RE =
  /\b(surface|m[èe]tr[ée]|quantit[ée]|lin[ée]aire|à\s+traiter|a\s+traiter|à\s+peindre|a\s+peindre|total)\b/i;


const EQUIPMENT_RE =
  /(\bwc\b|cuvette|lave[- ]mains|lavabo|vasque|douche|baignoire|baln[ée]o|receveur|miroir|paroi\b|robinetterie|mitigeur|radiateur|s[èe]che[- ]serviettes|tablette|portes?\b|fen[êe]tres?|placard|tablette|plinthe|parquet|fa[ïi]ence|niche\b|coffre\b)/i;

const CLIENT_SUPPLIED_RE =
  /(fourni(?:e|es|s)?\s+par\s+(?:le|la|les)?\s*client(?:e|es|s)?\b|fourni(?:e|es|s)?\s+par\s+(?:le\s+)?ma[îi]tre\s+d[’']?ouvrage|fourniture\s+(?:du\s+|de\s+la\s+|par\s+le\s+)?client|fourniture\s+client|(?:à|a)\s+la\s+charge\s+du\s+client|من\s*توريد\s*العميل|العميل\s*يوفر)/i;

const RESERVATION_RE =
  /((?:à|a)\s+v[ée]rifier\s+apr[èe]s\s+sondage|apr[èe]s\s+sondage|caract[èe]re\s+porteur\s+(?:à|a)\s+confirmer|(?:à|a)\s+confirmer\s+sur\s+place|selon\s+(?:le\s+)?plan\s+de\s+l[’']?ing[ée]nieur|suivant\s+plan\s+structure|selon\s+(?:le\s+)?plan\s+structure|sous\s+r[ée]serve)/i;

/** Statuts historiques de l'extraction, conservés en entrée uniquement. */
const LEGACY_EXCLUDED = new Set(["not_transferable", "absent"]);
const LEGACY_PENDING = new Set(["quantity_to_confirm", "lecture_partielle", "a_confirmer", "to_confirm"]);

const classifyFactType = (
  description: string,
  category: string,
  context: string,
  legacyStatus: string,
  hasBillableQuantity: boolean,
): { factType: BtpFactType; reasons: string[] } => {
  const reasons: string[] = [];
  const full = `${description}\n${context}`;
  const cat = category.toLowerCase();

  if (LEGACY_EXCLUDED.has(legacyStatus)) {
    return { factType: "information", reasons: ["legacy_status_excluded"] };
  }

  if (ANNOTATION_RE.test(description) && !ACTION_RE.test(description.slice(0, 30))) {
    return { factType: "technical_annotation", reasons: ["annotation_pattern"] };
  }
  // Cote structurelle en tête de libellé : aucune action de travaux n'est
  // décrite, seul un caractéristique dimensionnelle l'est → non facturable.
  if (LEADING_STRUCTURAL_RE.test(description) && !BILLABLE_METRIC_RE.test(description)) {
    return { factType: "dimension", reasons: ["leading_structural_dimension"] };
  }
  if (/annotation|cote|cotation|caract[ée]ristique|note technique|structure existante/.test(cat) && !ACTION_RE.test(full)) {
    return { factType: "technical_annotation", reasons: ["annotation_category"] };
  }
  if (
    DIMENSION_WORD_RE.test(`${description} ${context}`) &&
    !BILLABLE_METRIC_RE.test(`${description} ${context}`) &&
    !ACTION_RE.test(description)
  ) {
    return { factType: "dimension", reasons: ["dimension_only"] };
  }
  if (ACTION_RE.test(full)) {
    reasons.push("action_detected");
    return { factType: "billable_work", reasons };
  }
  if (hasBillableQuantity && EQUIPMENT_RE.test(full)) {
    reasons.push("equipment_with_quantity");
    return { factType: "billable_work", reasons };
  }
  if (LEGACY_PENDING.has(legacyStatus)) {
    return { factType: "to_confirm", reasons: ["legacy_status_pending"] };
  }
  return { factType: "information", reasons: ["no_action_detected"] };
};

/**
 * Valide et fige un tableau de faits bruts issus de l'extraction IA.
 * Aucune donnée n'est inventée : une quantité ou une unité absente reste nulle
 * et le fait devient « pending » (à confirmer par l'artisan), jamais « ready ».
 */
export const validateBtpFacts = (rawFacts: unknown): BtpFactsContract => {
  const arr = Array.isArray(rawFacts) ? rawFacts : [];
  const facts: ValidatedBtpFact[] = [];

  arr.forEach((entry, i) => {
    if (!entry || typeof entry !== "object") return;
    const f = entry as Record<string, unknown>;

    const descriptionExact = str(f, [
      "descriptionExact", "description", "designation_fr", "designation", "libelle", "label", "title",
    ]);
    if (!descriptionExact) return;

    const evidenceText = str(f, ["evidenceText", "evidence", "preuve", "citation"]) || "";
    const category = str(f, ["category", "categorie", "nature"]) || "";
    const lot = str(f, ["lot", "lotName", "lot_fr"]) || "";
    const material = str(f, ["material", "materiau", "materiel"]);
    const location = str(f, ["location", "localisation", "zone", "piece"]);
    const dimensions = str(f, ["dimensions", "dimension", "cotes"]) || "";
    const sourceFile = str(f, ["sourceFile", "fichier", "file"]) || "";
    const sourcePage = num(f.sourcePage ?? f.page);
    const legacyStatus = (str(f, ["transferStatus", "draftStatus", "status"]) || "").toLowerCase();

    const quantity = num(f.quantity ?? f.quantite ?? f.qty);
    const unit = normalizeUnit(f.unit ?? f.unite);
    // Un équipement explicitement dénombré (4 portes, 1 WC…) reste une
    // prestation même si l'unité n'est pas écrite dans le document : l'unité
    // canonique est résolue plus bas, jamais la quantité.
    const hasBillableQuantity = quantity !== null && quantity > 0;

    const context = `${evidenceText}\n${material ?? ""}\n${location ?? ""}\n${dimensions}\n${category}`;
    const { factType, reasons } = classifyFactType(
      descriptionExact, category, context, legacyStatus, hasBillableQuantity,
    );


    let quantityType: BtpQuantityType = unit ? QTY_TYPE_BY_UNIT[unit] : "unknown";
    const declaredQtyType = (str(f, ["quantityType"]) || "").toLowerCase();
    if (!unit && ["count", "length", "area", "volume", "time", "package"].includes(declaredQtyType)) {
      quantityType = declaredQtyType as BtpQuantityType;
    }


    const haystack = `${descriptionExact}\n${context}`;

    // ── Unité canonique déterministe pour les quantités DÉNOMBRABLES ───────
    // Une prestation facturable dont la quantité est un entier positif et dont
    // la nature est explicitement dénombrable (quantityType « count » ou
    // équipement identifié : porte, tablette, WC, douche, baignoire…) reçoit
    // l'unité canonique « u ». Cette règle ne s'applique JAMAIS à une
    // dimension, une portée, une charge, une section, une longueur isolée ni à
    // une annotation technique : ces faits n'ont pas le type billable_work, ou
    // portent un mot de dimension.
    let resolvedUnit: BtpUnit = unit;
    let resolvedQuantityType: BtpQuantityType = quantityType;
    if (
      resolvedUnit === null &&
      factType === "billable_work" &&
      quantity !== null &&
      quantity > 0 &&
      Number.isInteger(quantity) &&
      !DIMENSION_WORD_RE.test(`${descriptionExact} ${dimensions}`) &&
      (declaredQtyType === "count" || EQUIPMENT_RE.test(haystack))
    ) {
      resolvedUnit = "u";
      resolvedQuantityType = "count";
      reasons.push("countable_unit_canonical_u");
    }

    const hasFinalBillableQuantity =
      quantity !== null && quantity > 0 && resolvedUnit !== null;

    const clientSuppliedFlag =
      f.clientSupplied === true || f.fournitureClient === true || f.suppliedByClient === true;
    const clientSupplied = clientSuppliedFlag || CLIENT_SUPPLIED_RE.test(haystack)
      ? true
      : f.clientSupplied === false
        ? false
        : null;

    const reservationField = str(f, [
      "technicalReservation", "reserveTechnique", "reservation", "reserve",
    ]);
    const reservationMatch = haystack.match(RESERVATION_RE);
    const technicalReservation =
      reservationField ||
      (legacyStatus === "ready_for_draft_with_technical_reservation"
        ? (reservationMatch?.[0]?.trim() ?? "à confirmer sur place")
        : reservationMatch?.[0]?.trim() ?? null);

    let transferStatus: BtpTransferStatus;
    if (factType === "billable_work") {
      if (hasFinalBillableQuantity) {
        transferStatus = "ready";
      } else {
        transferStatus = "pending";
        if (quantity === null || quantity <= 0) reasons.push("quantity_missing");
        if (resolvedUnit === null) reasons.push("unit_missing");
      }
    } else if (factType === "to_confirm") {
      transferStatus = "pending";
    } else {
      transferStatus = "excluded";
    }

    facts.push({
      factId: buildFactId({
        rawId: str(f, ["factId", "id"]),
        sourceFile,
        sourcePage,
        lot,
        category,
        descriptionExact,
        quantity,
        unit: resolvedUnit,
        index: i,
      }),
      lot,
      category,
      factType,
      descriptionExact,
      evidenceText,
      quantity,
      quantityType: resolvedQuantityType,
      unit: resolvedUnit,
      clientSupplied,
      transferStatus,
      technicalReservation,
      sourceFile,
      sourcePage,
      location,
      material,
      reasons,
    });
  });


  const counts = {
    ready: facts.filter((f) => f.transferStatus === "ready").length,
    pending: facts.filter((f) => f.transferStatus === "pending").length,
    excluded: facts.filter((f) => f.transferStatus === "excluded").length,
    total: facts.length,
  };

  return { version: 1, facts, counts };
};

/** Extrait le JSON de faits d'un texte contenant <ANAFYPRO_BTP_FACTS>. */
export const parseFactsBlock = (text: unknown): unknown[] => {
  if (Array.isArray(text)) return text;
  if (text && typeof text === "object") {
    const o = text as Record<string, unknown>;
    if (Array.isArray(o.facts)) return o.facts;
    return [];
  }
  if (typeof text !== "string" || !text.trim()) return [];
  const open = text.indexOf("<ANAFYPRO_BTP_FACTS>");
  const closeIdx = text.indexOf("</ANAFYPRO_BTP_FACTS>");
  const raw = open !== -1
    ? text.slice(open + "<ANAFYPRO_BTP_FACTS>".length, closeIdx === -1 ? undefined : closeIdx)
    : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.facts)) return parsed.facts;
    if (Array.isArray(parsed?.prestations)) return parsed.prestations;
    return [];
  } catch {
    return [];
  }
};

/** Sérialise le contrat au format attendu par les étapes suivantes. */
export const serializeFactsContract = (contract: BtpFactsContract): string =>
  `<ANAFYPRO_BTP_FACTS>${JSON.stringify(contract)}</ANAFYPRO_BTP_FACTS>`;
