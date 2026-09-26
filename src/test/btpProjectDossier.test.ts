import { describe, it, expect } from "vitest";
import { validateBtpFacts } from "../../supabase/functions/_shared/btpFactsContract";
import { buildProjectFactsDossier } from "../../supabase/functions/_shared/btpProjectDossier";
import type { DocumentFactsResult } from "../../supabase/functions/_shared/btpDocumentSequence";

const base = (file: string, over: Record<string, unknown>) => ({
  sourceFile: file, sourcePage: 1, lot: "Lot 1", category: "travaux", evidenceText: "extrait", ...over,
});
const raw = (file: string) => [
  base(file, { id: "A", descriptionExact: "Installation d'un système", quantity: 1, unit: "u", role: "main" }),
  base(file, { id: "c1", descriptionExact: "Raccordement compris", quantity: 1, unit: "u", role: "included_component", parentRef: "A" }),
];
const ok = (docId: string, file: string): DocumentFactsResult => ({
  docId, fileName: file, status: "completed", attempts: 1, contract: validateBtpFacts(raw(file)), error: null,
});

describe("Dossier factuel consolidé", () => {
  it("factId identiques entre documents : distincts, relations remappées, aucune fusion", () => {
    const r1 = ok("doc", "a.pdf");
    const r2 = ok("doc", "a.pdf"); // même docId, mêmes faits bruts
    expect(r1.contract!.facts[0].factId).toBe(r2.contract!.facts[0].factId);
    const d = buildProjectFactsDossier([r1, r2]);
    const f = d.contract.facts;
    expect(f).toHaveLength(4);
    expect(new Set(f.map((x) => x.factId)).size).toBe(4);
    expect(f[1].coveredByFactId).toBe(f[0].factId);
    expect(f[3].coveredByFactId).toBe(f[2].factId);
    expect(f.map((x) => x.quantity)).toEqual([1, 1, 1, 1]);
    expect(f[0].sourceDocId).not.toBe(f[2].sourceDocId);
    expect(d.complete).toBe(true);
  });

  it("failed / needs_chunking / absent : aucun fait, statut visible, dossier incomplet", () => {
    const failed: DocumentFactsResult = { docId: "b", fileName: "b.pdf", status: "failed", attempts: 2, contract: validateBtpFacts(raw("b.pdf")), error: "x" };
    const big: DocumentFactsResult = { docId: "c", fileName: "c.pdf", status: "needs_chunking", attempts: 0, contract: null, error: "trop grand" };
    const d = buildProjectFactsDossier([ok("a", "a.pdf"), failed, big, undefined]);
    expect(d.contract.counts.total).toBe(2);
    expect(d.contract.facts.every((x) => x.sourceFile === "a.pdf")).toBe(true);
    expect(d.complete).toBe(false);
    expect(d.missingDocuments.map((m) => m.status)).toEqual(["failed", "needs_chunking", "missing"]);
    expect(d.documents.map((x) => x.contributesFacts)).toEqual([true, false, false, false]);
  });

  it("déterministe : mêmes entrées → même dossier", () => {
    const input = [ok("a", "a.pdf"), ok("b", "b.pdf")];
    expect(JSON.stringify(buildProjectFactsDossier(input))).toBe(JSON.stringify(buildProjectFactsDossier(input)));
  });
});
