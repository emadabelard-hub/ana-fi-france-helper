import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
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
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

const ShbikLbikCard = ({
  totalIncome, totalExpenses, tvaCollectee, tvaDeductible,
  urssafRate, isRate, totalIncomeHT, totalExpensesHT,
  isTvaExempt, isRTL,
}: ShbikLbikProps) => {
  const navigate = useNavigate();
  const [showDetail, setShowDetail] = useState(false);

  // ── Calculations ──
  const tvaNet = isTvaExempt ? 0 : Math.max(0, tvaCollectee - tvaDeductible);
  const urssaf = totalIncomeHT * (urssafRate / 100);
  const benefice = totalIncomeHT - totalExpensesHT - urssaf;
  const impot = Math.max(0, benefice * (isRate / 100));
  const totalReserve = tvaNet + urssaf + impot;
  const disponible = totalIncome - totalExpenses - totalReserve;
  const aPrevoir = urssaf + impot;

  const hasData = totalIncome > 0 || totalExpenses > 0;

  // ── Health / color ──
  const healthRatio = totalIncome > 0 ? disponible / totalIncome : 0;
  type Health = 'good' | 'watch' | 'fragile';
  const health: Health =
    disponible < 0 || healthRatio < 0.1 ? 'fragile' :
    healthRatio < 0.3 ? 'watch' : 'good';

  const amtColor = {
    good: 'text-emerald-400',
    watch: 'text-amber-400',
    fragile: 'text-red-400',
  }[health];

  const glowColor = {
    good: 'shadow-emerald-500/10',
    watch: 'shadow-amber-500/10',
    fragile: 'shadow-red-500/10',
  }[health];

  // ── Single smart phrase ──
  const phrase = (() => {
    if (!hasData) return null;
    if (disponible < 0)
      return { emoji: '🚨', fr: 'Ce qu\'il te reste devient faible', ar: 'اللي فاضلك بدأ يقل' };
    if (healthRatio < 0.15)
      return { emoji: '⚠️', fr: 'Attention, charges importantes à venir', ar: 'انتبه، مصاريف كبيرة جاية' };
    if (healthRatio < 0.3)
      return { emoji: '⚠️', fr: 'Activité correcte, reste vigilant', ar: 'النشاط ماشي، بس خلي بالك' };
    return { emoji: '✅', fr: 'Activité rentable, situation saine', ar: 'النشاط مربح، وضعك كويس' };
  })();

  return (
    <div className={cn(
      'rounded-2xl border border-accent/20 bg-[hsl(220,20%,12%)] overflow-hidden shadow-lg',
      glowColor
    )}>
      {/* ── Header ── */}
      <div className={cn('flex items-center gap-2.5 px-5 pt-5 pb-2', isRTL && 'flex-row-reverse')}>
        <span className="text-2xl">🧞‍♂️</span>
        <div className={isRTL ? 'text-right' : ''}>
          <h2 className={cn('text-lg font-black text-accent leading-tight', isRTL && 'font-cairo')}>شبيك لبيك</h2>
          <p className={cn('text-[10px] text-muted-foreground', isRTL && 'font-cairo')}>
            {isRTL ? 'مستشارك المالي الذكي' : 'Ton conseiller financier intelligent'}
          </p>
        </div>
      </div>

      {/* ── Main Amount ── */}
      <div className="px-5 py-4 text-center">
        <p className={cn('text-[11px] text-muted-foreground mb-1', isRTL && 'font-cairo')}>
          {isRTL ? '💰 الفلوس المتاحة فعلاً' : '💰 Argent vraiment disponible'}
        </p>
        <p className={cn('text-5xl font-black tracking-tight leading-none', amtColor)}>
          {hasData ? fmt(disponible) : '—'}
        </p>
        <p className={cn('text-[10px] text-muted-foreground mt-1.5', isRTL && 'font-cairo')}>
          {isRTL ? 'بعد المصاريف المتوقعة (URSSAF + ضرائب)' : 'Après charges estimées (URSSAF + impôts)'}
        </p>
      </div>

      {hasData && (
        <div className="px-5 pb-5 space-y-3">
          {/* ── Smart phrase ── */}
          {phrase && (
            <div className={cn(
              'rounded-xl px-4 py-2.5 text-center',
              health === 'good' ? 'bg-emerald-500/10' :
              health === 'watch' ? 'bg-amber-500/10' : 'bg-red-500/10'
            )}>
              <p className={cn('text-xs font-semibold', amtColor, isRTL && 'font-cairo')}>
                {phrase.emoji} {isRTL ? phrase.ar : phrase.fr}
              </p>
            </div>
          )}

          {/* ── Reserve compact ── */}
          <div className="rounded-xl bg-[hsl(220,20%,16%)] px-4 py-3">
            <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
              <span className={cn('text-[11px] text-muted-foreground', isRTL && 'font-cairo')}>
                📦 {isRTL ? 'خلّيها جنب' : 'À réserver'}
              </span>
              <span className="text-sm font-black text-amber-400">{fmt(totalReserve)}</span>
            </div>
            <p className={cn('text-[10px] text-muted-foreground mt-1', isRTL && 'font-cairo text-right')}>
              {isRTL
                ? `TVA + URSSAF + ضرائب = ${fmt(totalReserve)}`
                : `TVA + URSSAF + impôts = ${fmt(totalReserve)}`}
            </p>
          </div>

          {/* ── Prévision ── */}
          {aPrevoir > 0 && (
            <div className={cn('flex items-center justify-between px-1', isRTL && 'flex-row-reverse')}>
              <span className={cn('text-[11px] text-muted-foreground', isRTL && 'font-cairo')}>
                🔮 {isRTL ? 'المتوقع دفعه' : 'À prévoir'}
              </span>
              <span className="text-xs font-bold text-violet-400">{fmt(aPrevoir)}</span>
            </div>
          )}

          {/* ── Mini detail toggle ── */}
          <button
            onClick={() => setShowDetail(!showDetail)}
            className={cn(
              'w-full flex items-center justify-between rounded-xl bg-[hsl(220,20%,16%)] px-4 py-2.5 transition-colors hover:bg-[hsl(220,20%,18%)]',
              isRTL && 'flex-row-reverse'
            )}
          >
            <span className={cn('text-[11px] text-muted-foreground', isRTL && 'font-cairo')}>
              {isRTL ? 'التفاصيل' : 'Détails'}
            </span>
            <ChevronRight className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform',
              showDetail && 'rotate-90'
            )} />
          </button>

          {showDetail && (
            <div className="space-y-1.5 rounded-xl bg-[hsl(220,20%,14%)] p-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <MiniRow icon={<TrendingUp className="h-3 w-3 text-emerald-400" />}
                label={isRTL ? 'الإيرادات' : 'Revenus'} value={fmt(totalIncome)}
                color="text-emerald-400" isRTL={isRTL} />
              <MiniRow icon={<TrendingDown className="h-3 w-3 text-red-400" />}
                label={isRTL ? 'المصاريف' : 'Dépenses'} value={`-${fmt(totalExpenses)}`}
                color="text-red-400" isRTL={isRTL} />
            </div>
          )}

          {/* ── CTA button ── */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/expenses')}
            className={cn(
              'w-full text-accent/70 hover:text-accent hover:bg-accent/10 text-xs font-semibold gap-1',
              isRTL && 'font-cairo flex-row-reverse'
            )}
          >
            {isRTL ? 'عرض التفاصيل' : 'Voir détails'}
            <ChevronRight className={cn('h-3.5 w-3.5', isRTL && 'rotate-180')} />
          </Button>
        </div>
      )}

      {/* ── No data state ── */}
      {!hasData && (
        <div className="px-5 pb-5">
          <p className={cn('text-center text-[11px] text-muted-foreground', isRTL && 'font-cairo')}>
            {isRTL ? 'بعض التقديرات غير متوفرة بعد' : 'Certaines estimations ne sont pas encore disponibles'}
          </p>
        </div>
      )}
    </div>
  );
};

// ── Mini detail row ──
const MiniRow = ({ icon, label, value, color, isRTL }: {
  icon: React.ReactNode; label: string; value: string; color: string; isRTL: boolean;
}) => (
  <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
    <div className={cn('flex items-center gap-1.5', isRTL && 'flex-row-reverse')}>
      {icon}
      <span className={cn('text-[11px] text-muted-foreground', isRTL && 'font-cairo')}>{label}</span>
    </div>
    <span className={cn('text-xs font-mono font-semibold', color)}>{value}</span>
  </div>
);

export default ShbikLbikCard;
