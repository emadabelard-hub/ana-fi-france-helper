import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Hash, ArrowRight } from 'lucide-react';

interface FactureNumberingOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinueExisting: (lastNumber: string) => void;
  onStartFresh: () => void;
}

const FactureNumberingOnboarding = ({ open, onOpenChange, onContinueExisting, onStartFresh }: FactureNumberingOnboardingProps) => {
  const { isRTL } = useLanguage();
  const [wantsContinue, setWantsContinue] = useState<boolean | null>(null);
  const [lastNumber, setLastNumber] = useState('');
  const [error, setError] = useState('');
  const year = new Date().getFullYear();

  const handleConfirm = () => {
    if (wantsContinue && lastNumber.trim()) {
      const num = parseInt(lastNumber.trim(), 10);
      if (isNaN(num) || num < 1 || num > 9999) {
        setError(isRTL ? 'أدخل رقم صحيح بين 1 و 9999' : 'Entrez un numéro valide entre 1 et 9999');
        return;
      }
      const nextNum = num + 1;
      const formatted = `F-${year}-${String(nextNum).padStart(3, '0')}`;
      onContinueExisting(formatted);
    } else {
      onStartFresh();
    }
    onOpenChange(false);
    setWantsContinue(null);
    setLastNumber('');
    setError('');
  };

  const handleClose = () => {
    onOpenChange(false);
    onStartFresh();
    setWantsContinue(null);
    setLastNumber('');
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else onOpenChange(true);
    }}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle className={cn("text-lg font-black text-center", isRTL && "font-cairo")}>
            {isRTL ? '🔢 ترقيم الفواتير' : '🔢 Numérotation des factures'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {wantsContinue === null ? (
            <>
              <p className={cn("text-sm text-muted-foreground text-center", isRTL && "font-cairo")}>
                {isRTL
                  ? 'عايز تكمّل على ترقيم فواتيرك الموجود؟'
                  : 'Souhaitez-vous continuer votre numérotation existante ?'}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setWantsContinue(true)}
                  className={cn("w-full font-bold", isRTL && "font-cairo")}
                >
                  <Hash className="h-4 w-4 mr-2" />
                  {isRTL ? 'أيوه، عندي ترقيم قديم' : 'Oui, j\'ai une numérotation existante'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onStartFresh();
                    onOpenChange(false);
                  }}
                  className={cn("w-full font-bold", isRTL && "font-cairo")}
                >
                  {isRTL ? 'لا، ابدأ من الأول' : 'Non, commencer depuis le début'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className={cn("text-sm text-muted-foreground", isRTL && "font-cairo text-right")}>
                {isRTL
                  ? 'أدخل رقم آخر فاتورة أصدرتها والنظام هيكمّل من بعدها تلقائياً.'
                  : 'Entrez le numéro de votre dernière facture émise. Le système continuera automatiquement à partir du suivant.'}
              </p>
              <div className="space-y-2">
                <Label className={cn("text-sm font-bold", isRTL && "font-cairo")}>
                  {isRTL ? 'آخر رقم فاتورة' : 'Dernier numéro de facture'}
                </Label>
                <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
                  <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">F-{year}-</span>
                  <Input
                    value={lastNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setLastNumber(val);
                      setError('');
                    }}
                    placeholder="014"
                    className="font-mono text-left w-24"
                    dir="ltr"
                    type="text"
                    enableVoice={false}
                  />
                </div>
                {lastNumber && !error && (
                  <p className={cn("text-xs text-primary font-medium flex items-center gap-1", isRTL && "flex-row-reverse font-cairo")}>
                    <ArrowRight className="h-3 w-3" />
                    {isRTL
                      ? `الفاتورة الجاية هتبقى: F-${year}-${String(parseInt(lastNumber || '0', 10) + 1).padStart(3, '0')}`
                      : `Prochaine facture : F-${year}-${String(parseInt(lastNumber || '0', 10) + 1).padStart(3, '0')}`}
                  </p>
                )}
                {error && <p className="text-xs text-destructive font-medium">{error}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setWantsContinue(null)}
                  className="flex-1 font-bold"
                >
                  {isRTL ? 'رجوع' : 'Retour'}
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={!lastNumber.trim()}
                  className="flex-1 font-bold"
                >
                  {isRTL ? 'تأكيد ✓' : 'Confirmer ✓'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FactureNumberingOnboarding;
