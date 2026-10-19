import { describe, it, expect } from "vitest";
import { validateProjectExtraction } from "../../supabase/functions/_shared/btpProjectFactsIntegrity";
import { processDocumentsSequentially, type ProjectDocument } from "../../supabase/functions/_shared/btpDocumentSequence";
import { buildProjectFactsDossier } from "../../supabase/functions/_shared/btpProjectDossier";

const block = (facts: unknown[], aux: Record<string, unknown> = {}) =>
  `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ version: 1, facts, ...aux })}</ANAFYPRO_BTP_FACTS>`;
const TEXT = "Cuisine : pose de carrelage 12 m². Salle de bain : pose de carrelage 12 m². Pas de peinture plafond. Accès par escalier uniquement.";
const doc = (o: Partial<ProjectDocument> = {}): ProjectDocument => ({ docId: "a", fileName: "cctp.pdf", kind: "pdf", text: TEXT, ...o });

describe("Analyser mon projet — intégrité des faits", () => {
  it("contrat mixte : rejets comptés, motivés et conservés", () => {
    const r = validateProjectExtraction(block([
      { id: "f1", descriptionExact: "Pose de carrelage", quantity: 12, unit: "m²", location: "Cuisine", evidenceText: "Cuisine : pose de carrelage 12 m²" },
      "texte libre",
      { id: "f3", quantity: 4 },
    ]), doc());
    expect(r.integrity.received).toBe(3);
    expect(r.integrity.accepted).toBe(1);
    expect(r.integrity.rejected).toBe(2);
    expect(r.integrity.rejectedEntries.map((e) => e.reason)).toEqual(["not_an_object", "no_textual_content"]);
    expect(r.integrity.rejectedEntries[1].rawId).toBe("f3");
    expect(r.integrity.partial).toBe(true);
  });

  it("deux prestations identiques dans deux pièces restent deux faits", () => {
    const r = validateProjectExtraction(block([
      { descriptionExact: "Pose de carrelage", quantity: 12, unit: "m²", location: "Cuisine" },
      { descriptionExact: "Pose de carrelage", quantity: 12, unit: "m²", location: "Salle de bain" },
    ]), doc());
    expect(r.contract.facts).toHaveLength(2);
    expect(new Set(r.contract.facts.map((f) => f.factId)).size).toBe(2);
  });

  it("deux entrées strictement identiques reçoivent des identifiants d'occurrence distincts", () => {
    const e = { id: "x", descriptionExact: "Pose de carrelage", quantity: 12, unit: "m²" };
    const r = validateProjectExtraction(block([e, { ...e }]), doc());
    const ids = r.contract.facts.map((f) => f.factId);
    expect(ids[0]).not.toBe(ids[1]);
    expect((r.contract.facts[1] as any).similarityKey).toBe((r.contract.facts[0] as any).similarityKey);
  });

  it("fait sans quantité conservé sans quantité inventée ; quantité textuelle d'origine gardée", () => {
    const r = validateProjectExtraction(block([
      { descriptionExact: "Pose de plinthes", quantity: null, unit: null },
      { descriptionExact: "Pose de faïence", quantity: "environ 8", unit: "m2" },
    ]), doc());
    expect(r.contract.facts[0].quantity).toBeNull();
    expect(r.contract.facts[0].transferStatus).toBe("pending");
    expect(r.contract.facts[1].quantity).toBeNull();
    expect((r.contract.facts[1] as any).preserved.quantity).toBe("environ 8");
    expect((r.contract.facts[1] as any).preserved.unit).toBe("m2");
  });

  it("dimensions structurées, status et confidence conservés verbatim", () => {
    const dims = { longueur: 3.2, largeur: 2.1, unite: "m" };
    const r = validateProjectExtraction(block([
      { descriptionExact: "Pose de carrelage", quantity: 12, unit: "m²", dimensions: dims, status: "a_confirmer", confidence: 0.7 },
    ]), doc());
    const p = (r.contract.facts[0] as any).preserved;
    expect(p.dimensions).toEqual(dims);
    expect(p.status).toBe("a_confirmer");
    expect(p.confidence).toBe(0.7);
  });

  it("fait ne contenant qu'une contrainte, une exclusion ou une modification : conservé", () => {
    const r = validateProjectExtraction(block([
      { constraint: "Accès par escalier uniquement" },
      { exclusion: "Pas de peinture plafond" },
      { modification: "Le client souhaite déplacer la porte", status: "non_validee" },
    ]), doc());
    expect(r.integrity.rejected).toBe(0);
    expect(r.contract.facts.map((f) => f.descriptionExact)).toEqual([
      "Accès par escalier uniquement", "Pas de peinture plafond", "Le client souhaite déplacer la porte",
    ]);
    expect((r.contract.facts[2] as any).preserved.status).toBe("non_validee");
    expect(r.contract.facts[2].transferStatus).not.toBe("ready");
  });

  it("sources : vérifiée, absente, incohérente (fichier, extrait introuvable), non vérifiable (image)", () => {
    const r = validateProjectExtraction(block([
      { descriptionExact: "Pose de carrelage", evidenceText: "pose de carrelage 12 m²" },
      { descriptionExact: "Pose de carrelage", evidenceText: "" },
      { descriptionExact: "Pose de carrelage", evidenceText: "pose de carrelage", sourceFile: "autre.pdf" },
      { descriptionExact: "Pose de parquet", evidenceText: "pose de parquet 30 m²" },
    ]), doc());
    expect(r.contract.facts.map((f: any) => f.sourceCheck)).toEqual(["verified", "absent", "inconsistent", "inconsistent"]);
    expect(r.contract.facts.every((f) => f.sourceFile === "cctp.pdf")).toBe(true);
    expect((r.contract.facts[2] as any).declaredSourceFile).toBe("autre.pdf");
    const img = validateProjectExtraction(block([{ descriptionExact: "Pose de parquet", evidenceText: "parquet 30 m²" }]),
      doc({ kind: "image", text: undefined, dataUrl: "data:image/png;base64,AAA" }));
    expect((img.contract.facts[0] as any).sourceCheck).toBe("unverifiable");
  });

  it("relations : index numérique implicite refusé, ambiguë et introuvable signalées, explicite résolue", () => {
    const r = validateProjectExtraction(block([
      { id: "p", descriptionExact: "Pose de carrelage", quantity: 12, unit: "m²", role: "main" },
      { id: "c1", descriptionExact: "Pose de joint", role: "included_component", parentRef: "p" },
      { id: "c2", descriptionExact: "Pose de croisillons", role: "included_component", parentRef: "1" },
      { id: "c3", descriptionExact: "Pose de plinthe", role: "included_component", parentRef: "zz" },
      { id: "d", ref: "dup", descriptionExact: "Pose A", role: "main" },
      { id: "e", ref: "dup", descriptionExact: "Pose B", role: "main" },
      { id: "c4", descriptionExact: "Pose de cale", role: "included_component", parentRef: "dup" },
    ]), doc());
    const by = (id: string) => r.contract.facts.find((f: any) => f.rawId === id)!;
    expect(by("c1").coveredByFactId).toBe(by("p").factId);
    expect(by("c2").coveredByFactId).toBeNull();
    expect(by("c2").reasons).toContain("parent_ref_numeric_index_not_accepted");
    expect(by("c3").reasons).toContain("parent_ref_not_found");
    expect(by("c4").coveredByFactId).toBeNull();
    expect(by("c4").reasons).toContain("parent_ref_ambiguous");
    expect(r.integrity.relationIssues).toHaveLength(3);
  });

  it("sections auxiliaires conservées et transmises au dossier", async () => {
    const aux = { project: { name: "Maison X" }, constraints: ["Chantier occupé"], missingInformation: ["Hauteur plafond"], documents: [{ name: "cctp.pdf" }] };
    const [res] = await processDocumentsSequentially([doc()], async () => block([{ descriptionExact: "Pose de carrelage" }], aux));
    expect(res.integrity!.auxiliary).toEqual(aux);
    const dossier = buildProjectFactsDossier([res]);
    expect(dossier.contract.supplementary![0].auxiliary).toEqual(aux);
  });

  it("dossier : rejet → document validé partiellement, dossier incomplet, faits valides conservés", async () => {
    const [res] = await processDocumentsSequentially([doc()], async () => block([{ descriptionExact: "Pose de carrelage" }, 42]));
    const dossier = buildProjectFactsDossier([res]);
    expect(dossier.complete).toBe(false);
    expect(dossier.contract.facts).toHaveLength(1);
    expect(dossier.missingDocuments[0].rejectedEntries).toBe(1);
    expect(dossier.contract.supplementary![0].rejectedEntries).toHaveLength(1);
    expect(dossier.completeness).toMatchObject({ extractionCompleted: 1, factsFullyValidated: 0, exhaustivenessProven: false });
  });

  it("consolidation : deux documents aux identifiants proches ou identiques restent distincts", async () => {
    const same = [{ id: "f1", descriptionExact: "Pose de carrelage", quantity: 12, unit: "m²" }];
    const res = await processDocumentsSequentially(
      [doc({ docId: "a" }), doc({ docId: "a", fileName: "cctp.pdf" }), doc({ docId: "a_d1" })],
      async () => block(same),
    );
    const dossier = buildProjectFactsDossier(res);
    const ids = dossier.contract.facts.map((f) => f.factId);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(dossier.contract.facts.map((f) => f.quantity)).toEqual([12, 12, 12]);
  });

  it("reprise : un document déjà traité n'est jamais rappelé et garde son bilan", async () => {
    const [first] = await processDocumentsSequentially([doc()], async () => block([{ descriptionExact: "Pose de carrelage" }, null]));
    let calls = 0;
    const out = await processDocumentsSequentially([doc(), doc({ docId: "b", fileName: "plan.pdf" })], async () => {
      calls++; return block([{ descriptionExact: "Pose de parquet" }]);
    }, { a: first });
    expect(calls).toBe(1);
    expect(out[0].integrity!.rejected).toBe(1);
  });

  it("anciens résultats sans bilan restent lisibles", () => {
    const dossier = buildProjectFactsDossier([{ docId: "a", fileName: "x.pdf", status: "completed", attempts: 1, error: null,
      contract: { version: 1, facts: [{ factId: "btp_1" } as any], counts: { ready: 0, pending: 0, excluded: 0, total: 1 } } }]);
    expect(dossier.complete).toBe(true);
    expect(dossier.documents[0].validation).toBeNull();
  });
});
