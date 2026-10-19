import { useMemo } from 'react';
import { auditGlobalAnalysis, type GlobalAnalysisAudit } from '../../../supabase/functions/_shared/btpGlobalAnalysisAudit';
import type { ProjectFactsDossier } from '../../../supabase/functions/_shared/btpProjectDossier';

type Props = { text: string; audit?: GlobalAnalysisAudit; dossier?: ProjectFactsDossier; isRTL: boolean };
/** Existing reports are checked locally only when their saved diagnostic predates v2. */
export default function ProjectReportDiagnostics({ text, audit: saved, dossier, isRTL }: Props) {
  const audit = useMemo(() => saved?.version === 2 ? saved : dossier?.contract?.facts
    ? auditGlobalAnalysis(text, dossier.contract, dossier) : saved, [text, saved, dossier]);
  const T = isRTL ? {
    generated: 'تم إنشاء التقرير — لم يتم تعديل النص.', verified: 'الأقسام الثمانية موجودة وغير فارغة.',
    missing: 'أقسام غير موجودة', empty: 'أقسام فارغة', repeated: 'أقسام مكررة',
    checks: 'المراجع مفحوصة؛ لا يضمن الفحص الآلي صحة المعنى.',
    old: 'هذا تقرير سابق؛ لا تتوفر بيانات كافية لإجراء جميع الفحوص الجديدة.',
    details: 'تفاصيل الفحص', unreferenced: 'معلومات دون مرجع', mentioned: 'معرفات مذكورة دون بيان مرتبط',
    ambiguous: 'مراجع تحتاج إلى توضيح', unknown: 'مراجع غير معروفة', anomalies: 'اختلافات مثبتة في حقول صريحة',
    unverifiable: 'حقول لا يمكن التحقق منها آليًا', rejected: 'عناصر رُفضت عند التحقق الأولي',
    supplementary: 'مستندات تحتوي على معلومات إضافية غير معتمدة كحقائق', sources: 'مصادر غير متسقة',
    partial: 'مستندات مقروءة جزئيًا', reservation: 'التقرير لا يذكر بوضوح أن الملف غير مكتمل.',
    limit: 'ربط المرجع بالسطر لا يثبت استخدام المعلومة أو صحة تفسيرها. المقارنة تقتصر على الحقول الصريحة.',
    line: 'سطر', fields: { quantity: 'الكمية', location: 'الموقع', dimensions: 'الأبعاد', characteristic: 'المواصفات', condition: 'الشرط', exclusion: 'الاستثناء', status: 'الحالة', disposition: 'القرار', category: 'نوع المعلومة', source: 'المصدر' } as Record<string, string>,
  } : {
    generated: 'Rapport généré — texte conservé sans modification.', verified: 'Les huit sections sont présentes et non vides.',
    missing: 'Sections absentes', empty: 'Sections vides', repeated: 'Sections répétées',
    checks: 'Références contrôlées ; la fidélité sémantique n’est pas garantie automatiquement.',
    old: 'Rapport antérieur : les données disponibles ne permettent pas tous les nouveaux contrôles.',
    details: 'Détails du contrôle', unreferenced: 'Faits sans référence', mentioned: 'Identifiants mentionnés sans constat associé',
    ambiguous: 'Références à clarifier', unknown: 'Références inconnues', anomalies: 'Écarts démontrés dans des champs explicites',
    unverifiable: 'Champs non vérifiables automatiquement', rejected: 'Éléments rejetés lors de la validation initiale',
    supplementary: 'Documents avec informations complémentaires non validées comme faits', sources: 'Sources incohérentes',
    partial: 'Documents partiellement lus', reservation: 'Le rapport ne formule pas clairement la réserve de dossier incomplet.',
    limit: 'Associer une référence à une ligne ne prouve ni l’exploitation du fait ni la justesse de son interprétation. Seuls les champs explicites sont comparés.',
    line: 'Ligne', fields: { quantity: 'Quantité', location: 'Localisation', dimensions: 'Dimensions', characteristic: 'Caractéristique', condition: 'Condition', exclusion: 'Exclusion', status: 'Statut', disposition: 'Décision', category: 'Catégorie', source: 'Source' } as Record<string, string>,
  };
  const anomalies = audit?.valueChecks?.filter(c => c.status === 'demonstrated_anomaly') ?? [];
  const unverifiable = audit?.valueChecks?.filter(c => c.status === 'unverifiable').length ?? 0;
  const lists: [string, string[]][] = [
    [T.unreferenced, audit?.unreferencedFactIds ?? []], [T.mentioned, audit?.mentionedOnlyFactIds ?? []],
    [T.ambiguous, audit?.ambiguousFactIds ?? []], [T.unknown, audit?.unknownFactIds ?? []],
  ];
  return <section aria-label={T.details} dir={isRTL ? 'rtl' : 'ltr'} className="space-y-2 border-y border-border py-3 text-[16px]">
    <p className="text-foreground font-medium">{T.generated}</p>
    {audit?.structure?.verified && <p className="text-muted-foreground">{T.verified}</p>}
    {audit?.structure && ([['missingSections', T.missing], ['emptySections', T.empty], ['repeatedSections', T.repeated]] as const).map(([key, label]) =>
      audit.structure?.[key].length ? <p key={key} className="text-foreground">{label} : {audit.structure[key].join(', ')}</p> : null)}
    <p className="text-muted-foreground">{audit?.version === 2 ? T.checks : T.old}</p>
    {anomalies.length > 0 && <p className="text-foreground font-semibold">{T.anomalies} : {anomalies.length}</p>}
    <details className="text-muted-foreground">
      <summary className="cursor-pointer text-foreground">{T.details}</summary>
      <div className="space-y-2 pt-2">
        {lists.map(([label, ids]) => ids.length > 0 && <div key={label}>
          <p>{label} : {ids.length}</p>
          <div className="max-h-32 overflow-y-auto break-all text-[16px]" dir="ltr" lang="fr">{ids.join(' ; ')}</div>
        </div>)}
        {anomalies.length > 0 && <ul className="space-y-2 max-h-60 overflow-y-auto">
          {anomalies.map((c, i) => <li key={i} className="border-s-2 border-primary ps-3 text-foreground break-words">
            {T.line} {c.line} — {T.fields[c.field] ?? c.field}<br />
            <span dir="ltr" className="break-all">{c.factId}</span><br />
            <span dir="auto">{c.source ?? '—'} → {c.reported ?? '—'}</span>
          </li>)}
        </ul>}
        {unverifiable > 0 && <p>{T.unverifiable} : {unverifiable}</p>}
        {audit?.provenance && <>
          {audit.provenance.rejectedEntries > 0 && <p>{T.rejected} : {audit.provenance.rejectedEntries}</p>}
          {audit.provenance.supplementaryDocuments > 0 && <p>{T.supplementary} : {audit.provenance.supplementaryDocuments}</p>}
          {audit.provenance.inconsistentSources > 0 && <p>{T.sources} : {audit.provenance.inconsistentSources}</p>}
          {audit.provenance.partialDocuments > 0 && <p>{T.partial} : {audit.provenance.partialDocuments}</p>}
          {!audit.provenance.incompleteReservationPresent && <p className="text-foreground">{T.reservation}</p>}
        </>}
        <p>{T.limit}</p>
      </div>
    </details>
  </section>;
}