import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { CreditCard, Globe, Briefcase, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface MoneyTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OPTIONS = [
  {
    id: 'remitly',
    icon: CreditCard,
    url: 'https://www.remitly.com',
    fr: { label: "J'ai une Carte d'Identité / Titre de Séjour", badge: 'Recommandé' },
    ar: { label: 'عندي كارت إقامة أو بطاقة هوية', badge: 'موصى به' },
    badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    id: 'taptap',
    icon: Globe,
    url: 'https://www.taptapsend.com',
    fr: { label: "J'ai un Passeport International", badge: 'Validation Souple' },
    ar: { label: 'عندي باسبور دولي', badge: 'تحقق مرن' },
    badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  {
    id: 'wise',
    icon: Briefcase,
    url: 'https://wise.com',
    fr: { label: "J'ai un Compte Pro (Société)", badge: 'B2B' },
    ar: { label: 'عندي حساب شركة (بروفيشنال)', badge: 'B2B' },
    badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
];

const MoneyTransferModal = ({ open, onOpenChange }: MoneyTransferModalProps) => {
  const { language, isRTL } = useLanguage();

  const handleClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "bg-[#1e293b] border-white/10 text-white max-w-md rounded-[2rem] p-6",
        isRTL && "font-cairo"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-lg font-black text-white",
            isRTL ? "text-right font-cairo" : "text-left"
          )}>
            {language === 'fr' ? "Choisissez votre mode d'envoi" : 'اختر طريقة التحويل'}
          </DialogTitle>
          <DialogDescription className={cn(
            "text-slate-400 text-xs",
            isRTL ? "text-right font-cairo" : "text-left"
          )}>
            {language === 'fr'
              ? 'Nous vous dirigeons vers le partenaire agréé adapté à vos documents.'
              : 'هنوجهك للشريك المعتمد المناسب لأوراقك.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const text = language === 'fr' ? opt.fr : opt.ar;
            return (
              <button
                key={opt.id}
                onClick={() => handleClick(opt.url)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/5",
                  "hover:bg-white/10 active:scale-[0.98] transition-all text-left",
                  isRTL && "flex-row-reverse text-right"
                )}
              >
                <div className="p-2.5 rounded-xl bg-white/10 shrink-0">
                  <Icon size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white leading-snug">{text.label}</p>
                  <Badge className={cn("mt-1.5 text-[10px] font-bold border", opt.badgeClass)}>
                    {text.badge}
                  </Badge>
                </div>
                <ExternalLink size={14} className="text-slate-500 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Legal disclaimer */}
        <p className={cn(
          "text-[10px] text-slate-500 mt-4 leading-relaxed",
          isRTL ? "text-right font-cairo" : "text-left"
        )}>
          {language === 'fr'
            ? "Ana Fi France est un apporteur d'affaires. Les transactions et la vérification d'identité (KYC) sont effectuées exclusivement par les partenaires bancaires agréés."
            : 'أنا في فرنسا وسيط فقط. كل المعاملات والتحقق من الهوية (KYC) بتتم حصرياً من خلال الشركاء المصرفيين المعتمدين.'}
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default MoneyTransferModal;
