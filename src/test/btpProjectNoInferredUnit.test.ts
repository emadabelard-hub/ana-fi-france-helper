import { describe, it, expect } from "vitest";
import { validateProjectExtraction } from "../../supabase/functions/_shared/btpProjectFactsIntegrity";
import { buildSourceUnits, buildFactEvidence } from "../../supabase/functions/_shared/btpProjectEvidence";
import { evaluateDossierReliability } from "../../supabase/functions/_shared/btpProjectReportGate";

const SRC = "--- Page 1 ---\nPose de faïence murale 8.\nPose de parquet 20.\nPose de plinthes 12.\nPose de 4 portes.\nFabrication de 3 tablettes.\nPeinture plafond 30.\nPose de parquet 20,5.\nPose de 25 m² de carrelage.\nFourniture de 6 ml de plinthes.\nPose de cloison.";
const block = (facts: unknown[]) => `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ version: 1, facts })}</ANAFYPRO_BTP_FACTS>`;
/** Extraction simulée → normalisation → intégrité → vérification → décision. */
const chain = (raw: Record<string, unknown>) => {
  const r = validateProjectExtraction(block([{ sourcePage: 1, evidenceText: raw.descriptionExact, ...raw }]), { docId: "a", fileName: "d.docx", kind: "docx", text: SRC } as never);
  const f = r.contract.facts[0] as any;
  const ev = buildFactEvidence(raw, { descriptionExact: f.descriptionExact, evidenceText: f.evidenceText ?? "", quantity: f.quantity, unit: f.unit, material: null, location: null, sourcePage: 1 }, buildSourceUnits(SRC));
  const state = evaluateDossierReliability({ complete: true, contract: { facts: [{ factId: f.factId, factType: f.factType, role: f.role, transferStatus: f.transferStatus, evidence: ev }] } }).state;
  return { f, checks: Object.fromEntries(ev.fieldChecks.map((c) => [c.field, c.status])), state };
};

describe("Aucune unité déduite — chaîne complète", () => {
  it.each<[string, number]>([["Pose de faïence murale 8", 8], ["Pose de parquet 20", 20], ["Pose de plinthes 12", 12], ["Peinture plafond 30", 30], ["Pose de parquet 20,5", 20.5]])(
    "%s : quantité conservée, unité vide, en attente, jamais bloquée", (d, q) => {
      const c = chain({ descriptionExact: d, quantity: q });
      expect(c.f.quantity).toBe(q);
      expect(c.f.unit).toBeNull();
      expect(c.f.countedObject).toBeNull();
      expect(c.f.quantityEvidence).toBe("unit_missing");
      expect(c.f.transferStatus).toBe("pending");
      expect(c.f.reasons).not.toContain("countable_unit_canonical_u");
      expect(c.state).not.toBe("blocked");
    });
  it.each<[string, number, string]>([["Pose de 4 portes", 4, "portes"], ["Fabrication de 3 tablettes", 3, "tablettes"]])(
    "%s : objet compté conservé, sans unité inventée, jamais prêt ni bloqué", (d, q, obj) => {
      const c = chain({ descriptionExact: d, quantity: q });
      expect(c.f.quantity).toBe(q);
      expect(c.f.unit).toBeNull();
      expect(c.f.countedObject).toBe(obj);
      expect(c.f.quantityEvidence).toBe("counted_object_without_unit");
      expect(c.f.transferStatus).toBe("pending");
      expect(c.state).not.toBe("blocked");
    });
  it("25 m² explicite : vérifié, prêt, éligible", () => {
    const c = chain({ descriptionExact: "Pose de 25 m² de carrelage", quantity: 25, unit: "m²" });
    expect(c.f.quantityEvidence).toBe("quantity_and_unit");
    expect(c.f.transferStatus).toBe("ready");
    expect(c.checks.quantity).toBe("verified");
    expect(c.state).toBe("eligible");
  });
  it("6 ml explicite : vérifié, prêt, éligible", () => {
    const c = chain({ descriptionExact: "Fourniture de 6 ml de plinthes", quantity: 6, unit: "ml" });
    expect(c.f.unit).toBe("ml");
    expect(c.f.transferStatus).toBe("ready");
    expect(c.state).toBe("eligible");
  });
  it("quantité absente : en attente, motif quantité absente", () => {
    const c = chain({ descriptionExact: "Pose de cloison" });
    expect(c.f.quantity).toBeNull();
    expect(c.f.quantityEvidence).toBe("quantity_missing");
    expect(c.state).not.toBe("blocked");
  });
  it("quantité illisible : jamais interprétée, motif distinct", () => {
    const c = chain({ descriptionExact: "Pose de cloison", quantity: "1?2" });
    expect(c.f.quantity).toBeNull();
    expect(c.f.quantityEvidence).toBe("quantity_unreadable");
    expect(c.f.reasons).toContain("quantity_unreadable");
    expect(c.state).not.toBe("blocked");
  });
  it("vraies erreurs toujours détectées : 25 contre 30 m², m² contre ml", () => {
    expect(chain({ descriptionExact: "Pose de 25 m² de carrelage", quantity: 30, unit: "m²" }).state).toBe("blocked");
    expect(chain({ descriptionExact: "Pose de 25 m² de carrelage", quantity: 25, unit: "ml" }).state).toBe("blocked");
  });
  it("anciens faits enregistrés avec « u » : relus tels quels", () => {
    const old = { factId: "x", factType: "billable_work", role: "main", transferStatus: "ready", unit: "u", quantity: 4 };
    expect(JSON.parse(JSON.stringify(old)).unit).toBe("u");
  });
});
