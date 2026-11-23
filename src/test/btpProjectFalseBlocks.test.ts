import { describe, it, expect } from "vitest";
import { buildSourceUnits, buildFactEvidence, type VerifiableFact } from "../../supabase/functions/_shared/btpProjectEvidence";
import { evaluateDossierReliability } from "../../supabase/functions/_shared/btpProjectReportGate";

const vf = (o: Partial<VerifiableFact>): VerifiableFact => ({ descriptionExact: "", evidenceText: "", quantity: null, unit: null, material: null, location: null, sourcePage: null, ...o });
/** Propagation complète : fait → preuves → décision de blocage du rapport. */
const decide = (source: string, ...facts: Partial<VerifiableFact>[]) => {
  const units = buildSourceUnits(source);
  const ev = facts.map((f, i) => {
    const v = vf(f);
    return { factId: `f${i}`, factType: "billable_work", role: "principal", transferStatus: "ready", evidence: buildFactEvidence(v, v, units) };
  });
  const rel = evaluateDossierReliability({ complete: true, contract: { facts: ev } });
  return { rel, checks: ev.map((e) => Object.fromEntries(e.evidence.fieldChecks.map((c) => [c.field, c.status]))) };
};
const SRC = "--- Page 1 ---\nPeinture des murs, deux couches, 40 m².\nFourniture et pose de plinthes bois 12 ml.\nHauteur sous plafond 2,50 m.\nPorte intérieure 90 x 210 cm.\nDépose de 4 m² de carrelage au sol.\nPeinture des plafonds 100 m².";

describe("Faux blocages corrigés — propagation jusqu'à la décision", () => {
  it("reformulation de même sens : invérifiable, jamais bloquée", () => {
    const { rel, checks } = decide(SRC, { descriptionExact: "Peinture des murs", evidenceText: "Peinture des murs en deux couches 40 m²", quantity: 40, unit: "m²", sourcePage: 1 });
    expect(checks[0].citation).toBe("unverifiable");
    expect(rel.state).toBe("needs_review");
  });
  it("inversion de mots : invérifiable, jamais bloquée", () => {
    const { rel, checks } = decide(SRC, { descriptionExact: "Pose plinthes bois", evidenceText: "Pose et fourniture de plinthes bois 12 ml", quantity: 12, unit: "ml", sourcePage: 1 });
    expect(checks[0].citation).toBe("unverifiable");
    expect(rel.state).not.toBe("blocked");
  });
  it("ponctuation différente : vérifiée et éligible", () => {
    const { rel, checks } = decide(SRC, { descriptionExact: "Peinture des murs", evidenceText: "Peinture des murs deux couches 40 m2", quantity: 40, unit: "m²", sourcePage: 1 });
    expect(checks[0].citation).toBe("verified");
    expect(rel.state).toBe("eligible");
  });
  it("4 / 6 m² : erreur démontrée, rapport bloqué", () => {
    const { rel, checks } = decide(SRC, { descriptionExact: "Dépose carrelage au sol", evidenceText: "Dépose de 6 m² de carrelage au sol.", quantity: 6, unit: "m²", sourcePage: 1 });
    expect(checks[0].quantity).toBe("demonstrated_error");
    expect(rel.state).toBe("blocked");
  });
  it("100 / 65 m² : erreur démontrée, rapport bloqué", () => {
    const { rel } = decide("--- Page 1 ---\nDépose de 4 m² de carrelage au sol.\nPeinture des plafonds 100 m².", { descriptionExact: "Peinture des plafonds", evidenceText: "Peinture des plafonds 65 m².", quantity: 65, unit: "m²", sourcePage: 1 });
    expect(rel.state).toBe("blocked");
  });
  it("ml au lieu de m² : erreur démontrée, rapport bloqué", () => {
    const { rel, checks } = decide(SRC, { descriptionExact: "Peinture des plafonds", evidenceText: "Peinture des plafonds 100 m².", quantity: 100, unit: "ml", sourcePage: 1 });
    expect(checks[0].unit).toBe("demonstrated_error");
    expect(rel.state).toBe("blocked");
  });
  it("hauteur en mètres : « m » n'est jamais lu comme « ml »", () => {
    const ok = decide(SRC, { descriptionExact: "Hauteur sous plafond", evidenceText: "Hauteur sous plafond 2,50 m.", quantity: 2.5, unit: "m", sourcePage: 1 });
    expect(ok.checks[0].unit).toBe("verified");
    expect(ok.rel.state).toBe("eligible");
    const ml = decide(SRC, { descriptionExact: "Hauteur sous plafond", evidenceText: "Hauteur sous plafond 2,50 m.", quantity: 2.5, unit: "ml", sourcePage: 1 });
    expect(ml.checks[0].unit).toBe("unverifiable");
    expect(ml.rel.state).toBe("needs_review");
  });
  it("dimensions composées : invérifiables, jamais comparées entre elles", () => {
    for (const q of [90, 210]) {
      const { rel, checks } = decide(SRC, { descriptionExact: "Porte intérieure", evidenceText: "Porte intérieure 90 x 210 cm.", quantity: q, unit: "cm", sourcePage: 1 });
      expect(checks[0].quantity).toBe("unverifiable");
      expect(checks[0].unit).toBe("unverifiable");
      expect(rel.state).toBe("needs_review");
    }
  });
  it("citation répétée sans page : invérifiable, jamais vérifiée", () => {
    const { rel, checks } = decide("Pose de faïence 8 m².\nPose de faïence 8 m².", { descriptionExact: "Pose faïence", evidenceText: "Pose de faïence 8 m²", quantity: 8, unit: "m²" });
    expect(checks[0].citation).toBe("unverifiable");
    expect(rel.state).toBe("needs_review");
  });
  it("contradiction réelle entre documents : les deux valeurs restent vérifiées, sans blocage", () => {
    const a = decide("Peinture séjour 25 m².", { descriptionExact: "Peinture séjour", evidenceText: "Peinture séjour 25 m²", quantity: 25, unit: "m²" });
    const b = decide("Peinture séjour 30 m².", { descriptionExact: "Peinture séjour", evidenceText: "Peinture séjour 30 m²", quantity: 30, unit: "m²" });
    expect(a.checks[0].quantity).toBe("verified");
    expect(b.checks[0].quantity).toBe("verified");
    expect(a.rel.state).toBe("eligible");
    expect(b.rel.state).toBe("eligible");
  });
});
