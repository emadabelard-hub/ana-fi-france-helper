import React from 'react';
import { AlertTriangle, TrendingUp, Users, BadgeEuro } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisData {
  totalDaysNeeded: number;
  workersNeeded: number;
  needsReinforcement: boolean;
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  gainNetJournalier: number;
  tvaRate: number;
  margeAmount: number;
  beneficeAmount: number;
}

interface AnalysisResultProps {
  data: AnalysisData;
  isFr: boolean;
  isRTL: boolean;
  surface: string;
  days: string;
  wallCondition: string;
  equipmentRental: boolean;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ data, isFr, isRTL, surface, days, wallCondition, equipmentRental }) => {
  const isDailyGainLow = data.gainNetJournalier < 200;

  return (
    <div className="relative rounded-2xl border border-white/20 p-5 space-y-4 animate-fade-in overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(249,115,22,0.12) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(245,158,11,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
      }}>
      {/* Decorative glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      <h3 className={cn("text-lg font-black flex items-center gap-2 text-amber-600 dark:text-amber-400", isRTL && "flex-row-reverse")}>
        <TrendingUp className="h-5 w-5" />
        {isFr ? 'Analyse Financière Complète' : 'التحليل المالي الشامل'}
      </h3>

      {/* Financial Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox label={isFr ? 'Total HT' : 'المجموع بدون ضريبة'} value={`${data.totalHT.toFixed(0)} €`} color="text-primary" />
        <StatBox label={isFr ? `TVA (${data.tvaRate}%)` : `الضريبة (${data.tvaRate}%)`} value={`${data.totalTVA.toFixed(0)} €`} color="text-orange-500" />
        <StatBox label={isFr ? 'Total TTC' : 'المجموع مع الضريبة'} value={`${data.totalTTC.toFixed(0)} €`} color="text-amber-600 dark:text-amber-400" large />
        <StatBox label={isFr ? 'Gain Net / Jour' : 'الربح الصافي / يوم'} value={`${data.gainNetJournalier.toFixed(0)} €`} color={isDailyGainLow ? "text-red-500" : "text-green-600"} large />
      </div>

      {/* Staffing & Details */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat icon={<Users className="h-4 w-4" />} label={isFr ? 'Ouvriers' : 'عمال'} value={data.workersNeeded} />
        <MiniStat icon={<BadgeEuro className="h-4 w-4" />} label={isFr ? 'Marge' : 'هامش'} value={`${data.margeAmount.toFixed(0)}€`} />
        <MiniStat icon={<BadgeEuro className="h-4 w-4" />} label={isFr ? 'Bénéfice' : 'ربح'} value={`${data.beneficeAmount.toFixed(0)}€`} />
      </div>

      {/* Wall condition + equipment notes */}
      {wallCondition === 'damaged' && (
        <p className={cn("text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-950/50 p-3 rounded-xl", isRTL && "text-right")}>
          ⚠️ {isFr ? 'Murs abîmés : rendement réduit de 30%' : 'الحيطان متخربة: الإنتاجية أقل بـ30%'}
        </p>
      )}

      {equipmentRental && (
        <p className={cn("text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 p-3 rounded-xl", isRTL && "text-right")}>
          🛠️ {isFr ? 'Coût échafaudage inclus dans le calcul' : 'تكلفة السقالات محسوبة'}
        </p>
      )}

      {/* Reinforcement Alert */}
      {data.needsReinforcement && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/50 dark:to-orange-950/50 border-2 border-red-300 dark:border-red-700 rounded-2xl p-4">
          <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
            <AlertTriangle className="h-8 w-8 text-red-500 shrink-0 mt-1" />
            <div className={isRTL ? "text-right" : ""}>
              <p className="font-black text-lg text-red-700 dark:text-red-400">
                Ya Batal, il te faut du renfort !
              </p>
              <p className="text-sm font-bold text-red-600 dark:text-red-300 mt-1">
                {isFr
                  ? `${data.workersNeeded} ouvriers pour ${surface}m² en ${days} jour(s).`
                  : `محتاج ${data.workersNeeded} عمال عشان تخلص ${surface}م² في ${days} يوم.`
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {!data.needsReinforcement && (
        <div className="bg-green-50 dark:bg-green-950/50 border border-green-300 dark:border-green-700 rounded-2xl p-4">
          <p className={cn("font-black text-green-700 dark:text-green-400", isRTL && "text-right")}>
            ✅ {isFr
              ? `Faisable seul en ${data.totalDaysNeeded} jour(s). Bon courage !`
              : `تقدر تخلصها لوحدك في ${data.totalDaysNeeded} يوم. بالتوفيق!`
            }
          </p>
        </div>
      )}

      {/* Grand Frère Advice */}
      {isDailyGainLow && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border-2 border-purple-300 dark:border-purple-700 rounded-2xl p-4 animate-fade-in">
          <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
            <span className="text-3xl">🧔</span>
            <div className={isRTL ? "text-right" : ""}>
              <p className="font-black text-lg text-purple-700 dark:text-purple-400">
                {isFr ? '💡 Conseil du Grand Frère' : '💡 نصيحة الخو الكبير'}
              </p>
              <p className="text-sm font-bold text-purple-600 dark:text-purple-300 mt-1">
                {isFr
                  ? `Attention Ya Batal, ${data.gainNetJournalier.toFixed(0)}€/jour c'est trop bas ! Augmente ton prix ou réduis tes coûts.`
                  : `انتبه يا بطل، ${data.gainNetJournalier.toFixed(0)}€ في اليوم قليلة بزاف! زيد في السعر ولا نقص المصاريف.`
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatBox = ({ label, value, color, large }: { label: string; value: string; color: string; large?: boolean }) => (
  <div className="bg-background/60 backdrop-blur-sm rounded-xl p-3 text-center border border-white/10">
    <p className={cn("font-black", color, large ? "text-2xl" : "text-xl")}>{value}</p>
    <p className="text-xs font-bold text-muted-foreground mt-1">{label}</p>
  </div>
);

const MiniStat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="bg-background/40 backdrop-blur-sm rounded-lg p-2 text-center border border-white/10">
    <div className="flex justify-center text-muted-foreground mb-1">{icon}</div>
    <p className="text-sm font-black">{value}</p>
    <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
  </div>
);

export default AnalysisResult;
