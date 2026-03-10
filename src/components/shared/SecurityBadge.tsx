import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Shield, Lock } from 'lucide-react';

const SecurityBadge = () => {
  const { isRTL } = useLanguage();

  return (
    <div
      className={cn(
        "w-full rounded-xl p-4 mt-8 shadow-md shadow-[hsl(220,60%,20%)]/15",
        "bg-gradient-to-r from-[hsl(220,60%,22%)] to-[hsl(220,65%,28%)]",
        "border border-[hsl(220,50%,35%)]",
        isRTL && "font-cairo"
      )}
    >
      <div className={cn("flex items-center justify-center gap-3 flex-wrap", isRTL && "flex-row-reverse")}>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[hsl(45,80%,65%)]" />
          <Lock className="h-3.5 w-3.5 text-white/70" />
          <span className="text-sm">🇪🇺</span>
        </div>
        <span className="text-xs font-bold text-white">
          🔒 بيئة عمل آمنة — تشفير بمستوى بنكي
        </span>
        <span className="text-[10px] text-white/40 mx-1">|</span>
        <span className="text-[10px] text-white/50 italic" dir="ltr">
          Chiffrement bancaire — Conforme RGPD
        </span>
      </div>
    </div>
  );
};

export default SecurityBadge;
