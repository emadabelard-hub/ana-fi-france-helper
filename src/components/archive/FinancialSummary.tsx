import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FinancialSummaryProps {
  totalIncome: number;
  totalExpenses: number;
  isRTL: boolean;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const FinancialSummary = ({ totalIncome, totalExpenses, isRTL }: FinancialSummaryProps) => {
  const netProfit = totalIncome - totalExpenses;
  const isPositive = netProfit >= 0;

  const cards = [
    {
      label: isRTL ? 'إجمالي المداخيل' : 'Total Revenus',
      value: totalIncome,
      icon: TrendingUp,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      label: isRTL ? 'إجمالي المصاريف' : 'Total Dépenses',
      value: totalExpenses,
      icon: TrendingDown,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
    },
    {
      label: isRTL ? 'صافي الربح' : 'Bénéfice Net',
      value: netProfit,
      icon: Wallet,
      color: isPositive ? 'text-accent' : 'text-red-400',
      bg: isPositive ? 'bg-accent/10' : 'bg-red-500/10',
      border: isPositive ? 'border-accent/20' : 'border-red-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            'rounded-xl border p-3 transition-all duration-300 hover:shadow-lg',
            card.border,
            card.bg,
            'bg-card'
          )}
        >
          <div className={cn('flex items-center gap-2 mb-2', isRTL && 'flex-row-reverse')}>
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', card.bg)}>
              <card.icon className={cn('h-4 w-4', card.color)} />
            </div>
            <span className={cn('text-[10px] font-semibold text-muted-foreground uppercase tracking-wider', isRTL && 'font-cairo text-right')}>
              {card.label}
            </span>
          </div>
          <p className={cn('text-lg font-black tracking-tight', card.color, isRTL && 'text-right')}>
            {formatCurrency(card.value)}
          </p>
        </div>
      ))}
    </div>
  );
};

export default FinancialSummary;
