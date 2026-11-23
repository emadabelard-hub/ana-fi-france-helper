import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { validateProjectExtraction } from "../../supabase/functions/_shared/btpProjectFactsIntegrity";
import { buildProjectFactsDossier } from "../../supabase/functions/_shared/btpProjectDossier";
import { runGlobalAnalysis } from "../../supabase/functions/_shared/btpGlobalAnalysisPrompt";
import { evaluateDossierReliability, evaluateReportRelease, validateReportClaims, DOCUMENTARY_RELIABILITY_BLOCKED } from "../../supabase/functions/_shared/btpProjectReportGate";
import { isPartiallyCovered } from "../../supabase/functions/_shared/btpDocumentSequence";
import { REPORT_SECTIONS } from "../../supabase/functions/_shared/btpReportStructure";
import { CORPUS, type CorpusDoc } from "./fixtures/project-reliability/corpus";

const extract = (d: CorpusDoc) => validateProjectExtraction(
  `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ version: 1, facts: d.facts })}</ANAFYPRO_BTP_FACTS>`,
  { fileName: d.fileName, text: d.text, pageImages: d.pageImages, coverage: d.coverage as any });
const result = (d: CorpusDoc) => ({ docId: d.id, fileName: d.fileName, status: "completed" as const, attempts: 1, error: null, coverage: (d.coverage ?? null) as any, ...extract(d) });

/** Classement d'un document : refusé si erreur démontrée ou rien de vérifié ; partiel si réserve. */
const classify = (d: CorpusDoc) => {
  const { contract } = extract(d);
  const sums = contract.facts.map((f: any) => f.evidence.verificationSummary as string);
  const causes = new Set<string>();
  contract.facts.forEach((f: any) => f.evidence.fieldChecks.filter((c: any) => c.status !== "verified" && c.status !== "not_applicable")
    .forEach((c: any) => causes.add(`${c.field}:${c.status}:${c.reason.split(":")[0]}`)));
  const coverage = d.coverage as any;
  if (isPartiallyCovered(coverage)) causes.add("coverage:unread_or_untransmitted_content");
  if (coverage?.structureIssues?.length) causes.add(`structure:${coverage.structureIssues.join(",")}`);
  const cls = sums.includes("demonstrated_error") || sums.every(s => s === "unverifiable") ? "refused"
    : sums.every(s => s === "verified") && !isPartiallyCovered(coverage) && !coverage?.structureIssues?.length ? "verified" : "partial";
  return { cls, causes: [...causes] };
};

describe("Corpus annoté — bilan de vérification", () => {
  const rows = CORPUS.map(d => ({ d, ...classify(d) }));
  it.each(rows.map(r => [r.d.id, r.d.label, r] as const))("%s %s : classement attendu", (_id, _l, r) => {
    expect(r.cls).toBe(r.d.expected);
  });
  it("écrit le bilan chiffré", () => {
    const count = (c: string) => rows.filter(r => r.cls === c).length;
    const lines = [`verified=${count("verified")} partial=${count("partial")} refused=${count("refused")} total=${rows.length}`,
      ...rows.map(r => `${r.d.id}\t${r.cls}\t${r.d.label}\t${r.causes.join(" ; ") || "—"}`)];
    mkdirSync("/tmp/p0", { recursive: true });
    writeFileSync("/tmp/p0/bilan-corpus.tsv", lines.join("\n"));
    expect(count("verified") + count("partial") + count("refused")).toBe(CORPUS.length);
  });
  it("zéro fausse contradiction certaine : deux versions vérifiées restent deux faits distincts", () => {
    const d = buildProjectFactsDossier([result(CORPUS[9]), result(CORPUS[10])]);
    expect(d.contract.facts.map(f => f.quantity).sort()).toEqual([25, 30]);
    expect(d.reliability?.demonstratedErrorFactIds).toEqual([]);
  });
});

const sections = REPORT_SECTIONS.map((s, i) => `## ${i + 1}. ${s[0]}\nContenu.`).join("\n");

describe("Lot 4 — garde avant génération", () => {
  it("complétude technique ≠ fiabilité : dossier complet mais bloqué", () => {
    const d = buildProjectFactsDossier([result(CORPUS[11])]);
    expect(d.complete).toBe(true);
    expect(d.reliability?.state).toBe("blocked");
    expect(d.contract.facts.map(f => f.quantity)).toEqual([6, 22]);
  });
  it("bloqué : zéro appel global, arrêt déterministe, faits conservés", async () => {
    const d = buildProjectFactsDossier([result(CORPUS[0]), result(CORPUS[11])]);
    let calls = 0;
    const r = await runGlobalAnalysis(d, async () => { calls++; return sections; });
    expect(calls).toBe(0);
    expect(r.failureCode).toBe(DOCUMENTARY_RELIABILITY_BLOCKED);
    expect(r.text).toBeNull();
    expect(d.contract.facts.length).toBe(4);
  });
  it("invérifiable (scan) : appel unique autorisé, rapport jamais approuvé", async () => {
    const d = buildProjectFactsDossier([result(CORPUS[5])]);
    expect(d.reliability?.state).toBe("needs_review");
    let calls = 0;
    const r = await runGlobalAnalysis(d, async () => { calls++; return sections; });
    expect(calls).toBe(1);
    expect(r.release?.approved).toBe(false);
    expect(r.text).toBe(sections);
  });
  it("ancien dossier sans preuves : vérification documentaire non établie", () => {
    const rel = evaluateDossierReliability({ complete: true, contract: { facts: [{ factId: "x", factType: "billable_work", role: "main", transferStatus: "ready" }] } });
    expect(rel.state).toBe("needs_review");
    expect(rel.reasons).toContain("documentary_verification_not_established");
  });
});

describe("Lot 5 — contrôle du texte avant restitution", () => {
  const d = buildProjectFactsDossier([result(CORPUS[0])]);
  const ids = d.contract.facts.map(f => f.factId);
  it("une quantité sans référence empêche l'approbation, texte inchangé", async () => {
    const text = `${sections}\nSurface totale estimée : 140 m²`;
    const r = await runGlobalAnalysis(d, async () => text);
    expect(r.text).toBe(text);
    expect(r.release?.approved).toBe(false);
    expect(r.release?.reasons).toContain("unsourced_measure_claims");
  });
  it("dossier entièrement vérifié et rapport sourcé : approuvé", async () => {
    const text = `${sections}\n| Prestation | Quantité | Réf |\n|---|---|---|\n| Dépose | 4 m² | [${ids[0]}] |`;
    expect(d.reliability?.state).toBe("eligible");
    const r = await runGlobalAnalysis(d, async () => text);
    expect(validateReportClaims(text, ids).unsourcedMeasureLines).toEqual([]);
    expect(r.release?.reasons).toEqual([]);
    expect(r.release?.approved).toBe(true);
  });
  it("sans audit : jamais approuvé", () => {
    expect(evaluateReportRelease(sections, d.reliability!, undefined, ids).approved).toBe(false);
  });
});
