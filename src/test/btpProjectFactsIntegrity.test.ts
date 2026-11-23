import { describe, it, expect } from "vitest";
import { validateProjectExtraction, type ProjectFact } from "../../supabase/functions/_shared/btpProjectFactsIntegrity";
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

describe("Phase 1B proposée — quantité et citation, sans correction", () => {
  const flag = "quantity_evidence_mismatch";
  const extract = (evidenceText: string, quantity = 1, unit = "m²", extra: Record<string, unknown> = {}) =>
    validateProjectExtraction(block([{ id: "p1", descriptionExact: "Dépose de carrelage", quantity, unit, evidenceText, ...extra }]), doc({ text: evidenceText }));
  const projectFact = (r: ReturnType<typeof validateProjectExtraction>) => r.contract.facts[0] as ProjectFact;

  it.each<[string, number]>([
    ["Dépose de 4 m² de carrelage", 1],
    ["Pose de cloison de 10 m²", 2],
    ["Peinture de plafonds de 100 m²", 65],
    ["Dépose de 4,5 m² de carrelage", 1],
    ["Dépose de 4.5 m² de carrelage", 1],
  ])("signale l'écart %s, sans remplacer la quantité %s", (quote, quantity) => {
    const r = extract(quote, quantity);
    const f = projectFact(r);
    expect(r.contract.facts).toHaveLength(1);
    expect(f.quantity).toBe(quantity);
    expect(f.unit).toBe("m²");
    expect(f.evidenceText).toBe(quote);
    expect(f.sourceFile).toBe("cctp.pdf");
    expect(f.sourceCheck).toBe("verified");
    expect(f.transferStatus).toBe("ready");
    expect(f.integrityFlags).toContain(flag);
    expect(r.integrity).toMatchObject({ received: 1, accepted: 1, rejected: 0, withAnomalies: 1, partial: false });
  });

  it.each<[string, string, string]>([
    ["Pose de plinthes 4 m", "m", "m"],
    ["Pose de plinthes 4 mètres", "mètre", "m"],
    ["Pose de plinthes 4 mètres linéaires", "ml", "ml"],
    ["Pose de plinthes 4 m/l", "m/l", "ml"],
    ["Dépose de carrelage 4 m2", "m2", "m²"],
    ["Dépose de carrelage 4 m^2", "m^2", "m²"],
    ["Dépose de carrelage 4 mètres carrés", "m²", "m²"],
    ["Pose de portes 4 unités", "u", "u"],
    ["Pose de portes 4 pièces", "pce", "u"],
  ])("compare les unités canoniques de %s", (quote, rawUnit, canonicalUnit) => {
    const r = extract(quote, 1, rawUnit);
    expect(projectFact(r).unit).toBe(canonicalUnit);
    expect(projectFact(r).integrityFlags).toContain(flag);
    expect(projectFact(r).quantity).toBe(1);
  });

  it.each<[string, number]>([
    ["Dépose 4 m²", 4],
    ["Dépose 4,5 m²", 4.5],
    ["Dépose 4.5 m²", 4.5],
    ["Dépose 1250 m²", 1250],
  ])("ne signale pas des valeurs numériquement égales : %s", (quote, quantity) => {
    expect(projectFact(extract(quote, quantity)).integrityFlags).not.toContain(flag);
  });

  it.each([
    "Dépose 1 250 m²", "Dépose 1\u00a0250 m²", "Dépose 1\u202f250 m²",
    "Dépose 1.250,5 m²", "Dépose 1,250.5 m²", "Dépose 1.250 m²", "Dépose 1,250 m²",
    "Dépose 4–6 m²", "Dépose 4-6 m²", "Dépose entre 4 et 6 m²",
    "Dépose environ 4 m²", "Dépose approximativement 4 m²", "Dépose au moins 4 m²",
    "Dépose au plus 4 m²", "Dépose près de 4 m²", "Dépose autour de 4 m²",
    "Dépose 4 m² à confirmer", "Dépose 4 m² ?", "Dépose ~4 m²",
    "Dépose +4 m²", "Dépose -4 m²", "Dépose 4,125 m²",
    "Cloison de 10 cm sur 10 m²", "Dépose 4 m² et 2 hectares", "Dépose BA13 4 m²",
    "Dépose quatre mètres carrés", "Dépose quatre mètres carrés et 4 m²", "Dépose 4 m² et deux cm",
    "Dépose 4 m20", "Dépose 4 m²/h", "Dépose 4 m³",
    "Dépose, hauteur 4 m²", "Dépose, largeur 4 m²", "Dépose, épaisseur 4 m²",
  ])("s'abstient sur une citation ambiguë ou non prise en charge : %s", quote => {
    const r = extract(quote);
    expect(projectFact(r).integrityFlags).not.toContain(flag);
    expect(projectFact(r).quantity).toBe(1);
    expect(projectFact(r).evidenceText).toBe(quote);
    expect(r.contract.facts).toHaveLength(1);
    expect(r.integrity.rejected).toBe(0);
  });

  it("ne compare pas une unité de nature différente, sans conversion", () => {
    const r = extract("Dépose 4 m²", 1, "ml");
    expect(projectFact(r).integrityFlags).not.toContain(flag);
    expect(projectFact(r).unit).toBe("ml");
  });

  it("conserve les faits sans quantité ni citation, sans validation inventée", () => {
    const r = validateProjectExtraction(block([
      { descriptionExact: "Dépose de carrelage", quantity: null, unit: "m²", evidenceText: "Dépose 4 m²" },
      { descriptionExact: "Dépose de carrelage", quantity: 1, unit: "m²", evidenceText: "" },
    ]), doc({ text: "Dépose 4 m²" }));
    expect(r.contract.facts).toHaveLength(2);
    expect(r.contract.facts[0].quantity).toBeNull();
    expect((r.contract.facts[1] as ProjectFact).sourceCheck).toBe("absent");
    expect(r.contract.facts.every(f => !(f as ProjectFact).integrityFlags.includes(flag))).toBe(true);
  });

  it.each(["image", "pdf"] as const)("ne présente pas %s comme une vérification visuelle", kind => {
    const source = kind === "image"
      ? doc({ kind, text: undefined, dataUrl: "data:image/png;base64,AAA" })
      : doc({ kind, text: undefined, pageImages: ["data:image/png;base64,AAA"], coverage: { totalPages: 1, imagePages: [1], unreadPages: [] } });
    const r = validateProjectExtraction(block([{ descriptionExact: "Dépose de carrelage", quantity: 1, unit: "m²", evidenceText: "Dépose 4 m²" }]), source);
    expect(projectFact(r).sourceCheck).toBe("unverifiable");
    expect(projectFact(r).integrityFlags).not.toContain(flag);
    expect(projectFact(r).quantity).toBe(1);
  });

  it("ne compare pas une citation introuvable ou une provenance incohérente", () => {
    const missing = validateProjectExtraction(block([{ descriptionExact: "Dépose de carrelage", quantity: 1, unit: "m²", evidenceText: "Dépose 4 m²" }]), doc({ text: "Pose de parquet" }));
    const wrongFile = extract("Dépose 4 m²", 1, "m²", { sourceFile: "autre.pdf" });
    for (const r of [missing, wrongFile]) {
      expect(projectFact(r).sourceCheck).toBe("inconsistent");
      expect(projectFact(r).integrityFlags).not.toContain(flag);
    }
  });

  it("s'abstient pour une dimension, un composant inclus et une réserve technique", () => {
    const dimension = extract("Hauteur 4 m", 1, "m", { descriptionExact: "Hauteur de cloison" });
    const component = extract("Pose de carrelage 4 m²", 1, "m²", { role: "included_component" });
    const reservation = extract("Dépose 4 m²", 1, "m²", { technicalReservation: "À confirmer sur place" });
    for (const r of [dimension, component, reservation]) {
      expect(projectFact(r).integrityFlags).not.toContain(flag);
      expect(projectFact(r).quantity).toBe(1);
    }
  });

  it("conserve les vrais désaccords entre documents sans inventer un écart à leur propre citation", async () => {
    const sources = [doc({ docId: "a", fileName: "a.docx", kind: "docx", text: "Dépose 4 m²" }), doc({ docId: "b", fileName: "b.docx", kind: "docx", text: "Dépose 1 m²" })];
    const results = await processDocumentsSequentially(sources, async source => block([{ id: "p", descriptionExact: "Dépose de carrelage", quantity: source.docId === "a" ? 4 : 1, unit: "m²", evidenceText: source.text }]));
    const dossier = buildProjectFactsDossier(results);
    expect(dossier.contract.facts.map(f => f.quantity)).toEqual([4, 1]);
    expect(dossier.contract.facts.map(f => f.sourceFile)).toEqual(["a.docx", "b.docx"]);
    expect(dossier.contract.facts.every(f =>
      "integrityFlags" in f &&
      Array.isArray(f.integrityFlags) &&
      f.integrityFlags.every(value => typeof value === "string") &&
      !f.integrityFlags.includes(flag)
    )).toBe(true);
    expect(new Set(dossier.contract.facts.map(f => f.factId)).size).toBe(2);
  });
});
