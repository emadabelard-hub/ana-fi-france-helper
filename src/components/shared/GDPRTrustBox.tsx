import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const GDPRTrustBox = () => {
  const { isRTL } = useLanguage();

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-[hsl(210,30%,80%)] bg-[hsl(210,40%,97%)] dark:bg-[hsl(220,30%,12%)] dark:border-[hsl(220,30%,25%)] p-4 mt-5",
        isRTL && "text-right font-cairo"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className={cn("flex items-center gap-3 mb-2", isRTL && "flex-row-reverse")}>
        <span className="text-xl">🇪🇺</span>
        <span className="text-xl">🛡️</span>
        <span className="text-xs font-bold text-[hsl(220,50%,30%)] dark:text-[hsl(40,60%,70%)] tracking-wide">
          RGPD
        </span>
      </div>
      <p className="text-sm font-bold text-[hsl(220,50%,25%)] dark:text-[hsl(210,30%,85%)] leading-relaxed mb-1">
        تطبيق مطابق لمعايير RGPD الأوروبية لحماية البيانات.
      </p>
      <p className="text-xs text-[hsl(220,20%,45%)] dark:text-[hsl(210,20%,65%)] leading-relaxed mb-2">
        بياناتك وصورك مشفرة بالكامل ومخزنة في خوادم آمنة داخل الاتحاد الأوروبي. نضمن لك سرية تامة لحساباتك وعملائك.
      </p>
      <p className="text-[11px] text-muted-foreground italic" dir="ltr">
        Conforme RGPD — Données sécurisées en Europe.
      </p>
    </div>
  );
};

export default GDPRTrustBox;
