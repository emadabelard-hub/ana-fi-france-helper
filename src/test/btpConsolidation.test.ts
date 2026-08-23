import { describe, it, expect } from "vitest";
import { validateBtpFacts } from "../../supabase/functions/_shared/btpFactsContract";
import { consolidateBtpContracts } from "../../supabase/functions/_shared/btpFactsConsolidation";

const base = (over: Record<string, unknown>) => ({
  sourceFile: "doc.pdf",
  sourcePage: 1,
  lot: "Lot 1",
  category: "travaux",
  evidenceText: "extrait",
  ...over,
});

describe("Consolidation — remapping factId / coveredByFactId", () => {
  it("A. la relation main → included_component reste valide après préfixage", () => {
    const contract = validateBtpFacts([
      base({ id: "A", descriptionExact: "Installation d'un système", quantity: 1, unit: "u", role: "main" }),
      base({ id: "c1", descriptionExact: "Raccordement compris", quantity: 1, unit: "u", role: "included_component", parentRef: "A" }),
    ]);
    const parentBefore = contract.facts[0].factId;
    expect(contract.facts[1].coveredByFactId).toBe(parentBefore);

    const { facts } = consolidateBtpContracts([{ docId: "doc1", contract }]);
    expect(facts[0].factId).toBe(`doc1_${parentBefore}`);
    expect(facts[1].coveredByFactId).toBe(`doc1_${parentBefore}`);
    // La relation pointe toujours vers un factId réellement présent
    expect(facts.some((f) => f.factId === facts[1].coveredByFactId)).toBe(true);
    expect(facts.every((f) => f.sourceDocId === "doc1")).toBe(true);
  });

  it("B. un même factId dans deux documents reste distinct, sans fusion ni addition", () => {
    const raw = [base({ id: "A", descriptionExact: "Pose de cloison", quantity: 12, unit: "ml", role: "main" })];
    const c1 = validateBtpFacts(raw);
    const c2 = validateBtpFacts(raw);
    const { facts, counts } = consolidateBtpContracts([
      { docId: "doc1", contract: c1 },
      { docId: "doc2", contract: c2 },
    ]);
    expect(facts).toHaveLength(2);
    expect(facts[0].factId).not.toBe(facts[1].factId);
    expect(facts.map((f) => f.quantity)).toEqual([12, 12]);
    expect(counts.total).toBe(2);
    expect(new Set(facts.map((f) => f.sourceDocId)).size).toBe(2);
  });

  it("C. un coveredByFactId orphelin est neutralisé, jamais rattaché arbitrairement", () => {
    const contract = validateBtpFacts([
      base({ id: "A", descriptionExact: "Pose de cloison", quantity: 12, unit: "ml", role: "main" }),
    ]);
    contract.facts[0] = { ...contract.facts[0], coveredByFactId: "inexistant" };
    const { facts, notes } = consolidateBtpContracts([{ docId: "doc1", contract }]);
    expect(facts[0].coveredByFactId).toBeNull();
    expect(notes.join(" ")).toMatch(/relation/i);
  });

  it("D. les portions d'un même document se regroupent en conservant leur provenance", () => {
    const c1 = validateBtpFacts([base({ id: "A", descriptionExact: "Dépose de cloison", quantity: 5, unit: "ml", role: "main" })]);
    const c2 = validateBtpFacts([base({ id: "A", descriptionExact: "Pose de doublage", quantity: 8, unit: "m2", role: "main" })]);
    const { facts, counts } = consolidateBtpContracts([
      { docId: "doc1_p1", contract: c1, part: "p1" },
      { docId: "doc1_p2", contract: c2, part: "p2" },
    ]);
    expect(counts.total).toBe(2);
    expect(facts.map((f) => f.sourcePart)).toEqual(["p1", "p2"]);
  });

  it("E. un contrat absent est ignoré sans repli silencieux", () => {
    const contract = validateBtpFacts([base({ id: "A", descriptionExact: "Pose de cloison", quantity: 12, unit: "ml", role: "main" })]);
    const { facts } = consolidateBtpContracts([
      { docId: "doc1", contract: null },
      { docId: "doc2", contract },
    ]);
    expect(facts).toHaveLength(1);
    expect(facts[0].sourceDocId).toBe("doc2");
  });
});
