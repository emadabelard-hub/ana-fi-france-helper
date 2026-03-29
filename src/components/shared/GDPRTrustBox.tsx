import React from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, Lock } from 'lucide-react';

const GDPRTrustBox = React.forwardRef<HTMLDivElement>((_, ref) => {
  const { isRTL } = useLanguage();

  return (
    <div
      ref={ref}
      className={cn(
        "w-full rounded-2xl p-5 mt-5 shadow-lg shadow-[hsl(220,60%,20%)]/20",
        "bg-gradient-to-br from-[hsl(220,60%,25%)] to-[hsl(220,70%,18%)]",
        "border border-[hsl(220,50%,35%)]",
        isRTL && "text-right font-cairo"
      )}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Icons row */}
      <div className={cn("flex items-center gap-3 mb-3", isRTL && "flex-row-reverse")}>
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          <Shield className="h-5 w-5 text-[hsl(45,80%,65%)]" />
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          <Lock className="h-5 w-5 text-white/80" />
        </div>
        <span className="text-xl">🇪🇺</span>
        <span className="text-[10px] font-bold text-[hsl(45,80%,65%)] tracking-widest uppercase ml-auto">
          RGPD
        </span>
      </div>

      {/* Main title */}
      <p className={cn("text-[15px] font-bold text-white leading-relaxed mb-2", !isRTL && "text-left")}>
        {isRTL
          ? '🛡️ خصوصية مطلقة: بياناتك ملكك وحدك ولا يمكن لأحد غيرك الوصول إليها.'
          : '🛡️ Confidentialité absolue : vos données vous appartiennent et personne d\'autre ne peut y accéder.'}
      </p>

      {/* Body */}
      <p className={cn("text-[13px] text-white/75 leading-relaxed mb-3", !isRTL && "text-left")}>
        {isRTL
          ? 'نحن نستخدم تقنيات تشفير متطورة بمستوى الأنظمة البنكية العالمية. تطبيقنا متوافق تماماً مع قوانين الخصوصية الأوروبية (RGPD)، مما يضمن أنك الشخص الوحيد والمالك الحصري لكل البيانات والمستندات التي تضعها، ولا يتم مشاركتها مع أي طرف ثالث نهائياً.'
          : 'Nous utilisons des technologies de chiffrement avancées de niveau bancaire international. Notre application est entièrement conforme au RGPD européen, garantissant que vous êtes le seul propriétaire de toutes vos données et documents — aucun partage avec des tiers.'}
      </p>

      {/* French sub-text */}
      <p className={cn("text-[11px] text-white/50 italic leading-relaxed", !isRTL && "text-left")} dir="ltr">
        {isRTL
          ? 'Confidentialité Totale : Chiffrement de niveau bancaire conforme au RGPD européen. Vous êtes le seul propriétaire de vos données.'
          : 'Confidentialité totale — Chiffrement bancaire — Conforme au RGPD européen'}
      </p>
    </div>
  );
});

GDPRTrustBox.displayName = 'GDPRTrustBox';

export default GDPRTrustBox;
