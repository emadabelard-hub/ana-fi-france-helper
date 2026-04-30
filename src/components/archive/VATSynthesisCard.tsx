import { Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VATSynthesis } from '@/lib/csvExport';

interface Props {
  synthesis: VATSynthesis;
  isRTL: boolean;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €';

const VATSynthesisCard = ({ synthesis, isRTL }: Props) => {
  const collectedRates = Object.entries(synthesis.collectedByRate).sort();
  const deductibleRates = Object.entries(synthesis.deductibleByRate).sort();
  const hasData = collectedRates.length > 0 || deductibleRates.length > 0;

  if (!hasData) return null;

  return (
    <div className="rounded-xl border border-accent/20 bg-card p-4 shadow-sm">
      <div className={cn('flex items-center gap-2 mb-3', isRTL && 'flex-row-reverse')}>
        <Calculator className="h-4 w-4 text-accent" />
        <h3 className={cn('text-sm font-bold text-accent', isRTL && 'font-cairo')}>
          {isRTL ? 'ملخص الضريبة على القيمة المضافة' : 'Synthèse TVA (aperçu)'}
        </h3>
      </div>

      <div className="space-y-3 text-xs" dir="ltr">
        {/* TVA collectée */}
        {collectedRates.length > 0 && (
          <div>
            <div className="font-bold text-foreground mb-1">TVA collectée (44571)</div>
            <div className="space-y-1">
              {collectedRates.map(([rate, v]) => (
                <div key={rate} className="flex justify-between text-muted-foreground">
                  <span>{rate} · {v.count} écr.</span>
                  <span className="font-mono">{fmt(v.tva)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-1 font-bold text-foreground">
                <span>Total collectée</span>
                <span className="font-mono">{fmt(synthesis.totalCollected)}</span>
              </div>
            </div>
          </div>
        )}

        {/* TVA déductible */}
        {deductibleRates.length > 0 && (
          <div>
            <div className="font-bold text-foreground mb-1">TVA déductible (44566)</div>
            <div className="space-y-1">
              {deductibleRates.map(([rate, v]) => (
                <div key={rate} className="flex justify-between text-muted-foreground">
                  <span>{rate} · {v.count} écr.</span>
                  <span className="font-mono">{fmt(v.tva)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-1 font-bold text-foreground">
                <span>Total déductible</span>
                <span className="font-mono">{fmt(synthesis.totalDeductible)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Net */}
        <div className={cn(
          'flex justify-between rounded-lg px-3 py-2 font-bold',
          synthesis.netToDeclare >= 0
            ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
            : 'bg-green-500/10 text-green-700 dark:text-green-300'
        )}>
          <span>{synthesis.netToDeclare >= 0 ? 'Net TVA à déclarer' : 'Crédit TVA'}</span>
          <span className="font-mono">{fmt(Math.abs(synthesis.netToDeclare))}</span>
        </div>
      </div>
    </div>
  );
};

export default VATSynthesisCard;
