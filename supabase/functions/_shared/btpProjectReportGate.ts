/**
 * « Analyser mon projet » — garde de fiabilité documentaire (P0).
 *
 * Fonctions pures, déterministes, sans appel IA et sans réécriture de texte :
 *  - evaluateDossierReliability : fiabilité du dossier, distincte de `complete` ;
 *  - validateReportClaims       : assertions chiffrées du rapport sans référence ;
 *  - evaluateReportRelease      : autorise ou refuse la restitution « validée ».
 * Un refus n'est jamais une erreur fournisseur : aucune relance n'en découle.
 */
import type { GlobalAnalysisAudit } from "./btpGlobalAnalysisAudit.ts";
import { readFactEvidence, measuresIn, type EvidenceField } from "./btpProjectEvidence.ts";
import { normalizeReportText, sectionNumber } from "./btpReportStructure.ts";

export const DOCUMENTARY_RELIABILITY_BLOCKED = "DOCUMENTARY_RELIABILITY_BLOCKED";

export type ReliabilityState = "eligible" | "needs_review" | "blocked";

export type DossierReliability = {
  version: 1;
  state: ReliabilityState;
  essentialFacts: number;
  essentialFullyVerified: number;
  demonstratedErrorFactIds: string[];
  unverifiedEssentialFactIds: string[];
  legacyFactIds: string[];
  fieldCounts: Record<EvidenceField, Record<string, number>>;
  reasons: string[];
};

type FactLike = { factId: string; factType?: string; role?: string; transferStatus?: string; evidence?: unknown };
type DossierLike = { complete: boolean; contract: { facts: FactLike[] }; documents?: { structureIssues?: string[] }[] };

const ESSENTIAL_FIELDS: EvidenceField[] = ["citation", "prestation", "quantity", "unit"];
const FIELDS: EvidenceField[] = ["citation", "prestation", "quantity", "unit", "characteristics", "location"];

/** Fait essentiel : prestation de travaux principale (définit la portée du projet). */
export const isEssentialFact = (f: FactLike) => f.factType === "billable_work" && f.role !== "descriptive" && f.transferStatus !== "excluded";

export const evaluateDossierReliability = (dossier: DossierLike): DossierReliability => {
  const fieldCounts = Object.fromEntries(FIELDS.map((f) => [f, {} as Record<string, number>])) as DossierReliability["fieldCounts"];
  const errors = new Set<string>(), unverified = new Set<string>(), legacy = new Set<string>();
  let essential = 0, full = 0;
  for (const f of dossier.contract.facts ?? []) {
    const ev = readFactEvidence(f);
    if (ev) for (const c of ev.fieldChecks) fieldCounts[c.field][c.status] = (fieldCounts[c.field][c.status] ?? 0) + 1;
    if (!isEssentialFact(f)) continue;
    essential++;
    if (!ev) { legacy.add(f.factId); continue; }
    const checks = ev.fieldChecks.filter((c) => ESSENTIAL_FIELDS.includes(c.field) && c.status !== "not_applicable");
    if (checks.some((c) => c.status === "demonstrated_error")) errors.add(f.factId);
    else if (checks.every((c) => c.status === "verified")) full++;
    else unverified.add(f.factId);
  }
  const reasons: string[] = [];
  if (errors.size) reasons.push("essential_field_demonstrated_error");
  if (unverified.size) reasons.push("essential_field_unverified");
  if (legacy.size) reasons.push("documentary_verification_not_established");
  if (!dossier.complete) reasons.push("dossier_incomplete");
  if ((dossier.documents ?? []).some((d) => (d.structureIssues ?? []).length > 0)) reasons.push("ambiguous_source_structure");
  if (essential === 0) reasons.push("no_essential_fact");
  const state: ReliabilityState = errors.size > 0 ? "blocked" : reasons.length === 0 ? "eligible" : "needs_review";
  return { version: 1, state, essentialFacts: essential, essentialFullyVerified: full,
    demonstratedErrorFactIds: [...errors], unverifiedEssentialFactIds: [...unverified], legacyFactIds: [...legacy], fieldCounts, reasons };
};

/**
 * Lignes du rapport qui affirment une mesure sans référence de fait connue :
 * assertions non contrôlables. La recherche ne valide rien par elle-même.
 */
export const validateReportClaims = (text: string, knownFactIds: string[]): { unsourcedMeasureLines: number[] } => {
  const known = new Set(knownFactIds);
  const out: number[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (sectionNumber(line) || /^\s*#/.test(line)) return;
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) return;
    if (measuresIn(line).length === 0) return;
    const refs = [...line.matchAll(/[\p{L}\p{N}_-]+/gu)].map((m) => m[0]).filter((t) => known.has(t));
    if (refs.length === 0 && normalizeReportText(line).length > 0) out.push(i + 1);
  });
  return { unsourcedMeasureLines: out };
};

export type ReportRelease = {
  version: 1;
  /** Vrai seulement si le rapport peut être présenté comme fiable. */
  approved: boolean;
  reliability: ReliabilityState;
  reasons: string[];
  unsourcedMeasureLines: number[];
};

export const evaluateReportRelease = (text: string, reliability: DossierReliability, audit: GlobalAnalysisAudit | undefined, knownFactIds: string[]): ReportRelease => {
  const reasons = reliability.state === "eligible" ? [] : [`reliability_${reliability.state}`, ...reliability.reasons];
  const claims = validateReportClaims(text, knownFactIds);
  if (claims.unsourcedMeasureLines.length) reasons.push("unsourced_measure_claims");
  if (!audit) reasons.push("audit_missing");
  else {
    if (audit.structure && !audit.structure.verified) reasons.push("report_structure_not_verified");
    if ((audit.unknownFactIds ?? []).length) reasons.push("unknown_references");
    if ((audit.valueChecks ?? []).some((c) => c.status === "demonstrated_anomaly")) reasons.push("report_value_anomaly");
    if ((audit.valueChecks ?? []).some((c) => c.status === "unverifiable" && c.field === "quantity")) reasons.push("report_quantity_unverifiable");
    if ((audit.ambiguousFactIds ?? []).length) reasons.push("ambiguous_report_references");
  }
  return { version: 1, approved: reasons.length === 0, reliability: reliability.state, reasons: [...new Set(reasons)], unsourcedMeasureLines: claims.unsourcedMeasureLines };
};
