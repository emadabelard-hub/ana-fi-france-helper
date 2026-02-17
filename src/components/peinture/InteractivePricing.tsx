import React, { useState, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, TrendingUp, Users, Info, MapPin, CalendarDays, Minus, Plus, Package, Wallet, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface PremiumOption {
  name_fr: string;
  name_ar: string;
  unit_price: number;
  total_price: number;
}

interface LineItem {
  id: string;
  name_fr: string;
  name_ar: string;
  quantity: string;
  unit_price: number;
  total_price: number;
  tier: string;
  premium_option?: PremiumOption | null;
  why_important_fr: string;
  why_important_ar: string;
  is_critical: boolean;
  selected: boolean;
}

interface Category {
  name_fr: string;
  name_ar: string;
  items: LineItem[];
}

interface WorkerDetail {
  role_fr: string;
  role_ar: string;
  count: number;
  daily_rate: number;
}

interface PhaseWorker {
  role_fr: string;
  role_ar: string;
  count: number;
}

interface Phase {
  phase_number: number;
  name_fr: string;
  name_ar: string;
  duration_days: number;
  description_fr: string;
  description_ar: string;
  workers: PhaseWorker[];
}

interface LocationImpact {
  zone: string;
  cost_multiplier: number;
  explanation_fr: string;
  explanation_ar: string;
}

interface Labor {
  workers?: WorkerDetail[];
  total_workers?: number;
  workers_needed?: number;
  days_needed: number;
  daily_rate?: number;
  daily_rate_total?: number;
  total: number;
}

interface Risk {
  fr: string;
  ar: string;
}

interface SafetyAlert {
  title_fr: string;
  title_ar: string;
  description_fr: string;
  description_ar: string;
  severity: string;
}

interface SocialChargeEntry {
  rate_pct: number;
  amount: number;
  net_income: number;
  label_fr: string;
  label_ar: string;
}

interface MaterialProvider {
  client_provides_fr: string[];
  client_provides_ar: string[];
  contractor_provides_fr: string[];
  contractor_provides_ar: string[];
  tools_needed_fr: string[];
  tools_needed_ar: string[];
}

export interface AnalysisData {
  summary: { fr: string; ar: string };
  location_impact?: LocationImpact;
  phases?: Phase[];
  material_provider?: MaterialProvider;
  categories: Category[];
  labor: Labor;
  financial: {
    subtotal_materials: number;
    subtotal_labor: number;
    margin_pct: number;
    margin_amount: number;
    total_ht: number;
    tva_rate: number;
    tva_amount: number;
    total_ttc: number;
    daily_profit: number;
  };
  social_charges?: {
    auto_entrepreneur: SocialChargeEntry;
    sarl: SocialChargeEntry;
  };
  safety_alerts?: SafetyAlert[];
  risks: Risk[];
}

interface InteractivePricingProps {
  data: AnalysisData;
  isFr: boolean;
  isRTL: boolean;
}

// Strip ALL markdown symbols from AI text — zero stars policy
const stripMd = (text: string): string =>
  text
    .replace(/\*{1,3}/g, '')
    .replace(/_{1,3}/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();

// Check if text mentions scaffolding (إيشافوداج / Échafaudage) for red highlight
const hasScaffolding = (text: string): boolean =>
  /إيشافوداج|[eé]chafaudage/i.test(text);

// Render text with scaffolding highlighted in red
const renderWithScaffoldingHighlight = (text: string, className?: string) => {
  const cleaned = stripMd(text);
  if (!hasScaffolding(cleaned)) return <span className={className}>{cleaned}</span>;
  // Split around scaffolding terms and highlight them
  const parts = cleaned.split(/(إيشافوداج|[Éé]chafaudage)/gi);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        /إيشافوداج|[éÉ]chafaudage/i.test(part) ? (
          <span key={i} className="text-red-600 dark:text-red-400 font-black bg-red-50 dark:bg-red-950/50 px-1 rounded">
            ⚠️ {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
};

const InteractivePricing: React.FC<InteractivePricingProps> = ({ data, isFr, isRTL }) => {
  const [selections, setSelections] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    data.categories.forEach(cat => cat.items.forEach(item => { init[item.id] = item.selected; }));
    return init;
  });
  const [premiumChoices, setPremiumChoices] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});

  const [workerAdjustments, setWorkerAdjustments] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    (data.labor.workers || []).forEach((w, i) => { init[i] = w.count; });
    return init;
  });
  const [daysOverride, setDaysOverride] = useState(data.labor.days_needed);

  const toggleSelection = (id: string) => setSelections(prev => ({ ...prev, [id]: !prev[id] }));
  const togglePremium = (id: string) => setPremiumChoices(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleExpand = (id: string) => setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  const adjustWorker = (idx: number, delta: number) => {
    setWorkerAdjustments(prev => ({ ...prev, [idx]: Math.max(0, (prev[idx] ?? 0) + delta) }));
  };

  const totals = useMemo(() => {
    let materialTotal = 0;
    const deselectedCritical: Risk[] = [];

    data.categories.forEach(cat => {
      cat.items.forEach(item => {
        if (selections[item.id]) {
          const isPremium = premiumChoices[item.id] && item.premium_option;
          materialTotal += isPremium ? item.premium_option!.total_price : item.total_price;
        } else if (item.is_critical) {
          deselectedCritical.push({
            fr: `⚠️ ${item.name_fr} retiré : ${item.why_important_fr}`,
            ar: `⚠️ ${item.name_ar} تم حذفه: ${item.why_important_ar}`,
          });
        }
      });
    });

    let laborTotal = 0;
    if (data.labor.workers && data.labor.workers.length > 0) {
      data.labor.workers.forEach((w, i) => {
        const count = workerAdjustments[i] ?? w.count;
        laborTotal += count * w.daily_rate * daysOverride;
      });
    } else {
      laborTotal = (data.labor.daily_rate || data.labor.daily_rate_total || 0) * daysOverride;
    }

    const subtotal = materialTotal + laborTotal;
    const marginAmount = subtotal * (data.financial.margin_pct / 100);
    const totalHT = subtotal + marginAmount;
    const tvaAmount = totalHT * (data.financial.tva_rate / 100);
    const totalTTC = totalHT + tvaAmount;
    // Gross margin = what you keep after paying materials + labor
    const grossMargin = totalHT - materialTotal - laborTotal;

    // Social charges — both calculated on gross margin only
    const aeRate = data.social_charges?.auto_entrepreneur?.rate_pct ?? 22;
    const sarlRate = data.social_charges?.sarl?.rate_pct ?? 45;
    const aeCharges = grossMargin * (aeRate / 100);
    const aeNet = grossMargin - aeCharges;
    const sarlCharges = grossMargin * (sarlRate / 100);
    const sarlNet = grossMargin - sarlCharges;

    // Daily net profit (gross margin / days)
    const dailyProfit = daysOverride > 0 ? grossMargin / daysOverride : 0;
    const aeDailyProfit = daysOverride > 0 ? aeNet / daysOverride : 0;
    const sarlDailyProfit = daysOverride > 0 ? sarlNet / daysOverride : 0;

    return { materialTotal, laborTotal, marginAmount, totalHT, tvaAmount, totalTTC, dailyProfit, deselectedCritical, aeCharges, aeNet, sarlCharges, sarlNet, grossMargin, aeDailyProfit, sarlDailyProfit };
  }, [selections, premiumChoices, data, workerAdjustments, daysOverride]);

  const isDailyProfitLow = totals.dailyProfit < 200;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl p-4 border border-amber-200 dark:border-amber-800">
        <p className={cn("text-sm font-bold text-foreground leading-[1.9]", isRTL && "text-right")}>
          {renderWithScaffoldingHighlight(isFr ? data.summary.fr : data.summary.ar)}
        </p>
      </div>

      {/* Location Impact */}
      {data.location_impact && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className={cn("flex items-center gap-2 mb-2", isRTL && "flex-row-reverse")}>
              <MapPin className="h-5 w-5 text-emerald-500" />
              <h3 className="text-sm font-black text-foreground">
                {isFr ? `Impact localisation : ${data.location_impact.zone}` : `تأثير المكان: ${data.location_impact.zone}`}
              </h3>
              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                ×{data.location_impact.cost_multiplier}
              </span>
            </div>
            <p className={cn("text-xs font-bold text-muted-foreground leading-[1.9]", isRTL && "text-right")}>
              {renderWithScaffoldingHighlight(isFr ? data.location_impact.explanation_fr : data.location_impact.explanation_ar)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Phases */}
      {data.phases && data.phases.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-sm font-black flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <CalendarDays className="h-5 w-5 text-primary" />
              {isFr ? 'Phases du Chantier' : 'مراحل الشانتييه (Chantier)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {data.phases.map((phase) => (
              <div key={phase.phase_number} className="rounded-xl border p-3">
                <button
                  onClick={() => setExpandedPhases(prev => ({ ...prev, [phase.phase_number]: !prev[phase.phase_number] }))}
                  className={cn("flex items-center justify-between w-full gap-2", isRTL && "flex-row-reverse")}
                >
                  <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                    <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {isFr ? `Phase ${phase.phase_number}` : `المرحلة ${phase.phase_number}`}
                    </span>
                    <span className="text-sm font-bold">{isFr ? phase.name_fr : phase.name_ar}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      {phase.duration_days} {isFr ? 'j' : 'يوم'}
                    </span>
                    {expandedPhases[phase.phase_number] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
                {expandedPhases[phase.phase_number] && (
                  <div className="mt-2 space-y-2">
                    <p className={cn("text-xs text-muted-foreground leading-[1.9]", isRTL && "text-right")}>
                      {renderWithScaffoldingHighlight(isFr ? phase.description_fr : phase.description_ar)}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {phase.workers.map((w, wi) => (
                        <span key={wi} className="text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg">
                          {w.count}× {isFr ? w.role_fr : w.role_ar}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Material Provider */}
      {data.material_provider && <MaterialProviderCard data={data.material_provider} isFr={isFr} isRTL={isRTL} />}

      {/* Categories */}
      {data.categories.map((cat, ci) => (
        <Card key={ci}>
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-sm font-black flex items-center gap-2", isRTL && "flex-row-reverse")}>
              {isFr ? cat.name_fr : cat.name_ar}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {cat.items.map((item) => {
              const isSelected = selections[item.id];
              const isPremium = premiumChoices[item.id] && item.premium_option;
              const isExpanded = expandedItems[item.id];
              const currentPrice = isPremium ? item.premium_option!.total_price : item.total_price;

              return (
                <div key={item.id} className={cn(
                  "rounded-xl border p-3 transition-all",
                  isSelected ? "bg-background border-border" : "bg-muted/30 border-transparent opacity-60",
                  item.is_critical && !isSelected && "border-red-300 dark:border-red-700 opacity-100"
                )}>
                  <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(item.id)} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className={cn("flex items-center justify-between gap-2", isRTL && "flex-row-reverse")}>
                        <p className={cn("text-sm font-bold text-foreground", !isSelected && "line-through")}>
                          {renderWithScaffoldingHighlight(isFr ? item.name_fr : item.name_ar)}
                          {item.is_critical && <span className="text-red-500 ml-1">*</span>}
                        </p>
                        <span className="text-sm font-black text-primary whitespace-nowrap">{currentPrice.toFixed(0)} €</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{stripMd(item.quantity)}</p>

                      {item.premium_option && isSelected && (
                        <button onClick={() => togglePremium(item.id)} className={cn(
                          "mt-1.5 text-xs font-bold px-2 py-1 rounded-md transition-colors",
                          isPremium ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}>
                          {isPremium ? '⭐' : '↑'} {isFr ? item.premium_option.name_fr : item.premium_option.name_ar} ({item.premium_option.total_price.toFixed(0)} €)
                        </button>
                      )}

                      <button onClick={() => toggleExpand(item.id)} className={cn("flex items-center gap-1 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors", isRTL && "flex-row-reverse")}>
                        <Info className="h-3 w-3" />
                        {isFr ? 'Pourquoi ?' : 'لماذا؟'}
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {isExpanded && (
                        <p className={cn("text-xs text-muted-foreground mt-1 p-2 bg-muted/50 rounded-lg leading-[1.9]", isRTL && "text-right")}>
                          {renderWithScaffoldingHighlight(isFr ? item.why_important_fr : item.why_important_ar)}
                        </p>
                      )}
                    </div>
                  </div>
                  {item.is_critical && !isSelected && (
                    <div className={cn("flex items-center gap-2 mt-2 text-xs font-bold text-red-600 dark:text-red-400", isRTL && "flex-row-reverse")}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {isFr ? 'Élément critique retiré — risque technique !' : 'عنصر حساس محذوف — خطر تقني!'}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Labor — Interactive */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardContent className="p-4 space-y-3">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <Users className="h-5 w-5 text-blue-500" />
            <h3 className="text-sm font-black text-foreground">{isFr ? "Main d'œuvre (ajustable)" : 'العمالة (تقدر تعدّل)'}</h3>
          </div>

          {data.labor.workers && data.labor.workers.length > 0 ? (
            <div className="space-y-2">
              {data.labor.workers.map((w, i) => (
                <div key={i} className={cn("flex items-center justify-between bg-muted/50 rounded-lg p-2.5", isRTL && "flex-row-reverse")}>
                  <div>
                    <p className="text-sm font-bold">{isFr ? w.role_fr : w.role_ar}</p>
                    <p className="text-[10px] text-muted-foreground">{w.daily_rate}€/{isFr ? 'jour' : 'يوم'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => adjustWorker(i, -1)} className="h-7 w-7 rounded-full bg-background border flex items-center justify-center hover:bg-muted transition-colors">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-lg font-black w-6 text-center">{workerAdjustments[i] ?? w.count}</span>
                    <button onClick={() => adjustWorker(i, 1)} className="h-7 w-7 rounded-full bg-background border flex items-center justify-center hover:bg-muted transition-colors">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MiniStat label={isFr ? 'Ouvriers' : 'عمال'} value={data.labor.total_workers || data.labor.workers_needed || 0} />
          )}

          {/* Days adjustment */}
          <div className={cn("flex items-center justify-between bg-muted/50 rounded-lg p-2.5", isRTL && "flex-row-reverse")}>
            <div>
              <p className="text-sm font-bold">{isFr ? 'Durée du chantier' : 'مدة الشانتييه (Chantier)'}</p>
              <p className="text-[10px] text-muted-foreground">{isFr ? 'jours' : 'أيام'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setDaysOverride(d => Math.max(1, d - 1))} className="h-7 w-7 rounded-full bg-background border flex items-center justify-center hover:bg-muted transition-colors">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-lg font-black w-8 text-center">{daysOverride}</span>
              <button onClick={() => setDaysOverride(d => d + 1)} className="h-7 w-7 rounded-full bg-background border flex items-center justify-center hover:bg-muted transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2.5 text-center">
            <p className="text-lg font-black text-blue-600 dark:text-blue-400">{totals.laborTotal.toFixed(0)} €</p>
            <p className="text-[10px] font-bold text-muted-foreground">{isFr ? "Total main d'œuvre" : 'مجموع اليد العاملة'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <div className="relative rounded-2xl border border-white/20 p-5 space-y-4 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(249,115,22,0.12) 100%)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}>
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <h3 className={cn("text-lg font-black flex items-center gap-2 text-amber-600 dark:text-amber-400", isRTL && "flex-row-reverse")}>
          <TrendingUp className="h-5 w-5" />
          {isFr ? 'Synthèse Financière' : 'الملخص المالي'}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatBox label={isFr ? 'Matériaux' : 'المواد'} value={`${totals.materialTotal.toFixed(0)} €`} color="text-foreground" />
          <StatBox label={isFr ? "Main d'œuvre" : 'اليد العاملة'} value={`${totals.laborTotal.toFixed(0)} €`} color="text-blue-500" />
          <StatBox label={isFr ? `Marge (${data.financial.margin_pct}%)` : `هامش (${data.financial.margin_pct}%)`} value={`${totals.marginAmount.toFixed(0)} €`} color="text-amber-500" />
          <StatBox label={isFr ? `TVA (${data.financial.tva_rate}%)` : `ضريبة (${data.financial.tva_rate}%)`} value={`${totals.tvaAmount.toFixed(0)} €`} color="text-orange-500" />
          <StatBox label={isFr ? 'Total TTC' : 'المجموع الكلي'} value={`${totals.totalTTC.toFixed(0)} €`} color="text-amber-600 dark:text-amber-400" large />
          <StatBox label={isFr ? 'Marge brute' : 'هامش الربح'} value={`${totals.grossMargin.toFixed(0)} €`} color="text-emerald-600" large />
        </div>
      </div>

      {/* Social Charges & Net Income */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardContent className="p-4 space-y-3">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <Wallet className="h-5 w-5 text-purple-500" />
            <h3 className="text-sm font-black text-foreground">
              {isFr ? 'Revenu Net Réel (après charges)' : 'صافي ربحك الحقيقي (بعد الأعباء)'}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* Auto-entrepreneur */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-xl p-3 space-y-1.5">
              <p className={cn("text-xs font-black text-indigo-700 dark:text-indigo-300", isRTL && "text-right")}>
                {isFr ? 'Auto-entrepreneur (23.1% charges)' : 'أوتو أونتروبرونور (Auto-entrepreneur) — أعباء 23.1%'}
              </p>
              <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                <span className="text-xs text-muted-foreground">{isFr ? 'Charges sociales' : 'الأعباء الاجتماعية'}</span>
                <span className="text-sm font-black text-red-500">-{totals.aeCharges.toFixed(0)} €</span>
              </div>
              <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                <span className="text-xs font-bold text-foreground">{isFr ? 'Revenu net' : 'الدخل الصافي'}</span>
                <span className={cn("text-lg font-black", totals.aeNet > 0 ? "text-green-600" : "text-red-500")}>{totals.aeNet.toFixed(0)} €</span>
              </div>
              <div className={cn("flex items-center justify-between border-t border-indigo-200 dark:border-indigo-700 pt-1.5 mt-1", isRTL && "flex-row-reverse")}>
                <span className="text-xs font-bold text-foreground">{isFr ? 'Profit net / jour' : 'صافي ربحك اليومي'}</span>
                <span className={cn("text-sm font-black", totals.aeDailyProfit > 0 ? "text-green-600" : "text-red-500")}>{totals.aeDailyProfit.toFixed(0)} €/{isFr ? 'j' : 'يوم'}</span>
              </div>
            </div>

            {/* SARL */}
            <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 rounded-xl p-3 space-y-1.5">
              <p className={cn("text-xs font-black text-violet-700 dark:text-violet-300", isRTL && "text-right")}>
                {isFr ? 'SARL/EURL (~45% charges sur bénéfice)' : 'ساغل (SARL/EURL) — أعباء 45% على الربح'}
              </p>
              <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                <span className="text-xs text-muted-foreground">{isFr ? 'Charges sociales' : 'شارج (Charges)'}</span>
                <span className="text-sm font-black text-red-500">-{totals.sarlCharges.toFixed(0)} €</span>
              </div>
              <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
                <span className="text-xs font-bold text-foreground">{isFr ? 'Revenu net' : 'الدخل الصافي'}</span>
                <span className={cn("text-lg font-black", totals.sarlNet > 0 ? "text-green-600" : "text-red-500")}>{totals.sarlNet.toFixed(0)} €</span>
              </div>
              <div className={cn("flex items-center justify-between border-t border-violet-200 dark:border-violet-700 pt-1.5 mt-1", isRTL && "flex-row-reverse")}>
                <span className="text-xs font-bold text-foreground">{isFr ? 'Profit net / jour' : 'صافي ربحك اليومي'}</span>
                <span className={cn("text-sm font-black", totals.sarlDailyProfit > 0 ? "text-green-600" : "text-red-500")}>{totals.sarlDailyProfit.toFixed(0)} €/{isFr ? 'j' : 'يوم'}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety Alerts */}
      {data.safety_alerts && data.safety_alerts.length > 0 && (
        <Card className="border-orange-300 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30">
          <CardContent className="p-4 space-y-3">
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <ShieldAlert className="h-5 w-5 text-orange-600" />
              <h3 className="text-sm font-black text-orange-700 dark:text-orange-400">
                {isFr ? '🛡️ Alertes Sécurité' : '🛡️ تنبيهات الأمان'}
              </h3>
            </div>
            {data.safety_alerts.map((alert, i) => (
              <div key={i} className={cn(
                "rounded-xl p-3 border",
                alert.severity === 'high'
                  ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/30"
                  : "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
              )}>
                <p className={cn("text-sm font-black text-foreground leading-[1.9]", isRTL && "text-right")}>
                  {alert.severity === 'high' ? '🔴' : '🟡'} {renderWithScaffoldingHighlight(isFr ? alert.title_fr : alert.title_ar)}
                </p>
                <p className={cn("text-xs font-bold text-muted-foreground mt-1 leading-[1.9]", isRTL && "text-right")}>
                  {renderWithScaffoldingHighlight(isFr ? alert.description_fr : alert.description_ar)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Risk Alerts */}
      {totals.deselectedCritical.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border-2 border-red-300 dark:border-red-700 rounded-2xl p-4 space-y-2">
          <div className={cn("flex items-center gap-2 mb-2", isRTL && "flex-row-reverse")}>
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h4 className="font-black text-red-700 dark:text-red-400">
              {isFr ? '⚠️ Alertes de Risque' : '⚠️ تنبيهات المخاطر'}
            </h4>
          </div>
          {totals.deselectedCritical.map((risk, i) => (
            <p key={i} className={cn("text-sm font-bold text-red-600 dark:text-red-300", isRTL && "text-right")}>
              {isFr ? risk.fr : risk.ar}
            </p>
          ))}
        </div>
      )}

      {/* Grand Frère Advice */}
      {isDailyProfitLow && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border-2 border-purple-300 dark:border-purple-700 rounded-2xl p-4">
          <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
            <span className="text-3xl">🧔</span>
            <div className={isRTL ? "text-right" : ""}>
              <p className="font-black text-lg text-purple-700 dark:text-purple-400">
                {isFr ? '💡 Conseil du Grand Frère' : '💡 نصيحة الأخ الكبير'}
              </p>
              <p className="text-sm font-bold text-purple-600 dark:text-purple-300 mt-1">
                {isFr
                  ? `Attention Ya Batal, ${totals.dailyProfit.toFixed(0)}€/jour c'est trop bas ! Augmente ton prix ou choisis les options premium.`
                  : `خد بالك يا بطل، ${totals.dailyProfit.toFixed(0)}€ في اليوم قليلة أوي! زوّد السعر أو اختار الخيارات الممتازة.`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {!isDailyProfitLow && totals.deselectedCritical.length === 0 && (
        <div className="bg-green-50 dark:bg-green-950/50 border border-green-300 dark:border-green-700 rounded-2xl p-4">
          <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="font-black text-green-700 dark:text-green-400">
              {isFr ? 'Chantier rentable ! Bon courage Chef !' : 'المشروع مربح! بالتوفيق يا معلم! 💪'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* Sub-components */

const MaterialProviderCard = ({ data, isFr, isRTL }: { data: MaterialProvider; isFr: boolean; isRTL: boolean }) => (
  <Card className="border-teal-200 dark:border-teal-800">
    <CardHeader className="pb-2">
      <CardTitle className={cn("text-sm font-black flex items-center gap-2", isRTL && "flex-row-reverse")}>
        <Package className="h-5 w-5 text-teal-500" />
        {isFr ? 'Matériel à Fournir — Qui fournit quoi ?' : 'المواد المطلوبة — مين بيجيب إيه؟'}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 pt-0">
      <ProviderList
        title={isFr ? '🏠 Le client fournit' : '🏠 الزبون بيجيب'}
        items={isFr ? data.client_provides_fr : data.client_provides_ar}
        isRTL={isRTL}
        colorClass="text-blue-700 dark:text-blue-300"
        bgClass="bg-blue-50 dark:bg-blue-900/30"
      />
      <ProviderList
        title={isFr ? '🔧 L\'entrepreneur fournit' : '🔧 المقاول بيجيب'}
        items={isFr ? data.contractor_provides_fr : data.contractor_provides_ar}
        isRTL={isRTL}
        colorClass="text-amber-700 dark:text-amber-300"
        bgClass="bg-amber-50 dark:bg-amber-900/30"
      />
      <ProviderList
        title={isFr ? '🛠️ Outillage nécessaire' : '🛠️ العدد والأدوات'}
        items={isFr ? data.tools_needed_fr : data.tools_needed_ar}
        isRTL={isRTL}
        colorClass="text-gray-700 dark:text-gray-300"
        bgClass="bg-gray-50 dark:bg-gray-800/50"
      />
    </CardContent>
  </Card>
);

const ProviderList = ({ title, items, isRTL, colorClass, bgClass }: { title: string; items: string[]; isRTL: boolean; colorClass: string; bgClass: string }) => (
  <div className={cn("rounded-lg p-2.5", bgClass)}>
    <p className={cn("text-xs font-black mb-1.5", colorClass, isRTL && "text-right")}>{title}</p>
    <ul className={cn("list-disc space-y-2 mb-4", isRTL ? "pr-5 text-right" : "ml-5")}>
      {items.map((item, i) => (
         <li key={i} className="text-xs font-bold text-foreground leading-[1.9]">
           {stripMd(item)}
         </li>
      ))}
    </ul>
  </div>
);

const StatBox = ({ label, value, color, large }: { label: string; value: string; color: string; large?: boolean }) => (
  <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
    <p className={cn("font-black", color, large ? "text-2xl" : "text-xl")}>{value}</p>
    <p className="text-xs font-bold text-muted-foreground mt-1">{label}</p>
  </div>
);

const MiniStat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
    <p className="text-lg font-black">{value}</p>
    <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
  </div>
);

export default InteractivePricing;
