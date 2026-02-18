import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

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
      <DialogContent className="max-w-sm rounded-3xl border-accent/30 p-0 overflow-hidden gap-0">
        {/* Header band */}
        <div className="bg-gradient-to-br from-accent to-accent/80 p-6 text-center">
          <div className="w-14 h-14 bg-background rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg border-2 border-accent/30">
            <span className="text-accent font-black text-xl italic">AF</span>
          </div>
          <h2 className="text-lg font-black text-accent-foreground leading-snug">
            Bienvenue sur Ana Fi France
          </h2>
          <p className="text-base font-bold font-cairo text-accent-foreground/90 mt-1">
            أهلاً بيك في أنا في فرنسا
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-center">
          <div className="flex items-start gap-3 text-left">
            <Sparkles size={18} className="text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-relaxed">
              Analysez vos documents, obtenez des conseils juridiques et gérez vos démarches avec l'IA.
            </p>
          </div>
          <div className="flex items-start gap-3 text-right" dir="rtl">
            <Sparkles size={18} className="text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-relaxed font-cairo">
              حلّل ورقك، خد استشارات قانونية، ونظّم معاملاتك بسهولة بالذكاء الاصطناعي.
            </p>
          </div>

          <Button
            onClick={handleClose}
            className="w-full rounded-2xl h-12 text-base font-black bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg mt-2"
          >
            Commencer / يلّا نبدأ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeModal;
