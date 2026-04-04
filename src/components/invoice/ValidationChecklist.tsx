import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle2, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';
import { calculateInvoiceTotals, validateInvoiceTotalsConsistency } from '@/lib/invoiceTotals';
import type { LineItem } from './LineItemEditor';
import type { PaymentMilestone } from './InvoiceDisplay';

export interface ValidationInput {
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

type CheckStatus = 'ok' | 'warning' | 'error';

interface CheckItem {
  id: string;
  label_fr: string;
  label_ar: string;
  status: CheckStatus;
  detail_fr?: string;
  detail_ar?: string;
  stepIndex: number;
}

function runValidation(input: ValidationInput): CheckItem[] {
  const results: CheckItem[] = [];

  // 1. Client (step 0)
  const hasName = !!input.clientName.trim();
  const hasAddr = !!input.clientAddress.trim();
  const clientStatus: CheckStatus = hasName && hasAddr ? 'ok' : !hasName && !hasAddr ? 'error' : 'warning';
  results.push({
    id: 'client',
    label_fr: 'Informations client',
    label_ar: 'معلومات الزبون',
    status: clientStatus,
    detail_fr: clientStatus === 'ok' ? undefined : !hasName ? 'Nom du client manquant' : 'Adresse client manquante',
    detail_ar: clientStatus === 'ok' ? undefined : !hasName ? 'اسم الزبون ناقص' : 'عنوان الزبون ناقص',
    stepIndex: 0,
  });

  // 2. Travaux (step 2)
  const validItems = input.items.filter(
    i => i.designation_fr.trim() && Number(i.quantity) > 0 && Number(i.unitPrice) > 0
  );
  const partialItems = input.items.filter(
    i => i.designation_fr.trim() && (Number(i.quantity) <= 0 || Number(i.unitPrice) <= 0)
  );
  const hasTravel = input.includeTravelCosts && input.travelPrice > 0;
  const travauxStatus: CheckStatus = validItems.length > 0 || hasTravel ? (partialItems.length > 0 ? 'warning' : 'ok') : 'error';
  results.push({
    id: 'travaux',
    label_fr: 'Prestations',
    label_ar: 'البنود',
    status: travauxStatus,
    detail_fr: travauxStatus === 'ok' ? `${validItems.length} prestation(s)` : travauxStatus === 'warning' ? 'Lignes incomplètes détectées' : 'Aucune prestation valide',
    detail_ar: travauxStatus === 'ok' ? `${validItems.length} بند` : travauxStatus === 'warning' ? 'في بنود ناقصة' : 'ما كاين حتى بند',
    stepIndex: 2,
  });

  // 3. Totaux (step 7)
  const totalsOk = input.subtotal > 0 && input.total > 0;
  results.push({
    id: 'totaux',
    label_fr: 'Montants calculés',
    label_ar: 'المبالغ المحسوبة',
    status: totalsOk ? 'ok' : 'error',
    detail_fr: totalsOk ? `Total: ${input.total.toFixed(2)} €` : 'Total à zéro',
    detail_ar: totalsOk ? `المجموع: ${input.total.toFixed(2)} €` : 'المجموع صفر',
    stepIndex: 7,
  });

  // 4. TVA (step 7)
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
    status: consistency.isValid ? 'ok' : 'error',
    detail_fr: consistency.isValid ? (input.tvaExempt ? 'Exonéré' : `TVA ${input.tvaRate}%`) : 'Incohérence TVA',
    detail_ar: consistency.isValid ? (input.tvaExempt ? 'معفى' : `ض.ق.م ${input.tvaRate}%`) : 'خطأ في الضريبة',
    stepIndex: 7,
  });

  // 5. Paiement (step 6)
  const paiementOk = !!input.moyenPaiement;
  results.push({
    id: 'paiement',
    label_fr: 'Mode de paiement',
    label_ar: 'طريقة الدفع',
    status: paiementOk ? 'ok' : 'warning',
    detail_fr: paiementOk ? input.moyenPaiement : 'Non sélectionné',
    detail_ar: paiementOk ? input.moyenPaiement : 'ما تختارش',
    stepIndex: 6,
  });

  // 6. Échéancier (step 6)
  if (input.milestonesEnabled && input.paymentMilestones.length > 0) {
    const msTotal = input.paymentMilestones.reduce((sum, m) => {
      if (m.mode === 'percent') return sum + (input.total * (m.percent || 0)) / 100;
      return sum + (m.amount || 0);
    }, 0);
    const diff = Math.abs(msTotal - input.total);
    const echeancierStatus: CheckStatus = diff < 0.02 ? 'ok' : diff < input.total * 0.05 ? 'warning' : 'error';
    results.push({
      id: 'echeancier',
      label_fr: 'Échéancier',
      label_ar: 'جدول الدفع',
      status: echeancierStatus,
      detail_fr: echeancierStatus === 'ok' ? `${input.paymentMilestones.length} échéance(s)` : `Écart: ${diff.toFixed(2)} €`,
      detail_ar: echeancierStatus === 'ok' ? `${input.paymentMilestones.length} دفعة` : `فرق: ${diff.toFixed(2)} €`,
      stepIndex: 6,
    });
  }

  return results;
}

const statusConfig = {
  ok: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50/80 dark:bg-emerald-950/20',
    border: 'border-emerald-200/60 dark:border-emerald-800/40',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    textColor: 'text-emerald-700 dark:text-emerald-300',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50/80 dark:bg-amber-950/20',
    border: 'border-amber-200/60 dark:border-amber-800/40',
    iconColor: 'text-amber-500 dark:text-amber-400',
    textColor: 'text-amber-700 dark:text-amber-300',
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-50/80 dark:bg-red-950/20',
    border: 'border-red-200/60 dark:border-red-800/40',
    iconColor: 'text-red-500 dark:text-red-400',
    textColor: 'text-red-700 dark:text-red-300',
  },
};

interface ValidationChecklistProps {
  input: ValidationInput;
  onNavigateToStep?: (step: number) => void;
}

const ValidationChecklist = ({ input, onNavigateToStep }: ValidationChecklistProps) => {
  const { isRTL } = useLanguage();
  const checks = useMemo(() => runValidation(input), [input]);

  const okCount = checks.filter(c => c.status === 'ok').length;
  const errorCount = checks.filter(c => c.status === 'error').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;
  const allOk = errorCount === 0 && warningCount === 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className={cn(
        "p-4 rounded-xl border-2 text-center",
        allOk
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/30"
          : "border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30",
        isRTL && "font-cairo"
      )}>
        <p className={cn(
          "text-sm font-bold",
          allOk ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
        )}>
          {allOk
            ? (isRTL ? '✅ الوثيقة جاهزة — تقدر تولّد PDF' : '✅ Document prêt à être généré')
            : (isRTL
              ? `❌ ${errorCount + warningCount} عنصر يحتاج تصحيح`
              : `❌ ${errorCount + warningCount} élément(s) à corriger`)}
        </p>
        {!allOk && (
          <p className="text-xs text-muted-foreground mt-1">
            {isRTL ? 'اضغط على أي عنصر للانتقال إليه' : 'Cliquez sur un élément pour y accéder'}
          </p>
        )}
      </div>

      {/* Items */}
      <div className="space-y-2">
        {checks.map(c => {
          const cfg = statusConfig[c.status];
          const Icon = cfg.icon;
          const isClickable = c.status !== 'ok' && !!onNavigateToStep;

          return (
            <button
              key={c.id}
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onNavigateToStep?.(c.stepIndex)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                cfg.bg, cfg.border,
                isClickable && "cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
                !isClickable && "cursor-default",
                isRTL && "flex-row-reverse text-right font-cairo"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", cfg.iconColor)} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-semibold", cfg.textColor)}>
                  {isRTL ? c.label_ar : c.label_fr}
                </p>
                {(c.detail_fr || c.detail_ar) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {isRTL ? c.detail_ar : c.detail_fr}
                  </p>
                )}
              </div>
              {isClickable && (
                <ChevronRight className={cn(
                  "h-4 w-4 text-muted-foreground shrink-0",
                  isRTL && "rotate-180"
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Score bar */}
      <div className="px-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{isRTL ? 'التقدم' : 'Complétude'}</span>
          <span>{okCount}/{checks.length}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              allOk ? "bg-emerald-500" : errorCount > 0 ? "bg-red-400" : "bg-amber-400"
            )}
            style={{ width: `${(okCount / checks.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ValidationChecklist;
