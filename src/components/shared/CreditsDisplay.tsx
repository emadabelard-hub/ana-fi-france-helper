import { cn } from '@/lib/utils';
import { useCredits, DAILY_MESSAGE_LIMIT } from '@/hooks/useCredits';
import { useLanguage } from '@/contexts/LanguageContext';
import { Coins } from 'lucide-react';

interface CreditsDisplayProps {
  showDaily?: boolean;
  className?: string;
  compact?: boolean;
}

const CreditsDisplay = ({ showDaily = false, className, compact = false }: CreditsDisplayProps) => {
  const { balance, dailyMessagesUsed } = useCredits();
  const { isRTL } = useLanguage();

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-1.5 text-sm font-medium",
        isRTL && "flex-row-reverse",
        className
      )}>
        <Coins className="h-4 w-4 text-amber-500" />
        <span className="text-foreground">{balance}</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/50",
      isRTL && "flex-row-reverse",
      className
    )}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
        <Coins className="h-5 w-5 text-white" />
      </div>
      
      <div className={cn("flex-1", isRTL && "text-right")}>
        <div className={cn(
          "flex items-baseline gap-2",
          isRTL && "flex-row-reverse justify-end"
        )}>
          <span className="text-lg font-bold text-foreground">{balance}</span>
          <span className="text-sm text-muted-foreground">
            {isRTL ? 'رصيدك' : 'crédits'}
          </span>
        </div>
        
        {showDaily && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRTL 
              ? `${dailyMessagesUsed}/${DAILY_MESSAGE_LIMIT} رسالة النهاردة`
              : `${dailyMessagesUsed}/${DAILY_MESSAGE_LIMIT} messages aujourd'hui`
            }
          </p>
        )}
      </div>
    </div>
  );
};

export default CreditsDisplay;
