import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { calculateInvoiceTotals, validateInvoiceTotalsConsistency } from '@/lib/invoiceTotals';
import type { LineItem } from './LineItemEditor';
import type { PaymentMilestone } from './InvoiceDisplay';

export interface PreGenCheckInput {
  clientName: string;
  clientAddress: string;
  items: LineItem[];
  includeTravelCosts: boolean;
  travelPrice: number;
  subtotal: number;
  tvaRate: number;
  tvaAmount: number;
  total: number;
  tvaExempt: boolean;
  discountEnabled: boolean;
  discountValue: number;
  discountType: 'percent' | 'fixed';
  moyenPaiement: string;
  acompteEnabled: boolean;
  acomptePercent: number;
  acompteMode: 'percent' | 'fixed';
  acompteFixedAmount: number;
  milestonesEnabled: boolean;
  paymentMilestones: PaymentMilestone[];
  docNumber: string;
  documentType: 'devis' | 'facture';
}

interface CheckResult {
  id: string;
  label_fr: string;
  label_ar: string;
  ok: boolean;
  error_fr?: string;
  error_ar?: string;
}

function runChecks(input: PreGenCheckInput): CheckResult[] {
  const results: CheckResult[] = [];
  const prefix = input.documentType === 'devis' ? 'D-' : 'F-';

  // 1. Client
  const clientOk = !!input.clientName.trim() && !!input.clientAddress.trim();
  results.push({
    id: 'client',
    label_fr: 'Informations client',
    label_ar: 'معلومات الزبون',
    ok: clientOk,
    error_fr: 'Veuillez compléter les informations client',
    error_ar: 'كمّل معلومات الزبون',
  });

  // 2. Travaux
  const validItems = input.items.filter(
    i => i.designation_fr.trim() && Number(i.quantity) > 0 && Number(i.unitPrice) > 0
  );
  const hasTravel = input.includeTravelCosts && input.travelPrice > 0;
  const travauxOk = validItems.length > 0 || hasTravel;
  results.push({
    id: 'travaux',
    label_fr: 'Prestations',
    label_ar: 'البنود',
    ok: travauxOk,
    error_fr: 'Veuillez ajouter au moins une prestation valide',
    error_ar: 'زيد بند واحد على الأقل',
  });

  // 3. Prix / Calcul
  const totalsOk = input.subtotal > 0 && input.total > 0;
  results.push({
    id: 'prix',
    label_fr: 'Montants calculés',
    label_ar: 'المبالغ المحسوبة',
    ok: totalsOk,
    error_fr: 'Erreur de calcul des montants',
    error_ar: 'خطأ في حساب المبالغ',
  });

  // 4. TVA consistency
  const expectedTotals = calculateInvoiceTotals({
    subtotal: input.subtotal,
    tvaRate: input.tvaRate,
    tvaExempt: input.tvaExempt,
    discountType: input.discountEnabled ? input.discountType : undefined,
    discountValue: input.discountEnabled ? input.discountValue : undefined,
  });
  const consistency = validateInvoiceTotalsConsistency({
    subtotal: input.subtotal,
    tvaRate: input.tvaRate,
    tvaExempt: input.tvaExempt,
    discountType: input.discountEnabled ? input.discountType : undefined,
    discountValue: input.discountEnabled ? input.discountValue : undefined,
    computedTvaAmount: input.tvaAmount,
    computedTotal: input.total,
    computedSubtotalAfterDiscount: expectedTotals.subtotalAfterDiscount,
  });
  results.push({
    id: 'tva',
    label_fr: 'Cohérence TVA',
    label_ar: 'تناسق الضريبة',
    ok: consistency.isValid,
    error_fr: 'Erreur de calcul de la TVA',
    error_ar: 'خطأ في حساب الضريبة',
  });

  // 5. Remise
  if (input.discountEnabled) {
    const discountOk =
      input.discountValue >= 0 &&
      (input.discountType === 'percent'
        ? input.discountValue <= 100
        : input.discountValue <= input.subtotal);
    results.push({
      id: 'remise',
      label_fr: 'Remise',
      label_ar: 'الخصم',
      ok: discountOk,
      error_fr: 'Remise invalide',
      error_ar: 'خصم غير صالح',
    });
  }

  // 6. Paiement
  const paiementOk = !!input.moyenPaiement;
  results.push({
    id: 'paiement',
    label_fr: 'Mode de paiement',
    label_ar: 'طريقة الدفع',
    ok: paiementOk,
    error_fr: 'Veuillez compléter les informations de paiement',
    error_ar: 'كمّل معلومات الدفع',
  });

  // 7. Échéancier
  if (input.milestonesEnabled && input.paymentMilestones.length > 0) {
    const msTotal = input.paymentMilestones.reduce((sum, m) => {
      if (m.mode === 'percent') return sum + (input.total * (m.percent || 0)) / 100;
      return sum + (m.amount || 0);
    }, 0);
    const echeancierOk = Math.abs(msTotal - input.total) < 0.02;
    results.push({
      id: 'echeancier',
      label_fr: 'Échéancier',
      label_ar: 'جدول الدفع',
      ok: echeancierOk,
      error_fr: 'Échéancier incorrect',
      error_ar: 'جدول الدفع غير صحيح',
    });
  }

  // 8. Numéro de document — auto-attribué à l'enregistrement, toujours OK
  results.push({
    id: 'general',
    label_fr: 'Numéro de document',
    label_ar: 'رقم الوثيقة',
    ok: true,
    error_fr: '',
    error_ar: '',
  });

  return results;
}

interface PreGenerationChecklistProps {
  input: PreGenCheckInput;
}

const PreGenerationChecklist = ({ input }: PreGenerationChecklistProps) => {
  const { isRTL } = useLanguage();
  const checks = useMemo(() => runChecks(input), [input]);
  const allOk = checks.every(c => c.ok);
  const errors = checks.filter(c => !c.ok);

  return (
    <div className="space-y-2">
      {/* Status summary */}
      <div className={cn(
        "p-3 rounded-xl border-2 text-center text-sm font-bold",
        allOk
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
          : "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400",
        isRTL && "font-cairo"
      )}>
        {allOk
          ? (isRTL ? '✅ الدوفي جاهز يتحمّل PDF' : '✅ Devis prêt à être généré')
          : (isRTL ? '⚠️ في مشاكل لازم تصلّحها' : '⚠️ Veuillez corriger les erreurs ci-dessous')}
      </div>

      {/* Checklist items */}
      <div className="space-y-1.5">
        {checks.map(c => (
          <div
            key={c.id}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm",
              c.ok
                ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                : "bg-destructive/10 dark:bg-destructive/20",
              isRTL && "flex-row-reverse font-cairo"
            )}
          >
            {c.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive shrink-0" />
            )}
            <span className={cn("flex-1", isRTL && "text-right")}>
              {isRTL ? c.label_ar : c.label_fr}
            </span>
            {!c.ok && (
              <span className={cn("text-xs text-destructive", isRTL && "text-right")}>
                {isRTL ? c.error_ar : c.error_fr}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export { runChecks };
export default PreGenerationChecklist;
