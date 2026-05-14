import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MessageCircle, Sparkles } from 'lucide-react';
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

const ShbikLbikCard = (props: ShbikLbikProps) => {
  const { isRTL, simplified } = props;
  const navigate = useNavigate();
  const [showDetail, setShowDetail] = useState(false);

  if (simplified) {
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
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-sm font-bold">
              {isRTL ? 'اسأل المساعد عن حساباتك' : 'Demander conseil à l\'assistant'}
            </span>
          </Button>
        </div>
      </div>
    );
  }

  // Fallback to original implementation for non-simplified usage
  // (keeping the original code intact for backwards compatibility)
  return (
    <div className={cn(
      'rounded-2xl border border-accent/20 bg-[hsl(220,20%,12%)] overflow-hidden shadow-lg'
    )}>
      <div className={cn('flex items-center gap-2.5 px-5 pt-5 pb-2', isRTL && 'flex-row-reverse')}>
        <span className="text-2xl">🧞‍♂️</span>
        <div className={isRTL ? 'text-right' : ''}>
          <h2 className={cn('text-lg font-black text-accent leading-tight', isRTL && 'font-cairo')}>شبيك لبيك</h2>
          <p className={cn('text-[10px] text-muted-foreground', isRTL && 'font-cairo')}>
            {isRTL ? 'مستشارك المالي الذكي' : 'Ton conseiller financier intelligent'}
          </p>
        </div>
      </div>
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
