import { describe, it, expect } from 'vitest';
import { auditGlobalAnalysis } from '../../supabase/functions/_shared/btpGlobalAnalysisAudit';
import { REPORT_SECTIONS } from '../../supabase/functions/_shared/btpReportStructure';
import { validateBtpFacts } from '../../supabase/functions/_shared/btpFactsContract';
import { buildProjectFactsDossier } from '../../supabase/functions/_shared/btpProjectDossier';
import { runGlobalAnalysis } from '../../supabase/functions/_shared/btpGlobalAnalysisPrompt';

const make = (over: Record<string, unknown> = {}) => buildProjectFactsDossier([{ docId: 'a', fileName: 'a.pdf', status: 'completed', attempts: 1, error: null,
  contract: validateBtpFacts([{ descriptionExact: 'Pose de cloison', quantity: 24, unit: 'm²', location: 'chambre', sourceFile: 'a.pdf', evidenceText: 'Pose de cloison chambre 24 m²', ...over }]) }]);
const report = (body: string, arabic = false) => REPORT_SECTIONS.map((names, i) => `## ${i + 1}. ${names[arabic ? 1 : 0]}\n${i === 2 ? body : arabic ? 'لم يتم تحديد أي عنصر.' : 'Aucun élément identifié.'}`).join('\n\n');
const table = (id: string, qty = '24 m²', location = 'chambre') => `| Ouvrage | Localisation | Quantité + unité | Faits sources |\n|---|---|---|---|\n| Pose de cloison | ${location} | ${qty} | [${id}] |`;
const check = (body: (id: string) => string, over: Record<string, unknown> = {}) => {
  const d = make(over); return auditGlobalAnalysis(report(body(d.contract.facts[0].factId)), d.contract, d);
};
const anomalies = (a: ReturnType<typeof auditGlobalAnalysis>) => a.valueChecks?.filter(c => c.status === 'demonstrated_anomaly') ?? [];

describe('Correction n°3 — contrôles génériques sans IA', () => {
  it('1 huit sections et rapport correct sans faux positif', () => { const a = check(table); expect(a.structure?.verified).toBe(true); expect(anomalies(a)).toEqual([]); });
  it('2 section absente', () => { const d = make(); expect(auditGlobalAnalysis(report('Texte.').replace('## 5. Contradictions', '## Autre titre'), d.contract).structure?.missingSections).toEqual([5]); });
  it('3 section vide et 3b répétée', () => { const d = make(); expect(auditGlobalAnalysis(report(''), d.contract).structure?.emptySections).toEqual([3]); expect(auditGlobalAnalysis(report('Texte.') + '\n## 5. Contradictions\nAucune.', d.contract).structure?.repeatedSections).toEqual([5]); });
  it('4 titres arabes', () => { const d = make(); expect(auditGlobalAnalysis(report('معلومات المشروع المعروفة.', true), d.contract).structure?.verified).toBe(true); });
  it('5 constat identifié', () => { const a = check(id => `La cloison est prévue dans la chambre [${id}].`); expect(a.associatedFactIds).toHaveLength(1); });
  it('6 liste isolée sans constat', () => { const a = check(id => `Faits sources : [${id}]`); expect(a.associatedFactIds).toEqual([]); expect(a.mentionedOnlyFactIds).toHaveLength(1); });
  it('7 fait non cité', () => { expect(check(() => 'Aucun élément identifié.').unreferencedFactIds).toHaveLength(1); });
  it('8 référence inconnue et token entier', () => { const a = check(id => `Prestation prévue [${id}_extra] [F999]`); expect(a.unknownFactIds).toHaveLength(2); expect(a.citedFactIds).toEqual([]); });
  it('9 rattachement ambigu à deux faits', () => { const d = make(); d.contract.facts.push({ ...d.contract.facts[0], factId: 'd1_b_btp_other', quantity: 42 }); const a = auditGlobalAnalysis(table(`${d.contract.facts[0].factId}; d1_b_btp_other`), d.contract); expect(a.ambiguousFactIds).toHaveLength(2); expect(anomalies(a)).toEqual([]); });
  it('10 quantité correcte', () => { expect(check(table).valueChecks).toContainEqual(expect.objectContaining({ field: 'quantity', status: 'conform', source: '24 m²' })); });
  it('11 quantité fausse contextualisée', () => { expect(anomalies(check(id => table(id, '42 m²')))).toContainEqual(expect.objectContaining({ field: 'quantity', source: '24 m²', reported: '42 m²' })); });
  it('12 contradiction signalée sans décider la source correcte', () => { const a = check(id => table(id, '42 m²') .replace('Pose de cloison |', 'Contradiction : pose de cloison |')); expect(anomalies(a)).toEqual([]); expect(a.valueChecks).toContainEqual(expect.objectContaining({ field: 'quantity', status: 'unverifiable' })); });
  it('13 localisation incorrecte dans champ explicite', () => { expect(anomalies(check(id => table(id, '24 m²', 'salon')))).toContainEqual(expect.objectContaining({ field: 'location' })); });
  it('14 demande non validée transformée en décision explicite', () => { const a = check(id => `Demande de porte. Décision : validée ; [${id}]`, { descriptionExact: 'Demande de modification non validée' }); expect(anomalies(a)).toContainEqual(expect.objectContaining({ field: 'disposition' })); });
  it('15 exclusion transformée explicitement en prestation', () => { const a = check(id => `Peinture. Décision : à réaliser ; [${id}]`, { descriptionExact: 'Peinture exclue' }); expect(anomalies(a)).toContainEqual(expect.objectContaining({ field: 'disposition' })); });
  it('16 contrainte sans quantité ne nécessite aucune valeur', () => { const a = check(id => `Accès par la cour uniquement [${id}]`, { descriptionExact: 'Accès par la cour uniquement', quantity: null, unit: null }); expect(anomalies(a)).toEqual([]); expect(a.associatedFactIds).toHaveLength(1); });
  it('17 complément non vérifié explicitement présenté comme établi', () => { const d = make(); d.contract.supplementary = [{ docId: 'a', fileName: 'a.pdf', auxiliary: { constraints: [{ text: 'Accès par la cour' }] } }]; const a = auditGlobalAnalysis('Fait établi : Accès par la cour', d.contract, d); expect(anomalies(a)).toContainEqual(expect.objectContaining({ reason: 'supplementary_as_verified_fact' })); });
  it('18 élément rejeté conservé et explicitement présenté comme établi', () => { const d = make(); d.contract.supplementary = [{ docId: 'a', fileName: 'a.pdf', rejectedEntries: [{ raw: { description: 'Peinture jaune' }, reason: 'invalid' }] }]; const a = auditGlobalAnalysis('Fait établi : Peinture jaune', d.contract, d); expect(a.provenance?.rejectedEntries).toBe(1); expect(anomalies(a)[0]?.reason).toBe('rejected_entry_as_established_fact'); });
  it('19 document partiellement lu exige une réserve', () => { const d = make(); d.complete = false; d.documents[0].partial = true; const a = auditGlobalAnalysis(report('Texte.'), d.contract, d); expect(a.provenance?.partialDocuments).toBe(1); expect(a.provenance?.incompleteReservationPresent).toBe(false); expect(auditGlobalAnalysis('DOSSIER DOCUMENTAIRE INCOMPLET\n' + report('Texte.'), d.contract, d).provenance?.incompleteReservationPresent).toBe(true); });
  it('20 ancien dossier sans métadonnées compatible', () => { const d = make(); const a = auditGlobalAnalysis(report(table(d.contract.facts[0].factId)), d.contract); expect(a.provenance?.metadataAvailable).toBe(false); expect(a.semanticFidelityGuaranteed).toBe(false); });
  it('21 rapport long : chaque fait distinct conservé', () => { const d = make(); d.contract.facts = Array.from({ length: 1000 }, (_, i) => ({ ...d.contract.facts[0], factId: `d${i}_btp_unique` })); const a = auditGlobalAnalysis(report(d.contract.facts.map(f => table(f.factId)).join('\n')), d.contract); expect(a.associatedFactIds).toHaveLength(1000); expect(a.unreferencedFactIds).toEqual([]); expect(anomalies(a)).toEqual([]); });
  it('préserve le texte original et un seul appel simulé', async () => { const d = make(); const text = `  ${report(table(d.contract.facts[0].factId))}\n`; let calls = 0; const before = JSON.stringify(d); const r = await runGlobalAnalysis(d, async () => { calls++; return text; }); expect(r.text).toBe(text); expect(calls).toBe(1); expect(JSON.stringify(d)).toBe(before); expect(r.audit?.version).toBe(2); });
  it('nombres libres et paraphrases : vérification impossible plutôt que faux positif', () => { const a = check(id => `42 personnes consultent la cloison [${id}]`); expect(anomalies(a)).toEqual([]); });
  it('source incohérente jamais validée par une citation', () => { const d = make(); Object.assign(d.contract.facts[0], { sourceCheck: 'inconsistent' }); const a = auditGlobalAnalysis(report(table(d.contract.facts[0].factId)), d.contract, d); expect(a.provenance?.inconsistentSources).toBe(1); expect(a.valueChecks).toContainEqual(expect.objectContaining({ field: 'source', status: 'unverifiable' })); });
  it('aucune conversion de quantité pour prouver une erreur', () => { const a = check(id => table(id, '2400 cm')); expect(anomalies(a)).toEqual([]); expect(a.valueChecks).toContainEqual(expect.objectContaining({ reason: 'different_units_no_conversion' })); });
  it('localisation reformulée : ne démontre pas une erreur', () => { expect(anomalies(check(id => table(id, '24 m²', 'pièce chambre')))).toEqual([]); });
  it('dimensions, caractéristique et condition explicites contrôlées sans conversion', () => {
    const d = make(); Object.assign(d.contract.facts[0], { preserved: { dimensions: '2 m', characteristics: 'BA13', condition: 'Accès par la cour' } });
    const id = d.contract.facts[0].factId;
    const a = auditGlobalAnalysis(`Cloison prévue. Dimensions : 3 m ; Caractéristique : BA13 ; Condition : Accès par la cour ; [${id}]`, d.contract, d);
    expect(anomalies(a)).toContainEqual(expect.objectContaining({ field: 'dimensions' }));
    expect(a.valueChecks).toContainEqual(expect.objectContaining({ field: 'characteristic', status: 'conform' }));
    expect(a.valueChecks).toContainEqual(expect.objectContaining({ field: 'condition', status: 'conform' }));
  });
  it('référence en code ou sans crochets : ambiguë, jamais exploitation démontrée', () => {
    const a = check(id => `\`\`\`\nPose de cloison [${id}]\n\`\`\``);
    expect(a.associatedFactIds).toEqual([]); expect(a.ambiguousFactIds).toHaveLength(1);
    const b = check(id => `Pose de cloison ${id}`); expect(b.associatedFactIds).toEqual([]); expect(b.ambiguousFactIds).toHaveLength(1);
  });
  it('dimension reformulée identique : aucune fausse anomalie démontrée', () => {
    const d = make(); Object.assign(d.contract.facts[0], { preserved: { dimensions: '2 m' } });
    const a = auditGlobalAnalysis(`Cloison prévue. Dimensions : Longueur 2 m ; [${d.contract.facts[0].factId}]`, d.contract, d);
    expect(a.valueChecks).toContainEqual(expect.objectContaining({ field: 'dimensions', status: 'unverifiable' }));
    expect(anomalies(a)).toEqual([]);
  });
  it('dimensions avec contexte différent : ne compare pas des nombres seuls', () => {
    const d = make(); Object.assign(d.contract.facts[0], { preserved: { dimensions: 'Longueur 2 m' } });
    const a = auditGlobalAnalysis(`Cloison prévue. Dimensions : Hauteur 3 m ; [${d.contract.facts[0].factId}]`, d.contract, d);
    expect(a.valueChecks).toContainEqual(expect.objectContaining({ field: 'dimensions', status: 'unverifiable' }));
    expect(anomalies(a)).toEqual([]);
  });
  it('dimension simple équivalente avec décimale : conforme sans recalcul', () => {
    const d = make(); Object.assign(d.contract.facts[0], { preserved: { dimensions: '2 m' } });
    const a = auditGlobalAnalysis(`Cloison prévue. Dimensions : 2,0 m ; [${d.contract.facts[0].factId}]`, d.contract, d);
    expect(a.valueChecks).toContainEqual(expect.objectContaining({ field: 'dimensions', status: 'conform', source: '2 m', reported: '2,0 m' }));
    expect(anomalies(a)).toEqual([]);
  });
});