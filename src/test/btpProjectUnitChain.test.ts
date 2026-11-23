import { describe, it, expect } from "vitest";
import { validateProjectExtraction } from "../../supabase/functions/_shared/btpProjectFactsIntegrity";
import { normalizeUnit } from "../../supabase/functions/_shared/btpFactsContract";
import { buildSourceUnits, buildFactEvidence } from "../../supabase/functions/_shared/btpProjectEvidence";
import { evaluateDossierReliability } from "../../supabase/functions/_shared/btpProjectReportGate";

const SRC = "--- Page 1 ---\nHauteur sous plafond 2,50 m.\nCréation d'une cloison sur une longueur de 6 m.\nFourniture et pose de plinthes 6 ml.\nPeinture des murs 25 m².\nPorte intérieure 90 x 210 cm.\nDépose de 4 m² de carrelage au sol.\nPose de faïence murale.";
const block = (facts: unknown[]) => `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ version: 1, facts })}</ANAFYPRO_BTP_FACTS>`;

/** Extraction simulée → normalisation → intégrité → vérification → décision. */
const chain = (raw: Record<string, unknown>) => {
  const r = validateProjectExtraction(block([{ sourcePage: 1, ...raw }]), { docId: "a", fileName: "d.docx", kind: "docx", text: SRC } as never);
  const f = r.contract.facts[0] as any;
  const ev = buildFactEvidence(raw, { descriptionExact: f.descriptionExact, evidenceText: f.evidenceText ?? "", quantity: f.quantity, unit: f.unit, material: f.material ?? null, location: f.location ?? null, sourcePage: f.sourcePage ?? null }, buildSourceUnits(SRC));
  const rel = evaluateDossierReliability({ complete: true, contract: { facts: [{ factId: f.factId, factType: "billable_work", role: "principal", transferStatus: "ready", evidence: ev }] } });
  return { f, flags: (f.integrityFlags ?? []) as string[], checks: Object.fromEntries(ev.fieldChecks.map((c) => [c.field, c.status])), state: rel.state };
};

describe("Unités « m » — chaîne complète", () => {
  it("normalisation : « m » et « mètre » restent « m », « ml » reste « ml »", () => {
    expect(normalizeUnit("m")).toBe("m");
    expect(normalizeUnit("mètres")).toBe("m");
    expect(normalizeUnit("ml")).toBe("ml");
    expect(normalizeUnit("mètre linéaire")).toBe("ml");
  });
  it("hauteur 2,50 m : conservée en m, vérifiée, éligible", () => {
    const c = chain({ descriptionExact: "Hauteur sous plafond", evidenceText: "Hauteur sous plafond 2,50 m.", quantity: 2.5, unit: "m" });
    expect(c.f.unit).toBe("m");
    expect(c.flags).not.toContain("quantity_evidence_mismatch");
    expect(c.checks.unit).toBe("verified");
    expect(c.state).not.toBe("blocked");
  });
  it("longueur 6 m : conservée en m, jamais bloquée", () => {
    const c = chain({ descriptionExact: "Création d'une cloison", evidenceText: "Création d'une cloison sur une longueur de 6 m.", quantity: 6, unit: "m" });
    expect(c.f.unit).toBe("m");
    expect(c.flags).not.toContain("quantity_evidence_mismatch");
    expect(c.state).not.toBe("blocked");
  });
  it("6 ml explicite : conservé en ml, vérifié, éligible", () => {
    const c = chain({ descriptionExact: "Fourniture et pose de plinthes", evidenceText: "Fourniture et pose de plinthes 6 ml.", quantity: 6, unit: "ml" });
    expect(c.f.unit).toBe("ml");
    expect(c.checks.quantity).toBe("verified");
    expect(c.state).toBe("eligible");
  });
  it("fait « ml » sur source « m » : à vérifier, ni signalé ni bloqué", () => {
    const c = chain({ descriptionExact: "Hauteur sous plafond", evidenceText: "Hauteur sous plafond 2,50 m.", quantity: 3, unit: "ml" });
    expect(c.flags).not.toContain("quantity_evidence_mismatch");
    expect(c.checks.unit).toBe("unverifiable");
    expect(c.state).toBe("needs_review");
  });
  it("surface 25 m² : vérifiée, éligible", () => {
    const c = chain({ descriptionExact: "Peinture des murs", evidenceText: "Peinture des murs 25 m².", quantity: 25, unit: "m²" });
    expect(c.checks.quantity).toBe("verified");
    expect(c.state).toBe("eligible");
  });
  it("dimension 90 × 210 cm : invérifiable, jamais bloquée", () => {
    const c = chain({ descriptionExact: "Porte intérieure", evidenceText: "Porte intérieure 90 x 210 cm.", quantity: 90, unit: "cm" });
    expect(c.checks.quantity).toBe("unverifiable");
    expect(c.state).not.toBe("blocked");
  });
  it("4 m² source contre 6 m² : signalé et bloqué", () => {
    const c = chain({ descriptionExact: "Dépose de carrelage au sol", evidenceText: "Dépose de 4 m² de carrelage au sol.", quantity: 6, unit: "m²" });
    expect(c.flags).toContain("quantity_evidence_mismatch");
    expect(c.checks.quantity).toBe("demonstrated_error");
    expect(c.state).toBe("blocked");
  });
  it("unités incompatibles (m² en source, ml en fait) : bloqué", () => {
    const c = chain({ descriptionExact: "Peinture des murs", evidenceText: "Peinture des murs 25 m².", quantity: 25, unit: "ml" });
    expect(c.checks.unit).toBe("demonstrated_error");
    expect(c.state).toBe("blocked");
  });
  it("unité absente ou ambiguë : aucune unité inventée, jamais bloqué", () => {
    const a = chain({ descriptionExact: "Pose de faïence murale", evidenceText: "Pose de faïence murale.", quantity: 8.5 });
    expect(a.f.unit).toBeNull();
    expect(a.state).not.toBe("blocked");
    const b = chain({ descriptionExact: "Pose de faïence murale", evidenceText: "Pose de faïence murale.", quantity: 8.5, unit: "à définir" });
    expect(b.f.unit).toBeNull();
    expect(b.state).not.toBe("blocked");
  });
});
