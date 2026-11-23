import { describe, it, expect } from "vitest";
import { buildSourceUnits, verifyFactFields, buildFactEvidence, readFactEvidence, type VerifiableFact } from "../../supabase/functions/_shared/btpProjectEvidence";
import { validateProjectExtraction } from "../../supabase/functions/_shared/btpProjectFactsIntegrity";

const fact = (o: Partial<VerifiableFact>): VerifiableFact => ({ descriptionExact: "", evidenceText: "", quantity: null, unit: null, material: null, location: null, sourcePage: null, ...o });
const status = (r: ReturnType<typeof verifyFactFields>, f: string) => r.fieldChecks.find(c => c.field === f)?.status;
const PDF = "--- Page 4 ---\nDépose de 4 m² de carrelage au sol.\nPeinture des plafonds 100 m².\nMise en place d'une fresque papier peint sur 22 m² en remplacement de la finition peinture.";

describe("Lot 1 — contrat de preuves", () => {
  it("conserve l'objet reçu à l'identique, y compris les null", () => {
    const raw = { descriptionExact: "X", quantity: "6,0", unit: null, extra: { a: [1, null] } };
    const e = buildFactEvidence(raw, fact({ descriptionExact: "X", evidenceText: "X" }), buildSourceUnits("X"));
    expect(e.rawFact).toEqual(raw);
    expect(e.rawFact).not.toBe(raw);
  });
  it("un ancien fait sans preuve n'est jamais lu comme vérifié", () => {
    expect(readFactEvidence({ sourceCheck: "verified" })).toBeNull();
  });
  it("localise pages, tableaux et lignes de façon déterministe", () => {
    const u = buildSourceUnits("--- Page 2 ---\nTitre\n[Tableau 1 — 2 ligne(s)]\nEn-tête explicite : | A | B |\nLigne 1 : | Peinture | 10 m² |\n[Fin du tableau 1]");
    expect(u.map(x => x.unitId)).toEqual(["p2:l1", "p2:t1:h", "p2:t1:r1"]);
  });
});

describe("Lot 3 — contrôle séparé des champs", () => {
  const units = buildSourceUnits(PDF);
  it("Hélène Delaplace : 6 m² au lieu de 4 m² est une erreur démontrée, pas un fait", () => {
    const r = verifyFactFields(fact({ descriptionExact: "Dépose carrelage au sol", evidenceText: "Dépose de 6 m² de carrelage au sol.", quantity: 6, unit: "m²", sourcePage: 4 }), units);
    expect(status(r, "quantity")).toBe("demonstrated_error");
    expect(status(r, "citation")).toBe("demonstrated_error");
    expect(r.verificationSummary).toBe("demonstrated_error");
  });
  it("Hélène Delaplace : « frisette » n'est pas validée contre « fresque »", () => {
    const r = verifyFactFields(fact({ descriptionExact: "Mise en place d'une frisette papier peint", evidenceText: "Mise en place d'une frisette papier peint sur 22 m² en remplacement de la fausse peinture.", quantity: 22, unit: "m²", sourcePage: 4 }), units);
    expect(status(r, "prestation")).toBe("unverifiable");
    expect(status(r, "citation")).toBe("demonstrated_error");
    expect(status(r, "quantity")).not.toBe("verified");
  });
  it("Hélène Delaplace : 65 m² absent de la page n'est pas vérifié", () => {
    const r = verifyFactFields(fact({ descriptionExact: "Enduits plafonds", evidenceText: "Enduits total plafonds et peinture trois couches, couleurs à définir. 65 m².", quantity: 65, unit: "m²", sourcePage: 4 }), units);
    expect(status(r, "quantity")).not.toBe("verified");
  });
  it("valide un fait correct champ par champ", () => {
    const r = verifyFactFields(fact({ descriptionExact: "Dépose carrelage sol", evidenceText: "Dépose de 4 m² de carrelage au sol.", quantity: 4, unit: "m²", material: "carrelage", sourcePage: 4 }), units);
    expect(r.fieldChecks.filter(c => c.status !== "not_applicable").every(c => c.status === "verified")).toBe(true);
    expect(r.anchor.unitIds).toEqual(["p4:l1"]);
  });
  it("citation identique à deux endroits : ambiguë, donc invérifiable", () => {
    const r = verifyFactFields(fact({ descriptionExact: "Peinture murs", evidenceText: "Peinture murs 10 m²", quantity: 10, unit: "m²" }), buildSourceUnits("Peinture murs 10 m²\nPeinture murs 10 m²"));
    expect(r.anchor.status).toBe("ambiguous");
    expect(status(r, "quantity")).toBe("unverifiable");
  });
  it("une quantité voisine sur une autre ligne ne vérifie pas le fait", () => {
    const r = verifyFactFields(fact({ descriptionExact: "Peinture murs", evidenceText: "Peinture des murs", quantity: 30, unit: "m²" }), buildSourceUnits("Peinture des murs\nSurface 30 m²"));
    expect(status(r, "quantity")).toBe("unverifiable");
  });
  it("mauvaise cellule : la ligne du tableau localise la quantité", () => {
    const u = buildSourceUnits("[Tableau 1 — 2 ligne(s)]\nLigne 1 : | Peinture murs | 30 m² |\nLigne 2 : | Peinture plafond | 12 m² |\n[Fin du tableau 1]");
    const r = verifyFactFields(fact({ descriptionExact: "Peinture plafond", evidenceText: "Peinture plafond", quantity: 30, unit: "m²" }), u);
    expect(status(r, "quantity")).toBe("demonstrated_error");
  });
  it("unité incompatible : erreur sur l'unité sans toucher la prestation", () => {
    const r = verifyFactFields(fact({ descriptionExact: "Plinthes bois", evidenceText: "Plinthes bois 12 ml", quantity: 12, unit: "m²" }), buildSourceUnits("Plinthes bois 12 ml"));
    expect(status(r, "unit")).toBe("demonstrated_error");
    expect(status(r, "prestation")).toBe("verified");
  });
  it("localisation absente du passage : invérifiable, jamais vérifiée", () => {
    const r = verifyFactFields(fact({ descriptionExact: "Peinture murs", evidenceText: "Peinture murs 10 m²", quantity: 10, unit: "m²", location: "Chambre 2" }), buildSourceUnits("Peinture murs 10 m²"));
    expect(status(r, "location")).toBe("unverifiable");
    expect(status(r, "quantity")).toBe("verified");
    expect(r.verificationSummary).toBe("partially_verified");
  });
  it("quantité qualifiée (environ) : abstention", () => {
    const r = verifyFactFields(fact({ descriptionExact: "Peinture murs", evidenceText: "Peinture murs environ 10 m²", quantity: 10, unit: "m²" }), buildSourceUnits("Peinture murs environ 10 m²"));
    expect(status(r, "quantity")).toBe("unverifiable");
  });
  it("colonnes PDF (‖) : chaque segment est localisé séparément", () => {
    const u = buildSourceUnits("--- Page 1 ---\nDépose cuisine 10 m² ‖ Enduit couloir 15 m²");
    expect(u.map(x => x.unitId)).toEqual(["p1:l1c1", "p1:l1c2"]);
    const r = verifyFactFields(fact({ descriptionExact: "Enduit couloir", evidenceText: "Enduit couloir 15 m²", quantity: 15, unit: "m²", sourcePage: 1 }), u);
    expect(status(r, "quantity")).toBe("verified");
  });
  it("image sans couche texte : jamais vérifiable automatiquement", () => {
    const r = verifyFactFields(fact({ descriptionExact: "Cloison", evidenceText: "Cloison 3 m", quantity: 3, unit: "ml" }), []);
    expect(r.anchor.status).toBe("no_text_layer");
    expect(r.verificationSummary).toBe("unverifiable");
  });
  it("intégré à validateProjectExtraction sans modifier les valeurs", () => {
    const text = `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ version: 1, facts: [{ factId: "a", descriptionExact: "Dépose carrelage au sol", evidenceText: "Dépose de 6 m² de carrelage au sol.", quantity: 6, unit: "m²", sourcePage: 4, factType: "billable_work" }] })}</ANAFYPRO_BTP_FACTS>`;
    const { contract, integrity } = validateProjectExtraction(text, { fileName: "d.pdf", text: PDF, pageImages: ["data:image/jpeg;base64,AA"], coverage: { totalPages: 8 } });
    const f = contract.facts[0] as any;
    expect(f.quantity).toBe(6);
    expect(f.evidence.rawFact.quantity).toBe(6);
    expect(f.evidence.verificationSummary).toBe("demonstrated_error");
    expect(integrity.evidenceSummary?.demonstrated_error).toBe(1);
  });
});
