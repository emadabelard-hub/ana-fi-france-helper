import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

const STORAGE_KEY = 'ana-fi-france-welcome-seen';

const WelcomeModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm rounded-3xl border-[#c5a028]/40 p-0 overflow-hidden gap-0 bg-[#1a1a1a]">
        {/* Header band - Black & Gold */}
        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] p-6 text-center border-b border-[#c5a028]/30">
          <div className="w-14 h-14 bg-[#c5a028] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-[0_4px_20px_rgba(197,160,40,0.4)] border-2 border-[#c5a028]/60">
            <span className="text-[#1a1a1a] font-black text-xl italic">AF</span>
          </div>
          <h2 className="text-lg font-black text-white leading-snug">
            Ana Fi France Pro
          </h2>
          <p className="text-base font-bold font-cairo text-[#c5a028] mt-1">
            أهلاً بك في أنا في فرنسا برو
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-center bg-[#1a1a1a]">
          <div className="flex items-start gap-3 text-left">
            <FileText size={18} className="text-[#c5a028] shrink-0 mt-0.5" />
            <p className="text-sm text-white/90 leading-relaxed">
              Créez vos Devis et Factures professionnels en 2 minutes. Un outil complet pour gérer votre entreprise et vos documents administratifs en toute simplicité.
            </p>
          </div>
          <div className="flex items-start gap-3 text-right" dir="rtl">
            <Sparkles size={18} className="text-[#c5a028] shrink-0 mt-0.5" />
            <p className="text-sm text-white/90 leading-relaxed font-cairo">
              أنشئ دوفيهاتك وفواتيرك الاحترافية في دقيقتين. أداتك المتكاملة لإدارة شركتك وأوراقك المهنية بكل سهولة وأمان.
            </p>
          </div>

          <Button
            onClick={handleClose}
            className="w-full rounded-2xl h-12 text-base font-black bg-[#c5a028] text-[#1a1a1a] hover:bg-[#d4af37] shadow-[0_4px_20px_rgba(197,160,40,0.3)] mt-2"
          >
            Commencer / يلّا نبدأ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
