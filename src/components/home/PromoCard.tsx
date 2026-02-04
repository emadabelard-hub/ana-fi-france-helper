import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePromoMetrics } from '@/hooks/usePromoMetrics';
import { Card, CardContent } from '@/components/ui/card';

interface PromoCardProps {
  promoId: string;
  icon: string;
  titleAr: string;
  titleFr: string;
  subtitleAr: string;
  subtitleFr: string;
  href?: string;
  variant?: 'gold' | 'default';
  className?: string;
}

export const PromoCard = ({
  promoId,
  icon,
  titleAr,
  titleFr,
  subtitleAr,
  subtitleFr,
  href,
  variant = 'default',
  className
}: PromoCardProps) => {
  const { isRTL } = useLanguage();
  const { metrics, trackClick } = usePromoMetrics(promoId);

  const handleClick = () => {
    trackClick();
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-300 relative",
        "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
        variant === 'gold' && "border-2 border-dashed border-amber-400/60 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/20 dark:via-yellow-950/20 dark:to-orange-950/20",
        variant === 'default' && "border border-border bg-card",
        className
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className={cn(
          "flex items-center gap-3",
          isRTL && "flex-row-reverse"
        )}>
          {/* Icon */}
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
            variant === 'gold' 
              ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-md" 
              : "bg-muted"
          )}>
            <span className="text-2xl">{icon}</span>
          </div>

          {/* Text */}
          <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
            <h3 className={cn(
              "font-bold text-sm mb-0.5 truncate",
              variant === 'gold' ? "text-amber-900 dark:text-amber-100" : "text-foreground"
            )}>
              {isRTL ? titleAr : titleFr}
            </h3>
            <p className={cn(
              "text-xs truncate",
              variant === 'gold' ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"
            )}>
              {isRTL ? subtitleAr : subtitleFr}
            </p>
          </div>

          {/* Promo badge */}
          <div className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shrink-0",
            variant === 'gold' 
              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" 
              : "bg-primary/10 text-primary"
          )}>
            {isRTL ? 'إعلان' : 'Promo'}
          </div>
        </div>

        {/* Stats Badge - Visible for testing */}
        <div className={cn(
          "absolute bottom-1 right-1 px-2 py-0.5 rounded text-[10px] font-mono",
          "bg-black/70 text-white"
        )}>
          👁️ {metrics.views} | 👆 {metrics.clicks}
        </div>
      </CardContent>
    </Card>
  );
};

interface PromoBannerProps {
  promoId: string;
  textAr: string;
  textFr: string;
  href?: string;
  className?: string;
}

export const PromoBanner = ({
  promoId,
  textAr,
  textFr,
  href,
  className
}: PromoBannerProps) => {
  const { isRTL } = useLanguage();
  const { metrics, trackClick } = usePromoMetrics(promoId);

  const handleClick = () => {
    trackClick();
    if (href) {
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      className={cn(
        "cursor-pointer transition-all duration-300 relative",
        "px-4 py-3 rounded-lg",
        "bg-gradient-to-r from-emerald-500 to-teal-500",
        "hover:from-emerald-600 hover:to-teal-600",
        "active:scale-[0.98]",
        className
      )}
      onClick={handleClick}
    >
      <div className={cn(
        "flex items-center justify-center gap-2",
        isRTL && "flex-row-reverse"
      )}>
        <span className="text-lg">💸</span>
        <p className="text-white font-semibold text-sm text-center">
          {isRTL ? textAr : textFr}
        </p>
        <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
          {isRTL ? 'إعلان' : 'Promo'}
        </span>
      </div>

      {/* Stats Badge */}
      <div className={cn(
        "absolute bottom-1 right-1 px-2 py-0.5 rounded text-[10px] font-mono",
        "bg-black/50 text-white"
      )}>
        👁️ {metrics.views} | 👆 {metrics.clicks}
      </div>
    </div>
  );
};
