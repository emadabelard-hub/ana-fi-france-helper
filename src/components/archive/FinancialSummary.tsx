import { TrendingUp, TrendingDown, Wallet, Receipt, AlertTriangle, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FinancialSummaryProps {
  totalIncome: number;
  totalExpenses: number;
  tvaCollectee: number;
  tvaDeductible: number;
  totalIncomeHT: number;
  totalExpensesHT: number;
  urssafRate: number;
  isRate: number;
  isRTL: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const FinancialSummary = ({
  totalIncome, totalExpenses,
  tvaCollectee, tvaDeductible,
  totalIncomeHT, totalExpensesHT,
  urssafRate, isRate, isRTL,
}: FinancialSummaryProps) => {
  // ── BLOC 1: Données réelles ──
  const beneficeBrut = totalIncome - totalExpenses;
  const tvaAPayer = Math.max(0, tvaCollectee - tvaDeductible);

  // ── BLOC 2: Estimations ──
  const urssafEstime = beneficeBrut > 0 ? beneficeBrut * (urssafRate / 100) : 0;
  const isEstime = beneficeBrut > 0 ? beneficeBrut * (isRate / 100) : 0;

  const realRows = [
    { label: "Chiffre d'affaires (TTC)", value: totalIncome, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Dépenses (TTC)', value: totalExpenses, icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Bénéfice brut', value: beneficeBrut, icon: Wallet, color: beneficeBrut >= 0 ? 'text-emerald-400' : 'text-red-400', bg: beneficeBrut >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10' },
    { label: 'TVA collectée', value: tvaCollectee, icon: Receipt, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'TVA déductible', value: tvaDeductible, icon: Receipt, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'TVA à payer', value: tvaAPayer, icon: Receipt, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-4">
      {/* ── BLOC 1: DONNÉES RÉELLES ── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className={cn('flex items-center gap-2 mb-3', isRTL && 'flex-row-reverse')}>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Calculator className="h-4 w-4 text-emerald-400" />
          </div>
          <h3 className={cn('text-sm font-bold text-foreground', isRTL && 'font-cairo')}>
            Données réelles
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {realRows.map((row) => (
            <div key={row.label} className={cn('rounded-lg border border-border/50 p-2.5', row.bg, 'bg-opacity-30')}>
              <div className={cn('flex items-center gap-1.5 mb-1', isRTL && 'flex-row-reverse')}>
                <row.icon className={cn('h-3.5 w-3.5', row.color)} />
                <span className={cn('text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight', isRTL && 'font-cairo')}>
                  {row.label}
                </span>
              </div>
              <p className={cn('text-base font-black tracking-tight', row.color, isRTL && 'text-right')}>
                {fmt(row.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── BLOC 2: ESTIMATIONS ── */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className={cn('flex items-center gap-2 mb-3', isRTL && 'flex-row-reverse')}>
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <h3 className={cn('text-sm font-bold text-amber-400', isRTL && 'font-cairo')}>
            Estimations (non officiel)
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              URSSAF ({urssafRate}%)
            </span>
            <p className="text-base font-black text-amber-400">{fmt(urssafEstime)}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              Impôt société ({isRate}%)
            </span>
            <p className="text-base font-black text-amber-400">{fmt(isEstime)}</p>
          </div>
        </div>
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <p className="text-[11px] text-amber-300/90 leading-relaxed font-medium">
            ⚠️ Ces montants sont des estimations indicatives. Seul un expert-comptable peut valider les montants réels.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FinancialSummary;
