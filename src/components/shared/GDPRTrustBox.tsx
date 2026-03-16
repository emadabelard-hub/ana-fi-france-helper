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
      <p className="text-[15px] font-bold text-white leading-relaxed mb-2">
        🛡️ خصوصية مطلقة: بياناتك ملكك وحدك ولا يمكن لأحد غيرك الوصول إليها.
      </p>

      {/* Arabic body */}
      <p className="text-[13px] text-white/75 leading-relaxed mb-3">
        نحن نستخدم تقنيات تشفير متطورة بمستوى الأنظمة البنكية العالمية. تطبيقنا متوافق تماماً مع قوانين الخصوصية الأوروبية (RGPD)، مما يضمن أنك الشخص الوحيد والمالك الحصري لكل البيانات والمستندات التي تضعها، ولا يتم مشاركتها مع أي طرف ثالث نهائياً.
      </p>

      {/* French sub-text */}
      <p className="text-[11px] text-white/50 italic leading-relaxed" dir="ltr">
        Confidentialité Totale : Chiffrement de niveau bancaire conforme au RGPD européen. Vous êtes le seul propriétaire de vos données.
      </p>
    </div>
  );
});

GDPRTrustBox.displayName = 'GDPRTrustBox';

export default GDPRTrustBox;
