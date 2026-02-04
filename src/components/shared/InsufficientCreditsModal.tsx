import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, ShoppingCart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface InsufficientCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  requiredCredits: number;
}

const InsufficientCreditsModal = ({ 
  open, 
  onOpenChange, 
  currentBalance, 
  requiredCredits 
}: InsufficientCreditsModalProps) => {
  const { isRTL } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", isRTL && "font-cairo")}>
        <DialogHeader className={isRTL ? "text-right" : ""}>
          <div className={cn(
            "flex items-center gap-3 mb-2",
            isRTL && "flex-row-reverse"
          )}>
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Coins className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-xl">
              {isRTL ? '🪙 رصيد غير كافي' : '🪙 Crédits insuffisants'}
            </DialogTitle>
          </div>
          <DialogDescription className={cn("text-base", isRTL && "text-right")}>
            {isRTL 
              ? `عندك ${currentBalance} كريديت بس. العملية دي محتاجة ${requiredCredits} كريديت.`
              : `Vous avez ${currentBalance} crédit(s). Cette action nécessite ${requiredCredits} crédit(s).`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className={cn(
            "p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20",
            isRTL && "text-right"
          )}>
            <p className="text-sm text-muted-foreground">
              {isRTL 
                ? '✨ اشحن رصيدك واستمتع بخدمات أكتر!' 
                : '✨ Rechargez votre compte pour continuer à utiliser nos services premium!'
              }
            </p>
          </div>
        </div>

        <DialogFooter className={cn(
          "flex gap-2",
          isRTL && "flex-row-reverse"
        )}>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className={isRTL ? "font-cairo" : ""}
          >
            {isRTL ? 'لاحقاً' : 'Plus tard'}
          </Button>
          <Button 
            onClick={() => {
              // TODO: Navigate to payment page when implemented
              onOpenChange(false);
            }}
            className={cn("gap-2", isRTL && "flex-row-reverse font-cairo")}
          >
            <ShoppingCart className="h-4 w-4" />
            {isRTL ? 'شراء كريديت' : 'Acheter des crédits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InsufficientCreditsModal;
