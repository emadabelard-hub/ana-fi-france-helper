import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MessageCircle, ArrowUpRight, ArrowDownRight, Receipt, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShbikLbikProps {
  totalIncome: number;
  totalExpenses: number;
  tvaCollectee: number;
  tvaDeductible: number;
  urssafRate: number;
  isRate: number;
  totalIncomeHT: number;
  totalExpensesHT: number;
  isTvaExempt: boolean;
  isRTL: boolean;
  tresorerieEncaissee?: number;
  caEnAttenteHT?: number;
  caTotalFactureHT?: number;
  legalStatus?: string | null;
  simplified?: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const ShbikLbikCard = (props: ShbikLbikProps) => {
  const { isRTL, totalIncome, totalExpenses, tvaCollectee, tvaDeductible, totalIncomeHT, isTvaExempt } = props;
  const navigate = useNavigate();

  const tvaAPayer = isTvaExempt ? 0 : Math.max(0, tvaCollectee - tvaDeductible);

  const rows = [
    {
      label: isRTL ? 'دخلك' : 'Vos revenus',
      value: totalIncome,
      icon: ArrowUpRight,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: isRTL ? 'مصاريفك' : 'Vos dépenses',
      value: totalExpenses,
      icon: ArrowDownRight,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
    },
    {
      label: isRTL ? 'TVA اللي هتدفعها' : 'TVA à reverser',
      value: tvaAPayer,
      icon: Receipt,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
    },
    {
      label: isRTL ? 'الكومول السنوي' : 'Cumul annuel',
      value: totalIncomeHT,
      icon: TrendingUp,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
    },
  ];

  return (
    <div className={cn(
      'rounded-2xl border border-accent/20 bg-[hsl(220,20%,12%)] overflow-hidden shadow-lg'
    )}>
      {/* Header */}
      <div className={cn('flex items-center gap-2.5 px-5 pt-5 pb-2', isRTL && 'flex-row-reverse')}>
        <span className="text-2xl">🧞‍♂️</span>
        <div className={isRTL ? 'text-right' : ''}>
          <h2 className={cn('text-lg font-black text-accent leading-tight', isRTL && 'font-cairo')}>شبيك لبيك</h2>
          <p className={cn('text-[10px] text-muted-foreground', isRTL && 'font-cairo')}>
            {isRTL ? 'مستشارك المالي الذكي' : 'Ton conseiller financier intelligent'}
          </p>
        </div>
      </div>

      {/* 4 Financial rows */}
      <div className="px-5 pb-2 grid grid-cols-2 gap-2.5">
        {rows.map((row) => (
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

      {/* Assistant CTA */}
      <div className="px-5 pb-5 pt-2">
        <Button
          onClick={() => navigate('/assistant?topic=comptabilite')}
          className={cn(
            'w-full gap-2 bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30',
            isRTL && 'font-cairo flex-row-reverse'
          )}
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-bold">
            {isRTL ? 'اسأل المساعد عن حساباتك' : 'Demander conseil à l\'assistant'}
          </span>
        </Button>
      </div>
    </div>
  );
};

export default ShbikLbikCard;
