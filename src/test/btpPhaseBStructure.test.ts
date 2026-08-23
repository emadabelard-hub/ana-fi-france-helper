import { describe, it, expect } from "vitest";
import { validateBtpFacts } from "../../supabase/functions/_shared/btpFactsContract";

const base = (over: Record<string, unknown>) => ({
  sourceFile: "doc.pdf",
  sourcePage: 1,
  lot: "Lot 1",
  category: "travaux",
  evidenceText: "extrait",
  ...over,
});

describe("Phase B — structure sémantique observationnelle", () => {
  it("A. un équipement main et ses 5 accessoires en composants inclus", () => {
    const raw = [
      base({ id: "p1", descriptionExact: "Installation d'un système", quantity: 1, unit: "u", role: "main", operation: "installation" }),
      ...Array.from({ length: 5 }, (_, k) =>
        base({ id: `c${k}`, descriptionExact: `Accessoire ${k + 1} compris`, quantity: 1, unit: "u", role: "included_component", parentRef: "p1" }),
      ),
    ];
    const { facts } = validateBtpFacts(raw);
    const parent = facts[0];
    expect(parent.role).toBe("main");
    const children = facts.slice(1);
    expect(children.every((f) => f.role === "included_component")).toBe(true);
    expect(children.every((f) => f.coveredByFactId === parent.factId)).toBe(true);
    // Aucune quantité de composant remontée sur le parent
    expect(parent.quantity).toBe(1);
  });

  it("B. deux types d'équipements donnent deux opérations main distinctes", () => {
    const { facts } = validateBtpFacts([
      base({ id: "a", descriptionExact: "Pose équipement type A", quantity: 2, unit: "u", role: "main" }),
      base({ id: "b", descriptionExact: "Pose équipement type B", quantity: 3, unit: "u", role: "main" }),
    ]);
    expect(facts.filter((f) => f.role === "main")).toHaveLength(2);
    expect(facts[0].factId).not.toBe(facts[1].factId);
    expect(facts.map((f) => f.quantity)).toEqual([2, 3]);
  });

  it("C. ouvrage 4,20 ml main et hauteur 2,50 m descriptive", () => {
    const { facts } = validateBtpFacts([
      base({ id: "o1", descriptionExact: "Création de cloison", quantity: 4.2, unit: "ml", role: "main", scope: "hauteur 2,50 m" }),
      base({ id: "d1", descriptionExact: "Hauteur 2,50 m", role: "descriptive", parentRef: "o1" }),
    ]);
    expect(facts[0].role).toBe("main");
    expect(facts[0].scope).toContain("2,50");
    expect(facts[1].role).toBe("descriptive");
    expect(facts[1].transferStatus).toBe("excluded");
  });

  it("D. fourniture client, pose entreprise", () => {
    const { facts } = validateBtpFacts([
      base({
        id: "d",
        descriptionExact: "Pose d'un appareil fourni par le client",
        quantity: 1,
        unit: "u",
        role: "main",
        includesMaterials: false,
        includesLabor: true,
      }),
    ]);
    expect(facts[0].clientSupplied).toBe(true);
    expect(facts[0].includesMaterials).toBe(false);
    expect(facts[0].includesLabor).toBe(true);
  });

  it("E. raccordements, essais et mise en service rattachés à l'opération principale", () => {
    const { facts } = validateBtpFacts([
      base({ id: "m", descriptionExact: "Installation comprenant raccordements, essais et mise en service", quantity: 1, unit: "u", role: "main" }),
      base({ id: "r", descriptionExact: "Raccordements compris", role: "included_component", parentRef: "m" }),
      base({ id: "e", descriptionExact: "Essais compris", role: "included_component", parentRef: "m" }),
      base({ id: "s", descriptionExact: "Mise en service comprise", role: "included_component", parentRef: "m" }),
    ]);
    expect(facts.slice(1).every((f) => f.coveredByFactId === facts[0].factId)).toBe(true);
  });

  it("parentRef invalide → coveredByFactId null + diagnostic, sans déclassement", () => {
    const { facts } = validateBtpFacts([
      base({ id: "x", descriptionExact: "Pose de carrelage", quantity: 10, unit: "m²", role: "included_component", parentRef: "inconnu" }),
    ]);
    expect(facts[0].coveredByFactId).toBeNull();
    expect(facts[0].reasons).toContain("parent_ref_unresolved");
    expect(facts[0].transferStatus).toBe("ready");
    expect(facts[0].quantity).toBe(10);
    expect(facts[0].unit).toBe("m²");
  });

  it("parentRef pointant vers un fait non main → diagnostic parent_ref_not_main", () => {
    const { facts } = validateBtpFacts([
      base({ id: "desc", descriptionExact: "Hauteur 2,50 m", role: "descriptive" }),
      base({ id: "c", descriptionExact: "Accessoire compris", quantity: 1, unit: "u", role: "included_component", parentRef: "desc" }),
    ]);
    expect(facts[1].coveredByFactId).toBeNull();
    expect(facts[1].reasons).toContain("parent_ref_not_main");
    expect(facts[1].transferStatus).toBe("ready");
  });

  it("lineKey est calculée par le code et ignore toute valeur fournie par l'IA", () => {
    const { facts } = validateBtpFacts([
      base({ id: "k", descriptionExact: "Pose de carrelage", quantity: 10, unit: "m²", operation: "pose", scope: "salle de bain", lineKey: "VALEUR_IA" }),
    ]);
    expect(facts[0].lineKey).toBeTruthy();
    expect(facts[0].lineKey).not.toContain("VALEUR_IA");
    expect(facts[0].lineKey).toContain("pose");
  });

  it("les nouveaux champs ne changent ni le nombre de lignes ni les quantités/unités", () => {
    const raw = [
      base({ id: "1", descriptionExact: "Dépose de cloisons", quantity: 17, unit: "ml" }),
      base({ id: "2", descriptionExact: "Peinture des murs", quantity: 42.5, unit: "m²" }),
    ];
    const before = validateBtpFacts(raw.map(({ ...r }) => r));
    const after = validateBtpFacts(raw.map((r) => ({ ...r, role: "main", operation: "pose", scope: "séjour", parentRef: null })));
    expect(after.counts).toEqual(before.counts);
    expect(after.facts.map((f) => [f.quantity, f.unit, f.transferStatus, f.factType]))
      .toEqual(before.facts.map((f) => [f.quantity, f.unit, f.transferStatus, f.factType]));
  });
});
