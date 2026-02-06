import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import QuoteToInvoiceIcon from '@/components/pro/QuoteToInvoiceIcon';
import { useNavigate } from 'react-router-dom';

interface DocumentTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: 'devis' | 'facture') => void;
}

const DocumentTypeModal = ({ open, onOpenChange, onSelect }: DocumentTypeModalProps) => {
  const { isRTL } = useLanguage();
  const navigate = useNavigate();

  const handleConversion = () => {
    onOpenChange(false);
    navigate('/pro/quote-to-invoice');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className={cn(
            "text-xl text-center",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'إيه اللي عايز تعمله؟' : 'Que souhaitez-vous créer ?'}
          </DialogTitle>
        </DialogHeader>
        
        <div className={cn(
          "grid grid-cols-1 gap-4 mt-4",
          isRTL && "font-cairo"
        )}>
          {/* Row 1: Devis & Facture */}
          <div className="grid grid-cols-2 gap-4">
            {/* Devis Button */}
            <Button
              variant="outline"
              className={cn(
                "h-auto py-6 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all",
                "border-2"
              )}
              onClick={() => onSelect('devis')}
            >
              <span className="text-3xl">📋</span>
              <div className="text-center">
                <p className={cn(
                  "font-bold text-base",
                  isRTL && "font-cairo"
                )}>
                  {isRTL ? 'عرض سعر (دوفي)' : 'Devis'}
                </p>
                <p className={cn(
                  "text-xs text-muted-foreground mt-1",
                  isRTL && "font-cairo"
                )}>
                  {isRTL ? 'قبل ما تبدأ الشغل' : 'Avant les travaux'}
                </p>
              </div>
            </Button>

            {/* Facture Button */}
            <Button
              variant="outline"
              className={cn(
                "h-auto py-6 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all",
                "border-2"
              )}
              onClick={() => onSelect('facture')}
            >
              <span className="text-3xl">💶</span>
              <div className="text-center">
                <p className={cn(
                  "font-bold text-base",
                  isRTL && "font-cairo"
                )}>
                  {isRTL ? 'فاتورة (فاكتير)' : 'Facture'}
                </p>
                <p className={cn(
                  "text-xs text-muted-foreground mt-1",
                  isRTL && "font-cairo"
                )}>
                  {isRTL ? 'بعد ما تخلص الشغل' : 'Après les travaux'}
                </p>
              </div>
            </Button>
          </div>

          {/* Row 2: Conversion Tool */}
          <Button
            variant="outline"
            className={cn(
              "h-auto py-5 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all",
              "border-2 border-dashed border-primary/30"
            )}
            onClick={handleConversion}
          >
            <QuoteToInvoiceIcon className="h-10 w-10" />
            <div className="text-center">
              <p className={cn(
                "font-bold text-base text-primary",
                isRTL && "font-cairo"
              )}>
                {isRTL ? 'عشان ما تتلخبطش حوّل الدوفي لفاكتير' : 'Transformer devis en facture'}
              </p>
              <p className={cn(
                "text-xs text-muted-foreground mt-1 max-w-xs mx-auto",
                isRTL && "font-cairo"
              )}>
                {isRTL 
                  ? 'ارفع الدوفي القديم وأنا هاملاالك الفاكتير!' 
                  : 'Téléchargez votre devis, l\'IA remplit votre facture en français !'}
              </p>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentTypeModal;
