import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Users, Info, MapPin, CalendarDays, Minus, Plus, Package, ShieldAlert, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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

interface WorkerDetail {
  role_fr: string;
  role_ar: string;
  count: number;
  daily_rate?: number;
}

interface Labor {
  workers?: WorkerDetail[];
  total_workers?: number;
  workers_needed?: number;
  days_needed: number;
  daily_rate?: number;
  daily_rate_total?: number;
  total?: number;
}

interface SafetyAlert {
  title_fr: string;
  title_ar: string;
  description_fr: string;
  description_ar: string;
  severity: string;
}

interface MaterialProvider {
  client_provides_fr: string[];
  client_provides_ar: string[];
  contractor_provides_fr: string[];
  contractor_provides_ar: string[];
  tools_needed_fr: string[];
  tools_needed_ar: string[];
}

interface MaterialItem {
  id: string;
  name_fr: string;
  name_ar: string;
  quantity: string;
  why_important_fr: string;
  why_important_ar: string;
  is_critical: boolean;
}

interface MaterialCategory {
  name_fr: string;
  name_ar: string;
  items: MaterialItem[];
}

interface Risk {
  fr: string;
  ar: string;
}

export interface AnalysisData {
  summary: { fr: string; ar: string };
  location_impact?: LocationImpact;
  phases?: Phase[];
  material_provider?: MaterialProvider;
  categories?: MaterialCategory[];
  labor: Labor;
  safety_alerts?: SafetyAlert[];
  risks?: Risk[];
  // Legacy fields — ignored
  financial?: any;
  social_charges?: any;
}

interface InteractivePricingProps {
  data: AnalysisData;
  isFr: boolean;
  isRTL: boolean;
}

// Strip ALL markdown symbols — zero stars policy
const stripMd = (text: string): string =>
  text
    .replace(/\*{1,3}/g, '')
    .replace(/_{1,3}/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();

const hasScaffolding = (text: string): boolean =>
  /إيشافوداج|[eé]chafaudage/i.test(text);

const renderWithScaffoldingHighlight = (text: string, className?: string) => {
  const cleaned = stripMd(text);
  if (!hasScaffolding(cleaned)) return <span className={className}>{cleaned}</span>;
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
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const [workerAdjustments, setWorkerAdjustments] = useState<Record<number, number>>(() => {
    const init: Record<number, number> = {};
    (data.labor.workers || []).forEach((w, i) => { init[i] = w.count; });
    return init;
  });
  const [daysOverride, setDaysOverride] = useState(data.labor.days_needed);

  const adjustWorker = (idx: number, delta: number) => {
    setWorkerAdjustments(prev => ({ ...prev, [idx]: Math.max(0, (prev[idx] ?? 0) + delta) }));
  };

  const totalWorkers = data.labor.workers
    ? data.labor.workers.reduce((sum, w, i) => sum + (workerAdjustments[i] ?? w.count), 0)
    : (data.labor.total_workers || data.labor.workers_needed || 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Disclaimer */}
      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
        <p className={cn("text-xs font-bold text-blue-700 dark:text-blue-300 leading-[1.9]", isRTL && "text-right")}>
          {isFr
            ? '📋 Cet outil fournit une estimation technique uniquement et ne comprend pas de calculs financiers officiels.'
            : '📋 الأداة دي بتقدّم تقدير فني بس يا فندم، ومفيهاش أي حسابات مالية رسمية'}
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-2xl p-4 border border-amber-200 dark:border-amber-800">
        <p className={cn("text-sm font-bold text-foreground leading-[1.9]", isRTL && "text-right")}>
          {renderWithScaffoldingHighlight(isFr ? data.summary.fr : data.summary.ar)}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-background rounded-xl border p-3 text-center">
          <p className="text-2xl font-black text-primary">{totalWorkers}</p>
          <p className="text-xs font-bold text-muted-foreground mt-1">{isFr ? 'Ouvriers' : 'عمّال'}</p>
        </div>
        <div className="bg-background rounded-xl border p-3 text-center">
          <p className="text-2xl font-black text-primary">{daysOverride} {isFr ? 'j' : 'يوم'}</p>
          <p className="text-xs font-bold text-muted-foreground mt-1">{isFr ? 'Durée estimée' : 'المدة المتوقعة يا فندم'}</p>
        </div>
      </div>

      {/* Location Impact */}
      {data.location_impact && (
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className={cn("flex items-center gap-2 mb-2", isRTL && "flex-row-reverse")}>
              <MapPin className="h-5 w-5 text-emerald-500" />
              <h3 className="text-sm font-black text-foreground">
                {isFr ? `Localisation : ${data.location_impact.zone}` : `المكان: ${data.location_impact.zone}`}
              </h3>
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

      {/* Materials List (categories) */}
      {data.categories && data.categories.length > 0 && data.categories.map((cat, ci) => (
        <Card key={ci}>
          <CardHeader className="pb-2">
            <CardTitle className={cn("text-sm font-black flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <ClipboardList className="h-5 w-5 text-teal-500" />
              {isFr ? cat.name_fr : cat.name_ar}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {cat.items.map((item) => {
              const isExpanded = expandedItems[item.id];
              return (
                <div key={item.id} className="rounded-xl border p-3">
                  <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
                    <div className="flex-1 min-w-0">
                      <div className={cn("flex items-center justify-between gap-2", isRTL && "flex-row-reverse")}>
                        <p className="text-sm font-bold text-foreground">
                          {renderWithScaffoldingHighlight(isFr ? item.name_fr : item.name_ar)}
                          {item.is_critical && <span className="text-red-500 ml-1">*</span>}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{stripMd(item.quantity)}</p>

                      <button onClick={() => setExpandedItems(prev => ({ ...prev, [item.id]: !prev[item.id] }))} className={cn("flex items-center gap-1 mt-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors", isRTL && "flex-row-reverse")}>
                        <Info className="h-3 w-3" />
                        {isFr ? 'Pourquoi ?' : 'ليه؟'}
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {isExpanded && (
                        <p className={cn("text-xs text-muted-foreground mt-1 p-2 bg-muted/50 rounded-lg leading-[1.9]", isRTL && "text-right")}>
                          {renderWithScaffoldingHighlight(isFr ? item.why_important_fr : item.why_important_ar)}
                        </p>
                      )}
                    </div>
                  </div>
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
                  <p className="text-sm font-bold">{isFr ? w.role_fr : w.role_ar}</p>
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
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <p className="text-lg font-black">{totalWorkers}</p>
              <p className="text-[10px] font-bold text-muted-foreground">{isFr ? 'Ouvriers' : 'عمال'}</p>
            </div>
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
        </CardContent>
      </Card>

      {/* Safety Alerts */}
      {data.safety_alerts && data.safety_alerts.length > 0 && (
        <Card className="border-orange-300 dark:border-orange-700 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30">
          <CardContent className="p-4 space-y-3">
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <ShieldAlert className="h-5 w-5 text-orange-600" />
            <h3 className="text-sm font-black text-orange-700 dark:text-orange-400">
                {isFr ? '🛡️ Alertes Sécurité' : '🛡️ تنبيهات أمان يا فندم'}
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

      {/* Risks from AI */}
      {data.risks && data.risks.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border-2 border-red-300 dark:border-red-700 rounded-2xl p-4 space-y-2">
          <div className={cn("flex items-center gap-2 mb-2", isRTL && "flex-row-reverse")}>
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <h4 className="font-black text-red-700 dark:text-red-400">
              {isFr ? '⚠️ Risques à surveiller' : '⚠️ مخاطر لازم تاخد بالك منها'}
            </h4>
          </div>
          {data.risks.map((risk, i) => (
            <p key={i} className={cn("text-sm font-bold text-red-600 dark:text-red-300 leading-[1.9]", isRTL && "text-right")}>
              • {stripMd(isFr ? risk.fr : risk.ar)}
            </p>
          ))}
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

export default InteractivePricing;
