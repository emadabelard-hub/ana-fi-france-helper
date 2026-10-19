import { describe, it, expect } from "vitest";
import { auditGlobalAnalysis } from "../../supabase/functions/_shared/btpGlobalAnalysisAudit";
import { validateBtpFacts } from "../../supabase/functions/_shared/btpFactsContract";
import { buildProjectFactsDossier } from "../../supabase/functions/_shared/btpProjectDossier";
import { runGlobalAnalysis, buildGlobalAnalysisMessages } from "../../supabase/functions/_shared/btpGlobalAnalysisPrompt";
import type { DocumentFactsResult } from "../../supabase/functions/_shared/btpDocumentSequence";
import { processDocumentsSequentially, DocumentTooLargeError } from "../../supabase/functions/_shared/btpDocumentSequence";
import { BTP_PROJECT_FACTUAL_EXTRACTION_PROMPT } from "../../supabase/functions/_shared/btpFactualPrompt";

const doc = (name: string, descriptions: string[], quantities = descriptions.map(() => null as number | null)): DocumentFactsResult => ({
  docId: name, fileName: `${name}.docx`, status: "completed", attempts: 1, error: null,
  contract: validateBtpFacts(descriptions.map((descriptionExact, index) => ({
    id: `r${index}`, descriptionExact, quantity: quantities[index], unit: quantities[index] === null ? null : "m²",
    role: "descriptive", sourceFile: `${name}.docx`, sourcePage: 1, evidenceText: descriptionExact,
  }))),
});
const dossier = () => buildProjectFactsDossier([doc("a", ["Accès par la cour", "Horaires : 8 h à 12 h"])]);

describe("Contrôle déterministe du rapport", () => {
  it("citations complètes dédupliquées ; IDs inconnus séparés et faits non cités repérés", () => {
    const d = dossier();
    const [a, b] = d.contract.facts.map(f => f.factId);
    const audit = auditGlobalAnalysis(`[${a}] [${a}] [F99] [d0_a_btp_inconnu] [ILLISIBLE]`, d.contract);
    expect(audit.citedFactIds).toEqual([a]);
    expect(audit.unknownFactIds).toEqual(["F99", "d0_a_btp_inconnu"]);
    expect(audit.unreferencedFactIds).toEqual([b]);
  });
  it("un identifiant inclus dans un faux token ne compte jamais comme une citation valide", () => {
    const d = dossier();
    const id = d.contract.facts[0].factId;
    const result = auditGlobalAnalysis(`[${id}_extra] x${id} [${id.slice(id.indexOf("btp_"))}]`, d.contract);
    expect(result.citedFactIds).toEqual([]);
    expect(result.unreferencedFactIds).toHaveLength(2);
    expect(result.unknownFactIds).toHaveLength(3);
  });
  it("accepte virgules, points-virgules, code inline et ponctuation arabe autour des IDs", () => {
    const d = dossier();
    const [a, b] = d.contract.facts.map(f => f.factId);
    expect(auditGlobalAnalysis(`[\`${a}\`; ${b}]،`, d.contract).citedFactIds).toEqual([a, b]);
  });
  it("un rapport sans référence laisse tous les faits non référencés, sans conclusion sémantique", () => {
    const d = dossier();
    expect(auditGlobalAnalysis("Résumé sans citation", d.contract).unreferencedFactIds).toEqual(d.contract.facts.map(f => f.factId));
  });
  it("signale doublons et liens orphelins sans modifier le contrat", () => {
    const d = dossier();
    d.contract.facts.push({ ...d.contract.facts[0], coveredByFactId: "btp_absent" });
    const before = JSON.stringify(d);
    const audit = auditGlobalAnalysis("", d.contract);
    expect(audit.duplicateFactIds).toEqual([d.contract.facts[0].factId]);
    expect(audit.orphanCoveredByFactIds).toEqual(["btp_absent"]);
    expect(JSON.stringify(d)).toBe(before);
  });
  it("rapport inchangé et diagnostic sauvegardable, un seul appel IA", async () => {
    const d = dossier();
    const text = `Analyse exacte\n[${d.contract.facts[0].factId}]`;
    let calls = 0;
    const before = JSON.stringify(d);
    const result = await runGlobalAnalysis(d, async () => { calls++; return text; });
    expect(calls).toBe(1);
    expect(result.text).toBe(text);
    expect(result.audit?.unreferencedFactIds).toEqual([d.contract.facts[1].factId]);
    expect(JSON.stringify(d)).toBe(before);
  });
  it("needs_chunking : aucun audit d'un rapport inexistant ni second appel IA", async () => {
    let calls = 0;
    const result = await runGlobalAnalysis(dossier(), async () => { calls++; throw new DocumentTooLargeError("413"); });
    expect(result.status).toBe("needs_chunking");
    expect(result.audit).toBeUndefined();
    expect(calls).toBe(1);
  });
  it("document → extraction séquentielle → consolidation → analyse → audit, sans appels supplémentaires", async () => {
    const docs = [
      { docId: "a", fileName: "a.docx", kind: "docx" as const, text: "Cloison séjour : 25 m²" },
      { docId: "b", fileName: "b.docx", kind: "docx" as const, text: "Accès par la cour ; peinture exclue" },
    ];
    const calls: string[] = [];
    let active = 0;
    let maxActive = 0;
    const results = await processDocumentsSequentially(docs, async d => {
      active++; maxActive = Math.max(maxActive, active); calls.push(d.docId);
      await Promise.resolve();
      active--;
      return `<ANAFYPRO_BTP_FACTS>${JSON.stringify({ facts: [{ id: "source", descriptionExact: d.text, quantity: d.docId === "a" ? 25 : null, unit: d.docId === "a" ? "m²" : null, sourceFile: d.fileName, evidenceText: d.text, role: d.docId === "a" ? "main" : "descriptive" }] })}</ANAFYPRO_BTP_FACTS>`;
    }, {}, undefined, BTP_PROJECT_FACTUAL_EXTRACTION_PROMPT);
    expect(calls).toEqual(["a", "b"]);
    expect(maxActive).toBe(1);
    const d = buildProjectFactsDossier(results);
    expect(d.contract.facts.map(f => f.quantity)).toEqual([25, null]);
    let globalCalls = 0;
    const result = await runGlobalAnalysis(d, async () => {
      globalCalls++;
      return d.contract.facts.map(f => `${f.descriptionExact} [${f.factId}]`).join("\n");
    });
    expect(globalCalls).toBe(1);
    expect(result.audit?.unreferencedFactIds).toEqual([]);
    expect(result.audit?.unknownFactIds).toEqual([]);
  });
});

describe("Dossiers fictifs variés — conservation et analyse simulée", () => {
  const scenarios = [
    { name: "quantités contradictoires", docs: [doc("initial", ["Cloison séjour : 25 m²"], [25]), doc("autre", ["Cloison séjour : 30 m²"], [30])], quantities: [25, 30] },
    { name: "modification client non validée", docs: [doc("initial", ["Porte battante prévue"]), doc("client", ["Demande de remplacer la porte battante par une porte coulissante, à confirmer"])], quantities: [null, null] },
    { name: "contraintes et délais sans quantité", docs: [doc("conditions", ["Accès par la cour uniquement", "Travaux entre 8 h et 12 h", "Livraison avant le 12 novembre", "Peinture exclue"])], quantities: [null, null, null, null] },
    { name: "documents complémentaires", docs: [doc("ouvrage", ["Cloison séjour"]), doc("dimensions", ["Surface de la cloison séjour : 25 m²"], [25])], quantities: [null, 25] },
  ];
  for (const s of scenarios) it(s.name, async () => {
    const d = buildProjectFactsDossier(s.docs);
    const expected = s.docs.flatMap(r => r.contract?.facts ?? []);
    expect(d.contract.facts).toHaveLength(expected.length);
    expect(d.contract.facts.map(f => f.descriptionExact)).toEqual(expected.map(f => f.descriptionExact));
    expect(d.contract.facts.map(f => f.evidenceText)).toEqual(expected.map(f => f.evidenceText));
    expect(d.contract.facts.map(f => f.sourceFile)).toEqual(expected.map(f => f.sourceFile));
    expect(d.contract.facts.map(f => f.quantity)).toEqual(s.quantities);
    const sent = buildGlobalAnalysisMessages(d)[1].content;
    for (const f of d.contract.facts) expect(sent).toContain(f.factId);
    const before = JSON.stringify(d);
    let calls = 0;
    const result = await runGlobalAnalysis(d, async () => {
      calls++;
      return d.contract.facts.map(f => `${f.descriptionExact} [${f.factId}]`).join("\n");
    });
    expect(calls).toBe(1);
    expect(result.audit?.unknownFactIds).toEqual([]);
    expect(result.audit?.unreferencedFactIds).toEqual([]);
    expect(JSON.stringify(d)).toBe(before);
  });
});