import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const SecurityBadge = () => {
  const { isRTL } = useLanguage();

  return (
    <div
      className={cn(
        "w-full rounded-lg bg-[hsl(210,50%,95%)] dark:bg-[hsl(220,30%,15%)] border border-[hsl(210,40%,85%)] dark:border-[hsl(220,25%,25%)] px-4 py-2.5 mt-8 flex items-center justify-center gap-2",
        isRTL && "font-cairo"
      )}
    >
      <span className="text-sm">🔒</span>
      <span className="text-xs font-semibold text-[hsl(220,40%,35%)] dark:text-[hsl(210,30%,75%)]">
        بيئة عمل آمنة ومشفّرة 100%
      </span>
      <span className="text-[10px] text-muted-foreground mx-1">|</span>
      <span className="text-[10px] text-muted-foreground italic" dir="ltr">
        Environnement de travail 100% sécurisé
      </span>
    </div>
  );
};

export default SecurityBadge;
