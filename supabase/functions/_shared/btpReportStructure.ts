/** Markdown-only checks. No semantic validation, no model calls. */
export const REPORT_SECTIONS = [
  ['Résumé du projet', 'ملخص المشروع'],
  ['Travaux identifiés', 'الأعمال المحددة', 'الأعمال المحددة حسب البنود', 'الأعمال حسب البنود'],
  ['Quantités et caractéristiques connues', 'الكميات والخصائص المعروفة', 'الكميات والمواصفات المعروفة'],
  ['Concordances entre sources', 'التوافق بين المصادر', 'التطابق بين المصادر', 'التوافقات بين المصادر'],
  ['Contradictions', 'التناقضات'],
  ['Informations manquantes ou illisibles', 'المعلومات الناقصة أو غير المقروءة', 'المعلومات المفقودة أو غير المقروءة'],
  ['Points à confirmer', 'نقاط تحتاج إلى تأكيد', 'نقاط للتأكيد', 'النقاط المطلوب تأكيدها'],
  ['Synthèse pour la préparation du devis', 'خلاصة لإعداد عرض السعر', 'ملخص لإعداد عرض السعر', 'الخلاصة لإعداد عرض السعر'],
] as const;

export const normalizeReportText = (s: string) => s.normalize('NFD')
  .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '').replace(/[أإآ]/g, 'ا')
  .toLowerCase().replace(/[*`_]/g, '').replace(/[^\p{L}\p{N}²³]+/gu, ' ').trim();

export function sectionNumber(line: string): number | null {
  const title = normalizeReportText(line.replace(/^\s*#{1,6}\s*/, '').replace(/^\s*[*_]+/, '')
    .replace(/^\s*[1-8١-٨]\s*[.)、:—-]\s*/, '').replace(/\s*[:：]\s*$/, ''));
  return REPORT_SECTIONS.findIndex(aliases => aliases.some(alias => title === normalizeReportText(alias)
    || (alias === 'Travaux identifiés' && title === 'travaux identifies par lot'))) + 1 || null;
}

export type ReportStructure = { missingSections: number[]; emptySections: number[]; repeatedSections: number[]; verified: boolean };
export function auditReportStructure(text: string): ReportStructure {
  const counts = Array(8).fill(0) as number[];
  const bodies = Array.from({ length: 8 }, () => [] as string[]);
  let current: number | null = null;
  let fenced = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const section = sectionNumber(line);
    if (section) { current = section; counts[section - 1]++; continue; }
    if (current && !/^\s*(?:[-*_=]\s*)+$/.test(line)) bodies[current - 1].push(line);
  }
  const missingSections: number[] = [], emptySections: number[] = [], repeatedSections: number[] = [];
  counts.forEach((count, i) => {
    if (!count) missingSections.push(i + 1);
    if (count > 1) repeatedSections.push(i + 1);
    // A header-only table does not constitute a section body.
    const lines = bodies[i].filter(l => normalizeReportText(l));
    const meaningful = lines.filter((l, index) => !(l.includes('|') && /^\s*\|?[\s:|-]+\|?\s*$/.test(bodies[i][bodies[i].indexOf(l) + 1] ?? '')));
    if (count && meaningful.length === 0) emptySections.push(i + 1);
  });
  return { missingSections, emptySections, repeatedSections,
    verified: !missingSections.length && !emptySections.length && !repeatedSections.length };
}