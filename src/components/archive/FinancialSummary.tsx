import { TrendingDown, Banknote, Receipt, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FinancialSummaryProps {
  caHT: number;
  depensesHT: number;
  tvaCollectee: number;
  tvaDeductible: number;
  urssafRate?: number;
  isRate?: number;
  isRTL: boolean;
  debugFacturesCount?: number;
  debugDepensesCount?: number;
  debugTotalFactures?: number;
  debugIgnoredFactures?: number;
  debugPaidCount?: number;
  debugUnpaidCount?: number;
  tresorerieEncaissee?: number;
  caEnAttenteHT?: number;
  caTotalFactureHT?: number;
  legalStatus?: string | null;
  isTvaExempt?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const FinancialSummary = ({
  depensesHT,
  tvaCollectee,
  tvaDeductible,
  isRTL,
  tresorerieEncaissee = 0,
  caEnAttenteHT = 0,
  isTvaExempt = false,
}: FinancialSummaryProps) => {
  const effectiveTvaCollectee = isTvaExempt ? 0 : tvaCollectee;
  const effectiveTvaDeductible = isTvaExempt ? 0 : tvaDeductible;
  const tvaAReverser = isTvaExempt ? 0 : Math.max(0, effectiveTvaCollectee - effectiveTvaDeductible);

  const cards = [
    {
      labelFr: 'Total dépenses',
      labelAr: 'إجمالي المصروفات',
      value: depensesHT,
      icon: TrendingDown,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      labelFr: 'Argent encaissé',
      labelAr: 'الأموال المحصَّلة',
      value: tresorerieEncaissee,
      icon: Banknote,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      labelFr: 'TVA à reverser',
      labelAr: 'تقرير TVA',
      value: tvaAReverser,
      icon: Receipt,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      labelFr: 'Impayés',
      labelAr: 'المستحقات غير المدفوعة',
      value: caEnAttenteHT,
      icon: AlertCircle,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-2.5">
        {cards.map((row) => (
          <div key={row.labelFr} className={cn('rounded-lg border border-border/50 p-2.5', row.bg, 'bg-opacity-30')}>
            <div className={cn('flex items-center gap-1.5 mb-1', isRTL && 'flex-row-reverse')}>
              <row.icon className={cn('h-3.5 w-3.5', row.color)} />
              <span className={cn('text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight', isRTL && 'font-cairo')}>
                {isRTL ? row.labelAr : row.labelFr}
              </span>
            </div>
            <p className={cn('text-base font-black tracking-tight', row.color, isRTL && 'text-right')}>
              {fmt(row.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FinancialSummary;
