/**
 * « Analyser mon projet » — intégrité des faits d'UN document.
 *
 * Enveloppe propre au module, posée AUTOUR de `validateBtpFacts()` sans le
 * modifier (contrat partagé avec Smart Devis) :
 *  - bilan déterministe : entrées reçues / acceptées / rejetées / en anomalie ;
 *  - registre des entrées rejetées (jamais supprimées silencieusement) ;
 *  - conservation verbatim des champs non repris par le contrat partagé
 *    (dimensions structurées, status, confidence, quantité/unité d'origine…) ;
 *  - conservation des sections auxiliaires (project, documents, constraints,
 *    missingInformation…) ;
 *  - identifiant d'occurrence unique + empreinte de ressemblance distincte ;
 *  - relations parent résolues uniquement par identifiant explicite ;
 *  - classement de la source : verified / unverifiable / inconsistent / absent.
 * Aucune quantité n'est inventée, convertie ou recalculée. Aucun appel IA.
 */
import { validateBtpFacts, type BtpFactsContract, type ValidatedBtpFact } from "./btpFactsContract.ts";

export type SourceCheck = "verified" | "unverifiable" | "inconsistent" | "absent";

export type ProjectFact = ValidatedBtpFact & {
  /** Identifiant d'occurrence (= factId, garanti unique dans le document). */
  occurrenceId: string;
  /** Empreinte de ressemblance : sert seulement à rapprocher, jamais à fusionner. */
  similarityKey: string;
  /** Position de l'entrée dans la réponse IA (0-based). */
  rawIndex: number;
  /** Identifiant fourni par l'IA, tel quel. */
  rawId: string | null;
  sourceCheck: SourceCheck;
  /** Source déclarée par l'IA lorsqu'elle diffère du document réellement analysé. */
  declaredSourceFile?: string;
  /** Champs d'origine non repris par le contrat partagé, conservés tels quels. */
  preserved?: Record<string, unknown>;
  /** Anomalies déterministes (jamais une correction silencieuse). */
  integrityFlags: string[];
};

export type RejectedEntry = { rawIndex: number; rawId: string | null; reason: string; raw: unknown };

export type ExtractionIntegrity = {
  received: number;
  accepted: number;
  rejected: number;
  withAnomalies: number;
  rejectedEntries: RejectedEntry[];
  /** Sections du bloc autres que `facts`/`version`, conservées telles quelles. */
  auxiliary: Record<string, unknown>;
  sourceChecks: Record<SourceCheck, number>;
  relationIssues: { factId: string; parentRef: string; reason: string }[];
  /** Vrai si au moins une entrée a été rejetée : validation partielle. */
  partial: boolean;
};

export type DocumentRef = {
  fileName: string;
  text?: string;
  dataUrl?: string;
  pageImages?: string[];
  coverage?: { totalPages?: number } | null;
};

// Clés lues par validateBtpFacts (valeur scalaire).
const CONSUMED = new Set([
  "descriptionExact", "description", "designation_fr", "designation", "libelle", "label", "title",
  "evidenceText", "evidence", "preuve", "citation", "category", "categorie", "nature",
  "lot", "lotName", "lot_fr", "material", "materiau", "materiel", "location", "localisation", "zone", "piece",
  "sourceFile", "fichier", "file", "sourcePage", "page", "transferStatus", "draftStatus",
  "quantityType", "clientSupplied", "fournitureClient", "suppliedByClient",
  "technicalReservation", "reserveTechnique", "reservation", "reserve", "factId", "id", "role",
  "operation", "scope", "perimetre", "périmètre", "includesMaterials", "fournitureComprise",
  "includesLabor", "poseComprise", "parentRef", "parent", "parent_ref", "ref", "localRef",
]);
// Clés toujours conservées verbatim (le contrat partagé les transforme ou les perd).
const ALWAYS_PRESERVE = ["dimensions", "dimension", "cotes", "status", "confidence"];
const DESCRIPTION_KEYS = ["descriptionExact", "description", "designation_fr", "designation", "libelle", "label", "title"];
// Texte propre au fait utilisable comme libellé, repris mot pour mot.
const FALLBACK_TEXT_KEYS = ["constraint", "contrainte", "condition", "exclusion", "modification", "request", "demande", "observation", "note", "text", "texte", "content", "contenu"];

const scalar = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : null;
const firstScalar = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) { const s = scalar(o[k]); if (s) return { key: k, value: s }; }
  return null;
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const baseName = (s: string) => norm(s.split(/[\\/]/).pop() ?? s);

const simKey = (f: ValidatedBtpFact) =>
  [norm(f.descriptionExact), norm(f.location ?? ""), f.quantity ?? "", f.unit ?? ""].join("|");

/** Lit l'enveloppe complète du bloc (facts + sections auxiliaires). */
export const readFactsEnvelope = (text: string): { facts: unknown[]; auxiliary: Record<string, unknown> } | null => {
  const open = text.indexOf("<ANAFYPRO_BTP_FACTS>");
  const close = text.indexOf("</ANAFYPRO_BTP_FACTS>");
  if (open === -1 || close === -1 || close < open) return null;
  const inner = text.slice(open + "<ANAFYPRO_BTP_FACTS>".length, close);
  const s = inner.indexOf("{"), e = inner.lastIndexOf("}");
  try {
    const parsed = JSON.parse(inner.slice(s, e + 1));
    if (!parsed || !Array.isArray(parsed.facts)) return null;
    const auxiliary: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k === "facts" || k === "version") continue;
      if (v === null || v === undefined || (Array.isArray(v) && v.length === 0)) continue;
      auxiliary[k] = v;
    }
    return { facts: parsed.facts, auxiliary };
  } catch { return null; }
};

const checkSource = (f: ValidatedBtpFact, declared: string, doc: DocumentRef): { check: SourceCheck; flags: string[] } => {
  const flags: string[] = [];
  if (declared && baseName(declared) !== baseName(doc.fileName)) {
    flags.push("source_file_mismatch");
    return { check: "inconsistent", flags };
  }
  const total = doc.coverage?.totalPages;
  if (f.sourcePage !== null && (f.sourcePage < 1 || (typeof total === "number" && total > 0 && f.sourcePage > total))) {
    flags.push("source_page_out_of_range");
    return { check: "inconsistent", flags };
  }
  const ev = norm(f.evidenceText || "");
  if (!ev) { flags.push("evidence_empty"); return { check: "absent", flags }; }
  const hasImages = !!doc.dataUrl || (Array.isArray(doc.pageImages) && doc.pageImages.length > 0);
  const docText = typeof doc.text === "string" ? norm(doc.text) : "";
  if (docText && docText.includes(ev)) return { check: "verified", flags };
  if (docText && !hasImages) { flags.push("evidence_not_found_in_text"); return { check: "inconsistent", flags }; }
  // Image / scan : une vérification textuelle ne prouverait rien.
  return { check: "unverifiable", flags };
};

export type ProjectExtraction = { contract: BtpFactsContract; integrity: ExtractionIntegrity };

/**
 * Valide une réponse factuelle pour un document. Lève une erreur uniquement si
 * le bloc est absent/illisible ou si AUCUNE entrée n'est exploitable.
 */
export const validateProjectExtraction = (text: string, doc: DocumentRef): ProjectExtraction => {
  const env = readFactsEnvelope(text);
  if (!env) throw new Error("Bloc factuel absent ou illisible.");

  const rejectedEntries: RejectedEntry[] = [];
  const acceptedRaw: Record<string, unknown>[] = [];
  const acceptedMeta: { rawIndex: number; raw: Record<string, unknown>; fallbackKey: string | null }[] = [];

  env.facts.forEach((entry, rawIndex) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      rejectedEntries.push({ rawIndex, rawId: null, reason: "not_an_object", raw: entry });
      return;
    }
    const raw = entry as Record<string, unknown>;
    const rawId = firstScalar(raw, ["factId", "id"])?.value ?? null;
    let copy = { ...raw };
    let fallbackKey: string | null = null;
    if (!firstScalar(raw, DESCRIPTION_KEYS)) {
      const fb = firstScalar(raw, FALLBACK_TEXT_KEYS);
      if (!fb) { rejectedEntries.push({ rawIndex, rawId, reason: "no_textual_content", raw }); return; }
      copy = { ...raw, descriptionExact: fb.value };
      fallbackKey = fb.key;
    }
    // Source : rattachement au document réellement analysé (la déclaration IA est contrôlée, pas reprise).
    copy.sourceFile = doc.fileName;
    acceptedRaw.push(copy);
    acceptedMeta.push({ rawIndex, raw, fallbackKey });
  });

  const base = validateBtpFacts(acceptedRaw);
  if (base.facts.length !== acceptedRaw.length) {
    throw new Error(`Incohérence de validation : ${acceptedRaw.length} entrées acceptées, ${base.facts.length} faits produits.`);
  }

  // Identifiants d'occurrence uniques.
  const seen = new Map<string, number>();
  const facts: ProjectFact[] = base.facts.map((f, k) => {
    const meta = acceptedMeta[k];
    const flags: string[] = [];
    let id = f.factId;
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    if (n > 1) { id = `${f.factId}_o${n}`; flags.push("duplicate_identity_new_occurrence_id"); }
    if (meta.fallbackKey) flags.push(`description_from_${meta.fallbackKey}`);

    const preserved: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(meta.raw)) {
      if (v === null || v === undefined || v === "") continue;
      if (ALWAYS_PRESERVE.includes(key) || !CONSUMED.has(key) || typeof v === "object") preserved[key] = v;
    }
    // Quantité / unité d'origine conservées si le contrat partagé les a perdues ou normalisées.
    for (const key of ["quantity", "quantite", "qty"]) {
      const v = meta.raw[key];
      if (v !== undefined && v !== null && !(typeof v === "number" && v === f.quantity)) preserved[key] = v;
    }
    for (const key of ["unit", "unite"]) {
      const v = meta.raw[key];
      if (typeof v === "string" && v.trim() && v.trim() !== f.unit) preserved[key] = v;
    }
    if (scalar(meta.raw.quantity ?? meta.raw.quantite ?? meta.raw.qty) && f.quantity === null) flags.push("quantity_unparsed_original_kept");

    const declared = scalar(meta.raw.sourceFile ?? meta.raw.fichier ?? meta.raw.file) ?? "";
    const src = checkSource(f, declared, doc);
    flags.push(...src.flags);

    // Le parent sera résolu plus bas, uniquement par identifiant explicite.
    const reasons = f.reasons.filter((r) => r !== "parent_ref_unresolved" && r !== "parent_ref_not_main");
    return {
      ...f, factId: id, coveredByFactId: null, reasons,
      occurrenceId: id, similarityKey: simKey(f), rawIndex: meta.rawIndex, rawId: firstScalar(meta.raw, ["factId", "id"])?.value ?? null,
      sourceCheck: src.check,
      ...(src.flags.includes("source_file_mismatch") ? { declaredSourceFile: declared } : {}),
      ...(Object.keys(preserved).length ? { preserved } : {}),
      integrityFlags: flags,
    };
  });

  // Relations : alias explicites uniquement (aucun index 0/1-based implicite).
  const aliases = new Map<string, number[]>();
  const addAlias = (a: string | null, k: number) => {
    if (!a) return;
    const key = a.trim().toLowerCase();
    const list = aliases.get(key) ?? [];
    if (!list.includes(k)) list.push(k);
    aliases.set(key, list);
  };
  facts.forEach((f, k) => {
    const raw = acceptedMeta[k].raw;
    addAlias(firstScalar(raw, ["factId", "id"])?.value ?? null, k);
    addAlias(firstScalar(raw, ["ref", "localRef"])?.value ?? null, k);
    addAlias(f.factId, k);
  });
  const relationIssues: ExtractionIntegrity["relationIssues"] = [];
  const flagRel = (f: ProjectFact, reason: string) => {
    f.reasons.push(reason); f.integrityFlags.push(reason);
    relationIssues.push({ factId: f.factId, parentRef: f.parentRef ?? "", reason });
  };
  facts.forEach((f, k) => {
    if (!f.parentRef) return;
    const ref = f.parentRef.trim().toLowerCase();
    const matches = (aliases.get(ref) ?? []).filter((m) => m !== k);
    if (matches.length === 0) {
      return flagRel(f, (aliases.get(ref) ?? []).includes(k) ? "parent_ref_self" : /^\d+$/.test(ref) ? "parent_ref_numeric_index_not_accepted" : "parent_ref_not_found");
    }
    if (matches.length > 1) return flagRel(f, "parent_ref_ambiguous");
    const parent = facts[matches[0]];
    if (parent.role !== "main") return flagRel(f, "parent_ref_not_main");
    let cursor: ProjectFact | undefined = parent;
    const visited = new Set([f.factId]);
    const byId = new Map(facts.map((x) => [x.factId, x]));
    while (cursor) {
      if (visited.has(cursor.factId)) return flagRel(f, "parent_ref_cycle");
      visited.add(cursor.factId);
      cursor = cursor.coveredByFactId ? byId.get(cursor.coveredByFactId) : undefined;
    }
    f.coveredByFactId = parent.factId;
  });

  if (facts.length === 0) {
    throw new Error(`Aucune entrée exploitable : ${env.facts.length} reçue(s), ${rejectedEntries.length} rejetée(s).`);
  }

  const sourceChecks: Record<SourceCheck, number> = { verified: 0, unverifiable: 0, inconsistent: 0, absent: 0 };
  facts.forEach((f) => { sourceChecks[f.sourceCheck]++; });
  const integrity: ExtractionIntegrity = {
    received: env.facts.length,
    accepted: facts.length,
    rejected: rejectedEntries.length,
    withAnomalies: facts.filter((f) => f.integrityFlags.length > 0).length,
    rejectedEntries,
    auxiliary: env.auxiliary,
    sourceChecks,
    relationIssues,
    partial: rejectedEntries.length > 0,
  };
  return { contract: { version: 1, facts, counts: base.counts }, integrity };
};
