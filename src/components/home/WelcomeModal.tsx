import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const STORAGE_KEY = 'ana-fi-france-welcome-seen';

const WelcomeModal = React.forwardRef<HTMLDivElement>((_, ref) => {
  const [open, setOpen] = useState(false);
  const { isRTL } = useLanguage();

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
    <div ref={ref} style={{ display: 'contents' }}>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-sm rounded-3xl border-accent/40 p-0 overflow-hidden gap-0 bg-card">
          <div className="bg-gradient-to-br from-background to-card p-6 text-center border-b border-accent/30">
            <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg border-2 border-accent/60">
              <span className="text-accent-foreground font-black text-xl italic">AF</span>
            </div>
            <h2 className={`text-lg font-black ${isRTL ? 'font-cairo' : ''} text-accent leading-snug`}>
              {isRTL ? 'أهلاً بك في أنا في فرنسا برو' : 'Bienvenue sur Ana Fi France Pro'}
            </h2>
          </div>

          <div className="p-6 space-y-4 text-center bg-card">
            <div className={`flex items-start gap-3 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
              <FileText size={18} className="text-accent shrink-0 mt-0.5" />
              <p className={`text-sm text-foreground/90 leading-relaxed ${isRTL ? 'font-cairo' : ''}`}>
                {isRTL
                  ? 'أنشئ دوفيهاتك وفواتيرك الاحترافية في دقيقتين ونظم عملك بكل سهولة.'
                  : 'Créez vos devis et factures professionnels en deux minutes et organisez votre activité en toute simplicité.'}
              </p>
            </div>

            <Button
              onClick={handleClose}
              className={`w-full rounded-2xl h-12 text-base font-black ${isRTL ? 'font-cairo' : ''} bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg mt-2`}
            >
              {isRTL ? 'يلّا نبدأ' : 'Commencer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

WelcomeModal.displayName = 'WelcomeModal';

export default WelcomeModal;
