import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Heart,
  Lightbulb, ChevronDown, ChevronUp, Shield
} from 'lucide-react';

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
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const ShbikLbikCard = ({
  totalIncome, totalExpenses, tvaCollectee, tvaDeductible,
  urssafRate, isRate, totalIncomeHT, totalExpensesHT,
  isTvaExempt, isRTL,
}: ShbikLbikProps) => {
  const [detailed, setDetailed] = useState(false);
  const [showTips, setShowTips] = useState(false);

  // ── Calculations ──
  const tvaNet = isTvaExempt ? 0 : Math.max(0, tvaCollectee - tvaDeductible);
  const urssaf = totalIncomeHT * (urssafRate / 100);
  const benefice = totalIncomeHT - totalExpensesHT - urssaf;
  const impot = Math.max(0, benefice * (isRate / 100));
  const totalReserve = tvaNet + urssaf + impot;
  const disponible = totalIncome - totalExpenses - totalReserve;

  // ── Health status ──
  const healthRatio = totalIncome > 0 ? disponible / totalIncome : 0;
  const expenseRatio = totalIncome > 0 ? totalExpenses / totalIncome : 0;
  const health: 'good' | 'watch' | 'fragile' =
    disponible < 0 || healthRatio < 0.1 ? 'fragile' :
    healthRatio < 0.3 || expenseRatio > 0.5 ? 'watch' : 'good';

  const healthConfig = {
    good: {
      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20',
      labelFr: 'Bonne', labelAr: 'جيدة',
      msgFr: 'Ta situation semble stable.', msgAr: 'وضعك المالي مستقر.',
      icon: '💚',
    },
    watch: {
      color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
      labelFr: 'À surveiller', labelAr: 'تحتاج متابعة',
      msgFr: 'Garde un œil sur tes charges.', msgAr: 'خلي بالك من مصاريفك.',
      icon: '🟡',
    },
    fragile: {
      color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20',
      labelFr: 'Fragile', labelAr: 'هشة',
      msgFr: 'Attention à ta trésorerie.', msgAr: 'انتبه لوضع الخزينة.',
      icon: '🔴',
    },
  };
  const hc = healthConfig[health];

  // ── Dynamic message ──
  const getMessage = () => {
    if (disponible < 0)
      return { emoji: '🚨', fr: 'Prudence. Ce qu\'il te reste réellement devient faible après charges et impôts.', ar: 'حذاري. اللي فاضلك بعد المصاريف والضرائب قليل.' };
    if (expenseRatio > 0.6)
      return { emoji: '📉', fr: 'Tes dépenses pèsent sur ton résultat. Vérifie tes achats et tes frais.', ar: 'مصاريفك كتيرة. راجع مشترياتك.' };
    if (tvaNet > totalIncome * 0.1 && !isTvaExempt)
      return { emoji: '🧾', fr: 'Tu as collecté de la TVA. Pense à la mettre de côté pour éviter les surprises.', ar: 'جمعت ضريبة TVA. حطها جنب عشان ما تتفاجئش.' };
    if (healthRatio < 0.3)
      return { emoji: '⚠️', fr: 'Attention, une partie de ton argent devra servir à payer tes charges. Évite de tout dépenser.', ar: 'انتبه، جزء من فلوسك لازم يروح للمصاريف. ما تصرفش كل حاجة.' };
    if (healthRatio > 0.5)
      return { emoji: '🎉', fr: 'Bonne dynamique. Ton chiffre d\'affaires progresse et ta situation semble solide.', ar: 'الشغل ماشي كويس. وضعك المالي ثابت.' };
    return { emoji: '✅', fr: 'Très bien. Ton activité semble rentable pour le moment.', ar: 'تمام. شغلك مربح دلوقتي.' };
  };
  const msg = getMessage();

  // ── Tips ──
  const tips: { fr: string; ar: string }[] = [];
  if (totalReserve > 0) tips.push({
    fr: `Mets de côté ${fmt(totalReserve)} pour tes prochaines charges.`,
    ar: `حط ${fmt(totalReserve)} جنب للمصاريف الجاية.`,
  });
  if (!isTvaExempt && tvaNet > 0) tips.push({
    fr: `Ta TVA nette à prévoir est de ${fmt(tvaNet)}.`,
    ar: `ضريبة الـ TVA المتوقعة: ${fmt(tvaNet)}.`,
  });
  if (urssafRate > 0) tips.push({
    fr: `Ton URSSAF estimée représente environ ${urssafRate}% de ton CA.`,
    ar: `الـ URSSAF حوالي ${urssafRate}% من إيراداتك.`,
  });
  if (expenseRatio < 0.2 && totalExpenses > 0) tips.push({
    fr: 'Ton niveau de dépenses reste faible, c\'est positif.',
    ar: 'مصاريفك قليلة، ده كويس.',
  });
  if (impot > 0) tips.push({
    fr: `Surveille ton impôt estimé : ${fmt(impot)}.`,
    ar: `خلي بالك من الضريبة المتوقعة: ${fmt(impot)}.`,
  });

  // ── Summary ──
  const summaryFr = `Ton activité ${totalIncome > 0 ? 'encaisse bien' : 'n\'a pas encore encaissé'}, ${totalReserve > 0 ? 'mais pense à réserver une partie de ton argent pour la TVA, l\'URSSAF et l\'impôt.' : 'et tes charges semblent gérables.'} Après estimation, ton montant réellement disponible est de ${fmt(disponible)}.`;
  const summaryAr = `شغلك ${totalIncome > 0 ? 'ماشي كويس' : 'لسه ما بداش يدخل فلوس'}، ${totalReserve > 0 ? 'بس متنساش تحط جنب فلوس للـ TVA والـ URSSAF والضرائب.' : 'والمصاريف تحت السيطرة.'} المبلغ المتاح فعلاً: ${fmt(disponible)}.`;

  // ── Amount color ──
  const amtColor = disponible < 0 ? 'text-red-400' :
    disponible < totalIncome * 0.2 ? 'text-amber-400' : 'text-emerald-400';

  const hasData = totalIncome > 0 || totalExpenses > 0;

  return (
    <div className="space-y-3">
      {/* ═══ MAIN CARD ═══ */}
      <div className="rounded-2xl border border-accent/20 bg-card p-4 space-y-4">
        {/* Header */}
        <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
          <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <span className="text-2xl">🧞‍♂️</span>
            <div className={isRTL ? 'text-right' : ''}>
              <h2 className={cn('text-lg font-black text-accent', isRTL && 'font-cairo')}>شبيك لبيك</h2>
              <p className={cn('text-[11px] text-muted-foreground', isRTL && 'font-cairo')}>
                {isRTL ? 'بشرحلك وضعك المالي ببساطة' : 'Je t\'explique simplement où tu en es.'}
              </p>
            </div>
          </div>
          {/* Simple/Detailed toggle */}
          <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
            <span className={cn('text-[10px] text-muted-foreground', isRTL && 'font-cairo')}>
              {detailed ? (isRTL ? 'مفصّل' : 'Détaillé') : (isRTL ? 'بسيط' : 'Simple')}
            </span>
            <Switch checked={detailed} onCheckedChange={setDetailed} className="scale-75" />
          </div>
        </div>

        {!hasData ? (
          <div className={cn('text-center py-6 text-sm text-muted-foreground', isRTL && 'font-cairo')}>
            {isRTL ? 'لسه مفيش بيانات كافية. أول ما تبدأ تسجل فواتير ومصاريف، هيظهر كل حاجة هنا.'
              : 'Pas encore assez de données. Dès que tu enregistres des factures et dépenses, tout apparaîtra ici.'}
          </div>
        ) : (
          <>
            {/* ── Main Amount ── */}
            <div className={cn('rounded-xl bg-muted/40 p-4 text-center')}>
              <p className={cn('text-xs text-muted-foreground mb-1', isRTL && 'font-cairo')}>
                {isRTL ? '💰 المبلغ المتاح فعلاً' : '💰 Argent vraiment disponible'}
              </p>
              <p className={cn('text-3xl font-black tracking-tight', amtColor)}>
                {fmt(disponible)}
              </p>
            </div>

            {/* ── Dynamic Message ── */}
            <div className={cn('flex items-start gap-2 rounded-xl bg-muted/30 p-3', isRTL && 'flex-row-reverse')}>
              <span className="text-lg shrink-0">{msg.emoji}</span>
              <p className={cn('text-xs leading-relaxed text-foreground/80', isRTL && 'font-cairo text-right')}>
                {isRTL ? msg.ar : msg.fr}
              </p>
            </div>

            {/* ── Detailed Breakdown ── */}
            {detailed && (
              <div className="space-y-2 pt-1">
                <DetailRow icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
                  label={isRTL ? 'إجمالي الإيرادات' : 'Tu as encaissé'} value={fmt(totalIncome)}
                  valueColor="text-emerald-400" isRTL={isRTL} />
                <DetailRow icon={<TrendingDown className="h-3.5 w-3.5 text-red-400" />}
                  label={isRTL ? 'المصاريف' : 'Tes dépenses'} value={`-${fmt(totalExpenses)}`}
                  valueColor="text-red-400" isRTL={isRTL} />
                {!isTvaExempt && (
                  <DetailRow icon={<Shield className="h-3.5 w-3.5 text-sky-400" />}
                    label={isRTL ? 'TVA المتوقعة' : 'TVA estimée à mettre de côté'} value={`-${fmt(tvaNet)}`}
                    valueColor="text-sky-400" isRTL={isRTL} />
                )}
                <DetailRow icon={<Shield className="h-3.5 w-3.5 text-violet-400" />}
                  label={isRTL ? 'URSSAF المتوقعة' : 'URSSAF estimée'} value={`-${fmt(urssaf)}`}
                  valueColor="text-violet-400" isRTL={isRTL} />
                <DetailRow icon={<Shield className="h-3.5 w-3.5 text-amber-400" />}
                  label={isRTL ? 'الضريبة المتوقعة' : 'Impôt estimé'} value={`-${fmt(impot)}`}
                  valueColor="text-amber-400" isRTL={isRTL} />

                <div className="border-t border-border pt-2 mt-2">
                  <DetailRow icon={<Wallet className="h-3.5 w-3.5" />}
                    label={isRTL ? 'المتبقي تقريباً' : 'Il te resterait environ'}
                    value={fmt(disponible)} valueColor={amtColor} isRTL={isRTL} bold />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {hasData && (
        <>
          {/* ═══ RESERVE CARD ═══ */}
          <div className="rounded-2xl border border-amber-500/20 bg-card p-4 space-y-3">
            <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
              <PiggyBank className="h-5 w-5 text-amber-400" />
              <h3 className={cn('text-sm font-bold text-foreground', isRTL && 'font-cairo')}>
                {isRTL ? '📦 المبلغ الذي يجب وضعه جانباً' : '📦 À mettre de côté'}
              </h3>
            </div>
            <div className="space-y-1.5">
              {!isTvaExempt && (
                <ReserveRow label="TVA" value={fmt(tvaNet)} color="text-sky-400" isRTL={isRTL} />
              )}
              <ReserveRow label="URSSAF" value={fmt(urssaf)} color="text-violet-400" isRTL={isRTL} />
              <ReserveRow label={isRTL ? 'الضريبة' : 'Impôt'} value={fmt(impot)} color="text-amber-400" isRTL={isRTL} />
              <div className="border-t border-border pt-2">
                <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
                  <span className={cn('text-xs font-bold text-foreground', isRTL && 'font-cairo')}>
                    {isRTL ? 'الإجمالي الموصى به' : 'Total recommandé'}
                  </span>
                  <span className="text-sm font-black text-amber-400">{fmt(totalReserve)}</span>
                </div>
              </div>
            </div>
            <p className={cn('text-[10px] text-muted-foreground leading-relaxed', isRTL && 'font-cairo text-right')}>
              {isRTL ? 'عشان ما تتفاجئش، حاول تخلي المبلغ ده جنب.' : 'Pour éviter les surprises, il est conseillé de garder cette somme de côté.'}
            </p>
          </div>

          {/* ═══ HEALTH CARD ═══ */}
          <div className={cn('rounded-2xl border p-4', hc.border, 'bg-card')}>
            <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
              <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                <Heart className={cn('h-4 w-4', hc.color)} />
                <span className={cn('text-sm font-bold text-foreground', isRTL && 'font-cairo')}>
                  {isRTL ? 'الحالة المالية' : 'Santé financière'}
                </span>
              </div>
              <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', hc.bg, hc.color, isRTL && 'font-cairo')}>
                {hc.icon} {isRTL ? hc.labelAr : hc.labelFr}
              </span>
            </div>
            <p className={cn('text-[11px] text-muted-foreground mt-2', isRTL && 'font-cairo text-right')}>
              {isRTL ? hc.msgAr : hc.msgFr}
            </p>
          </div>

          {/* ═══ TIPS ═══ */}
          {tips.length > 0 && (
            <div className="rounded-2xl border border-accent/15 bg-card p-4 space-y-2">
              <button
                onClick={() => setShowTips(!showTips)}
                className={cn('flex items-center justify-between w-full', isRTL && 'flex-row-reverse')}
              >
                <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                  <Lightbulb className="h-4 w-4 text-accent" />
                  <span className={cn('text-sm font-bold text-foreground', isRTL && 'font-cairo')}>
                    {isRTL ? 'نصائح شبيك لبيك' : 'Conseils de شبيك لبيك'}
                  </span>
                </div>
                {showTips ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showTips && (
                <div className="space-y-2 pt-1">
                  {tips.map((tip, i) => (
                    <div key={i} className={cn('flex items-start gap-2 rounded-lg bg-muted/30 p-2.5', isRTL && 'flex-row-reverse')}>
                      <span className="text-accent text-xs mt-0.5">💡</span>
                      <p className={cn('text-[11px] text-foreground/80 leading-relaxed', isRTL && 'font-cairo text-right')}>
                        {isRTL ? tip.ar : tip.fr}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ SUMMARY ═══ */}
          <div className="rounded-2xl border border-accent/10 bg-muted/20 p-4">
            <div className={cn('flex items-start gap-2', isRTL && 'flex-row-reverse')}>
              <span className="text-lg shrink-0">🧞‍♂️</span>
              <div className={isRTL ? 'text-right' : ''}>
                <p className={cn('text-xs font-bold text-accent mb-1', isRTL && 'font-cairo')}>
                  {isRTL ? 'ملخص شبيك لبيك' : 'Résumé de شبيك لبيك'}
                </p>
                <p className={cn('text-[11px] text-foreground/70 leading-relaxed', isRTL && 'font-cairo')}>
                  {isRTL ? summaryAr : summaryFr}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Sub-components ──
const DetailRow = ({ icon, label, value, valueColor, isRTL, bold }: {
  icon: React.ReactNode; label: string; value: string; valueColor: string; isRTL: boolean; bold?: boolean;
}) => (
  <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
    <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
      {icon}
      <span className={cn('text-[11px] text-muted-foreground', isRTL && 'font-cairo', bold && 'text-foreground font-bold')}>
        {label}
      </span>
    </div>
    <span className={cn('text-xs font-mono', valueColor, bold && 'text-sm font-black')}>{value}</span>
  </div>
);

const ReserveRow = ({ label, value, color, isRTL }: {
  label: string; value: string; color: string; isRTL: boolean;
}) => (
  <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
    <span className={cn('text-[11px] text-muted-foreground', isRTL && 'font-cairo')}>{label}</span>
    <span className={cn('text-xs font-mono', color)}>{value}</span>
  </div>
);

export default ShbikLbikCard;
