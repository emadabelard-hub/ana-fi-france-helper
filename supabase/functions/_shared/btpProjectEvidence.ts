/**
 * « Analyser mon projet » — preuves documentaires localisées (P0).
 *
 * Vérification INDÉPENDANTE de la réponse IA : les unités source sont
 * reconstruites par le serveur à partir du texte réellement transmis (jamais à
 * partir d'une déclaration du client ni de l'IA). Chaque champ d'un fait est
 * contrôlé séparément contre UN passage local et non ambigu.
 *
 * Règles :
 *  - aucune valeur n'est corrigée, convertie ni recalculée ; `rawFact` garde
 *    l'objet reçu tel quel ;
 *  - « verified » exige une citation retrouvée dans une seule unité locale ;
 *  - « demonstrated_error » exige un passage local unique et comparable ;
 *  - tout le reste demeure « unverifiable » (jamais présenté comme établi) ;
 *  - une image sans couche texte ne peut jamais être vérifiée automatiquement.
 * Aucun appel IA.
 */

export type FieldStatus = "verified" | "unverifiable" | "demonstrated_error" | "not_applicable";
export type EvidenceField = "citation" | "prestation" | "quantity" | "unit" | "characteristics" | "location";

export type SourceUnit = {
  unitId: string;
  text: string;
  page: number | null;
  kind: "paragraph" | "table_row" | "table_header" | "media";
  table?: number;
  row?: number;
};

export type FieldCheck = {
  field: EvidenceField;
  status: FieldStatus;
  /** Valeur examinée, recopiée du fait (jamais corrigée). */
  value: string | null;
  /** Passage source localisé, recopié tel quel. */
  sourceText?: string;
  unitId?: string;
  method: string;
  reason: string;
};

export type EvidenceSummary = "verified" | "partially_verified" | "unverifiable" | "demonstrated_error";

export type FactEvidence = {
  evidenceVersion: 1;
  /** Objet JSON exact reçu pour ce fait après parsing (copie profonde). */
  rawFact: unknown;
  anchor: { status: "exact" | "located_divergent" | "ambiguous" | "not_found" | "no_text_layer" | "empty_quote";
    unitIds: string[]; page: number | null };
  fieldChecks: FieldCheck[];
  verificationSummary: EvidenceSummary;
};

export type VerifiableFact = {
  descriptionExact: string;
  evidenceText: string;
  quantity: number | null;
  unit: string | null;
  material: string | null;
  location: string | null;
  sourcePage: number | null;
};

// ------------------------------------------------------------ normalisation
export const normEv = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/m²/g, "m2").replace(/m³/g, "m3")
  .replace(/[^\p{L}\p{N},.]+/gu, " ").replace(/(?<!\d)[,.]|[,.](?!\d)/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s: string) => normEv(s).split(" ").filter(Boolean);
const STOP = new Set(["avec", "pour", "dans", "sans", "sous", "les", "des", "une", "aux", "sur", "par", "est", "sont", "selon", "compris", "comprise"]);
const significant = (s: string) => tokens(s).filter((t) => t.length >= 4 && !STOP.has(t) && !/\d/.test(t));

// ------------------------------------------------------------ unités source
/**
 * Découpe le texte transmis en unités localisées. Les repères produits par la
 * lecture locale (« --- Page N --- », « [Tableau k », « Ligne r : »,
 * « En-tête : ») servent à localiser ; ils ne sont jamais des preuves.
 */
export const buildSourceUnits = (text: string | undefined | null): SourceUnit[] => {
  if (typeof text !== "string" || !text.trim()) return [];
  const units: SourceUnit[] = [];
  let page: number | null = null;
  let table: number | null = null;
  let para = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const pg = line.match(/^--- Page (\d+) ---/);
    if (pg) { page = Number(pg[1]); table = null; continue; }
    const tb = line.match(/^\[Tableau (\d+)/);
    if (tb) { table = Number(tb[1]); continue; }
    if (/^\[Fin du tableau \d+\]$/.test(line)) { table = null; continue; }
    const prefix = page !== null ? `p${page}:` : "";
    if (/^\[Image /.test(line)) { units.push({ unitId: `${prefix}m${++para}`, text: line, page, kind: "media" }); continue; }
    const hd = line.match(/^En-tête(?: explicite)? : (.*)$/);
    if (hd && table !== null) { units.push({ unitId: `${prefix}t${table}:h`, text: hd[1], page, kind: "table_header", table }); continue; }
    const row = line.match(/^Ligne (\d+) : (.*)$/);
    if (row && table !== null) {
      units.push({ unitId: `${prefix}t${table}:r${row[1]}`, text: row[2], page, kind: "table_row", table, row: Number(row[1]) });
      continue;
    }
    // Colonnes possibles (PDF, « ‖ ») : chaque segment est une unité distincte, jamais réordonnée.
    const segments = line.split(" ‖ ").map((x) => x.trim()).filter(Boolean);
    const id = `${prefix}l${++para}`;
    if (segments.length > 1) segments.forEach((seg, k) => units.push({ unitId: `${id}c${k + 1}`, text: seg, page, kind: "paragraph" }));
    else units.push({ unitId: id, text: line, page, kind: "paragraph" });
  }
  return units;
};

// ------------------------------------------------------------ mesures
const MEASURE = /(?<![\p{L}\p{N}.,])(\d+(?:[.,]\d+)?)\s*(m2|m3|metres? carres?|metres? lineaires?|ml|m|cm|mm|u|unites?|pieces?|pce|ens|forfaits?|ft|h|heures?|jours?)(?![\p{L}\p{N}])/gu;
const canonicalUnit = (u: string): string => {
  const x = normEv(u);
  if (/^(m2|metres? carres?)$/.test(x)) return "m²";
  if (/^m3$/.test(x)) return "m³";
  if (/^(ml|metres? lineaires?)$/.test(x)) return "ml";
  // « m » seul reste « m » : hauteur, longueur ou linéaire ? Jamais converti sans contexte.
  if (x === "m") return "m";
  if (/^(u|unites?|pieces?|pce)$/.test(x)) return "u";
  if (/^(ens)$/.test(x)) return "ens";
  if (/^(forfaits?|ft)$/.test(x)) return "forfait";
  if (/^(h|heures?)$/.test(x)) return "h";
  if (/^jours?$/.test(x)) return "j";
  return x;
};
export const measuresIn = (text: string) => [...normEv(text).matchAll(MEASURE)]
  .map((m) => ({ value: Number(m[1].replace(",", ".")), unit: canonicalUnit(m[2]), raw: m[0] }));
/** Unités dont l'équivalence ne peut être établie sans contexte (m seul / ml). */
const AMBIGUOUS_UNIT_PAIRS = new Set(["m|ml", "ml|m"]);
const unitsAmbiguous = (a: string, b: string) => AMBIGUOUS_UNIT_PAIRS.has(`${a}|${b}`);
/** Dimensions composées (90 x 210 cm, 2,50 × 1,20 m) : rattachement de chaque valeur non établi. */
const COMPOSITE_DIM = /\d+(?:[.,]\d+)?\s*(?:m|cm|mm)?\s*[x×*]\s*\d+(?:[.,]\d+)?/i;
export const hasCompositeDimension = (text: string) => COMPOSITE_DIM.test(text.toLowerCase());
const AMBIGUOUS_QTY = /\b(environ|approx\w*|estim\w*|minimum|maximum|mini|maxi|entre|jusqu\w*|a confirmer|a peu pres|plus de|moins de|au moins|au plus)\b/;

// ------------------------------------------------------------ ancrage
const containsQuote = (unitText: string, quote: string) => normEv(unitText).includes(quote);

export const resolveFactEvidence = (fact: VerifiableFact, units: SourceUnit[]): FactEvidence["anchor"] & { units: SourceUnit[] } => {
  const quote = normEv(fact.evidenceText || "");
  const page = fact.sourcePage ?? null;
  if (!quote) return { status: "empty_quote", unitIds: [], page, units: [] };
  const textual = units.filter((u) => u.kind !== "media");
  if (textual.length === 0) return { status: "no_text_layer", unitIds: [], page, units: [] };
  const hasPages = textual.some((u) => u.page !== null);
  const scope = hasPages && page !== null ? textual.filter((u) => u.page === page) : textual;
  if (scope.length === 0) return { status: "no_text_layer", unitIds: [], page, units: [] };
  const exact = scope.filter((u) => containsQuote(u.text, quote));
  if (exact.length === 1) return { status: "exact", unitIds: [exact[0].unitId], page: exact[0].page, units: exact };
  if (exact.length > 1) return { status: "ambiguous", unitIds: exact.map((u) => u.unitId), page, units: exact };
  // Citation non retrouvée : recherche d'un passage local unique très proche.
  const q = tokens(fact.evidenceText);
  if (q.length >= 3) {
    const scored = scope.map((u) => {
      const t = new Set(tokens(u.text));
      return { u, score: q.filter((x) => t.has(x)).length / q.length };
    }).sort((a, b) => b.score - a.score);
    const [best, second] = scored;
    if (best && best.score >= 0.7 && (!second || second.score < 0.5)) {
      return { status: "located_divergent", unitIds: [best.u.unitId], page: best.u.page, units: [best.u] };
    }
  }
  return { status: "not_found", unitIds: [], page, units: [] };
};

// ------------------------------------------------------------ champs
const check = (field: EvidenceField, status: FieldStatus, value: string | null, method: string, reason: string, unit?: SourceUnit): FieldCheck =>
  ({ field, status, value, method, reason, ...(unit ? { sourceText: unit.text, unitId: unit.unitId } : {}) });

export const verifyFactFields = (fact: VerifiableFact, units: SourceUnit[]): Omit<FactEvidence, "rawFact" | "evidenceVersion"> => {
  const anchor = resolveFactEvidence(fact, units);
  const unit = anchor.units[0];
  const exact = anchor.status === "exact";
  const located = anchor.status === "exact" || anchor.status === "located_divergent";
  const noAnchorReason = {
    empty_quote: "evidence_empty", no_text_layer: "visual_source_no_independent_text_layer",
    ambiguous: "evidence_found_in_several_units", not_found: "evidence_not_found_locally",
    exact: "", located_divergent: "quote_not_verbatim_in_located_passage",
  }[anchor.status];
  const checks: FieldCheck[] = [];

  // Citation
  if (exact) checks.push(check("citation", "verified", fact.evidenceText, "exact_quote_single_unit", "quote_found_in_single_unit", unit));
  else if (anchor.status === "located_divergent") checks.push(check("citation", "unverifiable", fact.evidenceText, "located_passage_comparison", "quote_not_verbatim_in_located_passage", unit));
  else checks.push(check("citation", "unverifiable", fact.evidenceText || null, "none", noAnchorReason));

  // Prestation
  const desc = significant(fact.descriptionExact);
  if (!exact) checks.push(check("prestation", "unverifiable", fact.descriptionExact, "none", noAnchorReason, located ? unit : undefined));
  else {
    const t = new Set(tokens(unit.text));
    const missing = desc.filter((w) => !t.has(w));
    checks.push(missing.length === 0 && desc.length > 0
      ? check("prestation", "verified", fact.descriptionExact, "all_significant_terms_in_unit", "designation_terms_present_locally", unit)
      : check("prestation", "unverifiable", fact.descriptionExact, "significant_terms", desc.length ? `designation_terms_absent_locally:${missing.join(",")}` : "designation_without_significant_terms", unit));
  }

  // Quantité et unité
  const qtyValue = fact.quantity === null ? null : String(fact.quantity);
  const passageMeasures = located ? measuresIn(unit.text) : [];
  const ambiguousText = located && AMBIGUOUS_QTY.test(normEv(unit.text));
  const compositeDim = located && (hasCompositeDimension(unit.text) || hasCompositeDimension(fact.evidenceText || ""));
  if (fact.quantity === null) checks.push(check("quantity", "not_applicable", null, "none", "no_quantity_in_fact"));
  else if (!located) checks.push(check("quantity", "unverifiable", qtyValue, "none", noAnchorReason));
  else if (ambiguousText) checks.push(check("quantity", "unverifiable", qtyValue, "single_measure_in_unit", "qualified_or_range_quantity", unit));
  else if (compositeDim) checks.push(check("quantity", "unverifiable", qtyValue, "single_measure_in_unit", "composite_dimension_in_unit", unit));
  else if (fact.unit && passageMeasures.length === 1 && unitsAmbiguous(passageMeasures[0].unit, fact.unit)) checks.push(check("quantity", "unverifiable", qtyValue, "single_measure_in_unit", `ambiguous_unit:${passageMeasures[0].unit}`, unit));
  else {
    const sameUnit = fact.unit ? passageMeasures.filter((m) => m.unit === fact.unit) : passageMeasures;
    if (sameUnit.length !== 1 || passageMeasures.length !== 1) {
      checks.push(check("quantity", "unverifiable", qtyValue, "single_measure_in_unit", passageMeasures.length === 0 ? "no_measure_in_unit" : "several_or_other_measures_in_unit", unit));
    } else if (sameUnit[0].value === fact.quantity) {
      checks.push(exact
        ? check("quantity", "verified", qtyValue, "single_measure_in_unit", "quantity_equals_single_local_measure", unit)
        : check("quantity", "unverifiable", qtyValue, "located_passage_comparison", "quote_not_verbatim_in_located_passage", unit));
    } else {
      checks.push(check("quantity", "demonstrated_error", qtyValue, "single_measure_in_unit", `local_measure_differs:${sameUnit[0].raw}`, unit));
    }
  }
  if (!fact.unit) checks.push(check("unit", "not_applicable", null, "none", "no_unit_in_fact"));
  else if (!located) checks.push(check("unit", "unverifiable", fact.unit, "none", noAnchorReason));
  else if (compositeDim) checks.push(check("unit", "unverifiable", fact.unit, "single_measure_in_unit", "composite_dimension_in_unit", unit));
  else if (passageMeasures.length === 1 && unitsAmbiguous(passageMeasures[0].unit, fact.unit)) checks.push(check("unit", "unverifiable", fact.unit, "single_measure_in_unit", `ambiguous_unit:${passageMeasures[0].unit}`, unit));
  else if (passageMeasures.length !== 1) checks.push(check("unit", "unverifiable", fact.unit, "single_measure_in_unit", passageMeasures.length === 0 ? "no_measure_in_unit" : "several_measures_in_unit", unit));
  else if (passageMeasures[0].unit === fact.unit) checks.push(exact
    ? check("unit", "verified", fact.unit, "single_measure_in_unit", "unit_equals_local_measure", unit)
    : check("unit", "unverifiable", fact.unit, "located_passage_comparison", "quote_not_verbatim_in_located_passage", unit));
  else checks.push(check("unit", "demonstrated_error", fact.unit, "single_measure_in_unit", `local_unit_differs:${passageMeasures[0].unit}`, unit));

  // Caractéristiques / localisation : présence textuelle locale uniquement.
  for (const [field, value] of [["characteristics", fact.material], ["location", fact.location]] as const) {
    if (!value) { checks.push(check(field, "not_applicable", null, "none", `no_${field}_in_fact`)); continue; }
    if (!exact) { checks.push(check(field, "unverifiable", value, "none", noAnchorReason)); continue; }
    checks.push(normEv(unit.text).includes(normEv(value))
      ? check(field, "verified", value, "term_in_unit", `${field}_present_locally`, unit)
      : check(field, "unverifiable", value, "term_in_unit", `${field}_not_in_local_unit`, unit));
  }

  const applicable = checks.filter((c) => c.status !== "not_applicable");
  const verificationSummary: EvidenceSummary = applicable.some((c) => c.status === "demonstrated_error") ? "demonstrated_error"
    : applicable.every((c) => c.status === "verified") ? "verified"
    : applicable.some((c) => c.status === "verified") ? "partially_verified" : "unverifiable";
  return { anchor: { status: anchor.status, unitIds: anchor.unitIds, page: anchor.page }, fieldChecks: checks, verificationSummary };
};

const deepCopy = (v: unknown): unknown => { try { return v === undefined ? null : JSON.parse(JSON.stringify(v)); } catch { return null; } };

export const buildFactEvidence = (rawFact: unknown, fact: VerifiableFact, units: SourceUnit[]): FactEvidence => ({
  evidenceVersion: 1, rawFact: deepCopy(rawFact), ...verifyFactFields(fact, units),
});

/** Lecture compatible : un ancien fait sans preuve n'est jamais considéré vérifié. */
export const readFactEvidence = (fact: unknown): FactEvidence | null => {
  const e = (fact as { evidence?: unknown } | null)?.evidence as FactEvidence | undefined;
  return e && e.evidenceVersion === 1 && Array.isArray(e.fieldChecks) ? e : null;
};
