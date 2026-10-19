import type { ConsolidatedBtpContract, ConsolidatedBtpFact } from './btpFactsConsolidation.ts';
import type { ProjectFactsDossier } from './btpProjectDossier.ts';
import { auditReportStructure, normalizeReportText as norm, sectionNumber, type ReportStructure } from './btpReportStructure.ts';

export type ValueCheck = {
  factId: string; line: number; field: string;
  status: 'conform' | 'demonstrated_anomaly' | 'unverifiable';
  source?: string; reported?: string; reason: string;
};
/** v1 fields remain available to previously saved consumers. Mention ≠ exploitation. */
export type GlobalAnalysisAudit = {
  version: 1 | 2;
  citedFactIds: string[]; unknownFactIds: string[]; unreferencedFactIds: string[];
  duplicateFactIds: string[]; orphanCoveredByFactIds: string[];
  associatedFactIds?: string[]; mentionedOnlyFactIds?: string[]; ambiguousFactIds?: string[];
  insufficientlyAssociatedFactIds?: string[];
  structure?: ReportStructure; valueChecks?: ValueCheck[];
  generationCompleted?: boolean; referencesChecked?: boolean; documentaryCoverageEvaluated?: boolean;
  semanticFidelityGuaranteed?: false;
  provenance?: { supplementaryDocuments: number; rejectedEntries: number; inconsistentSources: number;
    unverifiedSources: number; partialDocuments: number; dossierIncomplete: boolean; metadataAvailable: boolean;
    incompleteReservationPresent: boolean };
  limitations?: string[];
};

const REFERENCE = /[\p{L}\p{N}_-]+/gu;
const WARNING = /contradic|ne concord|incompat|a confirmer|non verifi|incoher|incomplet|rejet|exclu|non valid|demande|تعارض|تناقض|غير مؤكد|غير معتمد|غير متحقق|مستبعد|طلب|غير مكتمل/;
const isReserved = (text: string) => WARNING.test(norm(text));
const tableCells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim());
const scalar = (v: unknown): string | undefined => typeof v === 'string' || typeof v === 'number' ? String(v) : undefined;
const metaOf = (f: ConsolidatedBtpFact) => f as ConsolidatedBtpFact & { preserved?: Record<string, unknown>; sourceCheck?: string };
const MEASUREMENT = /(?:^|[^\p{L}\p{N}])([0-9]+(?:[.,][0-9]+)?)\s*(m²|m2|m³|m3|mm|cm|ml|m|u|h|jours?|forfait|ens)\b/giu;
function measurements(text: string) {
  return [...text.matchAll(MEASUREMENT)].map(m => ({ value: Number(m[1].replace(',', '.')), unit: m[2].toLowerCase(), raw: `${m[1]} ${m[2]}` }));
}
const unitsEqual = (a: string, b: string) => a === b || (a === 'm²' && b === 'm2') || (a === 'm³' && b === 'm3');

export function auditGlobalAnalysis(text: string, contract: ConsolidatedBtpContract, dossier?: ProjectFactsDossier): GlobalAnalysisAudit {
  const ids = contract.facts.map(f => f.factId), known = new Set(ids);
  const byId = new Map(contract.facts.map(f => [f.factId, f]));
  const candidates = new Set<string>(), associated = new Set<string>(), ambiguous = new Set<string>();
  const valueChecks: ValueCheck[] = [];
  const seen = new Set<string>(), duplicates = new Set<string>();
  for (const id of ids) { if (seen.has(id)) duplicates.add(id); seen.add(id); }
  const lines = text.split(/\r?\n/);
  let headers: string[] = [], fenced = false;
  const addCheck = (f: ConsolidatedBtpFact, line: number, field: string, source: string | undefined, reported: string | undefined, reserved: boolean) => {
    if (!reported || !source) {
      valueChecks.push({ factId: f.factId, line, field, status: 'unverifiable', source, reported, reason: 'no_explicit_comparable_field' }); return;
    }
    valueChecks.push({ factId: f.factId, line, field, source, reported,
      status: norm(source) === norm(reported) ? 'conform' : reserved ? 'unverifiable' : 'demonstrated_anomaly',
      reason: reserved ? 'explicit_reservation' : 'explicit_labeled_field' });
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; headers = []; continue; }
    if (sectionNumber(line)) { headers = []; continue; }
    const tokens = [...line.matchAll(REFERENCE)].map(m => m[0]);
    const found = [...new Set(tokens.filter(t => known.has(t)))];
    tokens.filter(t => t.includes('btp_') || known.has(t)).forEach(t => candidates.add(t));
    for (const bracket of line.matchAll(/\[([^\]\n]+)\]/g)) {
      for (const p of bracket[1].split(/[;,]/)) {
        const id = p.trim().replace(/^`|`$/g, '');
        if (/^F\d+$/i.test(id)) candidates.add(id);
      }
    }
    if (line.includes('|') && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[index + 1] ?? '')) {
      headers = tableCells(line).map(norm); continue;
    }
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) continue;
    if (!line.includes('|')) headers = [];
    let content = line;
    for (const token of tokens) if (token.includes('btp_') || known.has(token) || /^F\d+$/i.test(token)) content = content.replaceAll(token, '');
    const words = norm(content).split(' ').filter(w => /\p{L}/u.test(w));
    const isolated = words.length < 2 || /^(?:faits? sources?|references?|identifiants?|ids?|sources?|مراجع|المراجع|معرفات)\s*$/.test(norm(content));
    if (!found.length || isolated) continue;
    // Multiple references remain row-associated, but cannot be mapped to individual cells reliably.
    if (fenced || /^\s*#/.test(line)) { found.forEach(id => ambiguous.add(id)); continue; }
    found.forEach(id => associated.add(id));
    if (found.length > 1 || found.some(id => duplicates.has(id))) {
      found.forEach(id => { ambiguous.add(id); valueChecks.push({ factId: id, line: index + 1, field: 'association', status: 'unverifiable', reason: 'multiple_source_or_duplicate_reference' }); });
      continue;
    }
    const f = byId.get(found[0]);
    if (!f) continue;
    const cells = headers.length ? tableCells(line) : [];
    const fieldText = (aliases: string[]) => {
      const col = headers.findIndex(h => aliases.some(a => h === norm(a)));
      if (col >= 0 && cells.length === headers.length) return cells[col];
      // Explicit prose labels only; never compare free-standing numbers or infer a room from prose.
      const match = line.match(new RegExp(`(?:${aliases.join('|')})\\s*:\\s*([^;|\\[\\n]+)`, 'iu'));
      return match?.[1].trim();
    };
    const reserved = isReserved(line);
    const qty = fieldText(['Quantité', 'Quantité + unité', 'Quantité et unité', 'الكميات', 'الكمية', 'الكمية والوحدة']);
    const measures = qty ? measurements(qty) : [];
    if (f.quantity !== null && f.unit && measures.length === 1) {
      const m = measures[0];
      const equal = m.value === f.quantity && unitsEqual(f.unit, m.unit);
      valueChecks.push({ factId: f.factId, line: index + 1, field: 'quantity', source: `${f.quantity} ${f.unit}`, reported: m.raw,
        status: equal ? 'conform' : reserved ? 'unverifiable' : 'demonstrated_anomaly', reason: reserved ? 'explicit_reservation' : 'explicit_quantity_field' });
    } else valueChecks.push({ factId: f.factId, line: index + 1, field: 'quantity', status: 'unverifiable', reason: 'no_single_explicit_quantity' });
    const meta = metaOf(f), p = meta.preserved ?? {};
    const fields: [string, string | undefined, string[]][] = [
      ['location', f.location ?? undefined, ['Localisation', 'الموقع']],
      ['dimensions', scalar(p.dimensions ?? p.dimension ?? p.cotes), ['Dimensions', 'الأبعاد']],
      ['characteristic', scalar(p.characteristics ?? p.characteristic ?? p.caracteristiques) ?? f.material ?? undefined, ['Caractéristique', 'Caractéristiques', 'المواصفات', 'الخصائص']],
      ['condition', scalar(p.condition ?? p.conditions), ['Condition', 'Conditions', 'الشروط']],
      ['exclusion', scalar(p.exclusion ?? p.exclusions), ['Exclusion', 'Exclusions', 'الاستثناءات']],
    ];
    for (const [field, source, aliases] of fields) {
      const reported = fieldText(aliases);
      // Free-text inequality is not evidence of false meaning. Location and exact numeric dimensions
      // are comparable; reformulated conditions/characteristics remain unverifiable.
      if (!source && !reported) continue;
      const exact = !!source && !!reported && norm(source) === norm(reported);
      const comparable = field === 'location' || (field === 'dimensions' && source && reported && measurements(source).length === 1 && measurements(reported).length === 1);
      addCheck(f, index + 1, field, source, reported, reserved || (!comparable && !exact));
    }
    const reportedStatus = fieldText(['Statut', 'Status', 'الحالة']);
    const sourceStatus = scalar(p.status);
    if (reportedStatus && sourceStatus) addCheck(f, index + 1, 'status', sourceStatus, reportedStatus, false);
    if (meta.sourceCheck === 'inconsistent' && !reserved) valueChecks.push({ factId: f.factId, line: index + 1, field: 'source', status: 'unverifiable', reason: 'inconsistent_source_without_local_reservation' });
    const sourceContext = norm(`${f.descriptionExact} ${f.evidenceText} ${sourceStatus ?? ''}`);
    const disposition = fieldText(['Décision', 'Prestation', 'Decision', 'القرار']);
    if (disposition && /^(a realiser|validee|approuvee|definitivement validee|معتمد|للتنفيذ)$/.test(norm(disposition))
      && /exclu|non valid|a confirmer|demande|طلب|مستبعد|غير معتمد/.test(sourceContext)) {
      valueChecks.push({ factId: f.factId, line: index + 1, field: 'disposition', status: 'demonstrated_anomaly', source: sourceStatus ?? f.descriptionExact, reported: disposition, reason: 'explicit_unapproved_or_excluded_as_approved' });
    }
  }
  // These categories have no validated factId. Only explicit, verbatim "established fact" labels
  // can establish a confusion; absence of such a pattern never establishes category fidelity.
  let rejectedEntries = 0;
  for (const s of contract.supplementary ?? []) {
    rejectedEntries += s.rejectedEntries?.length ?? 0;
    const records = [...(s.rejectedEntries ?? []), ...Object.values(s.auxiliary ?? {}).flat()];
    for (const record of records) {
      if (!record || typeof record !== 'object') continue;
      const r = record as Record<string, unknown>;
      const raw = r.raw && typeof r.raw === 'object' ? r.raw as Record<string, unknown> : r;
      const description = scalar(raw.descriptionExact ?? raw.description ?? raw.text);
      if (!description) continue;
      lines.forEach((line, index) => {
        if (/^(?:\s*[-*]\s*)?(?:fait etabli|حقيقة مثبتة)\s*:/i.test(norm(line).replace(/^(fait etabli|حقيقة مثبتة) /, '$1: '))
          && norm(line).includes(norm(description)) && !isReserved(line)) {
          valueChecks.push({ factId: `supplementary:${s.docId}`, line: index + 1, field: 'category', status: 'demonstrated_anomaly', source: description, reported: line, reason: s.rejectedEntries?.includes(record) ? 'rejected_entry_as_established_fact' : 'supplementary_as_verified_fact' });
        }
      });
    }
  }
  const mentioned = [...known].filter(id => candidates.has(id));
  const incomplete = dossier?.complete === false;
  return {
    version: 2, citedFactIds: mentioned,
    unknownFactIds: [...candidates].filter(id => !known.has(id)).sort(),
    unreferencedFactIds: [...known].filter(id => !candidates.has(id)),
    duplicateFactIds: [...duplicates],
    orphanCoveredByFactIds: [...new Set(contract.facts.map(f => f.coveredByFactId).filter((id): id is string => !!id && !known.has(id)))],
    associatedFactIds: [...associated], mentionedOnlyFactIds: mentioned.filter(id => !associated.has(id)),
    ambiguousFactIds: [...ambiguous], insufficientlyAssociatedFactIds: [...known].filter(id => !associated.has(id) || ambiguous.has(id)),
    structure: auditReportStructure(text), valueChecks,
    generationCompleted: !!text.trim(), referencesChecked: true, documentaryCoverageEvaluated: true, semanticFidelityGuaranteed: false,
    provenance: { supplementaryDocuments: contract.supplementary?.length ?? 0, rejectedEntries,
      inconsistentSources: contract.facts.filter(f => metaOf(f).sourceCheck === 'inconsistent').length,
      unverifiedSources: contract.facts.filter(f => metaOf(f).sourceCheck !== 'verified').length,
      partialDocuments: dossier?.documents.filter(d => d.partial).length ?? 0,
      dossierIncomplete: incomplete, metadataAvailable: !!dossier,
      incompleteReservationPresent: !incomplete || /incomplet|غير مكتمل|غير مكتملة/.test(norm(text)) },
    limitations: ['Markdown row association is syntactic, not semantic proof.', 'Only explicit labeled values are comparable; prose and multi-source rows remain unverifiable.',
      'Similarity keys never prove equivalence. Supplementary/category checks are limited to explicit labels.'],
  };
}