import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface DocumentTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: 'devis' | 'facture') => void;
}

const DocumentTypeModal = ({ open, onOpenChange, onSelect }: DocumentTypeModalProps) => {
  const { isRTL } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={cn(
            "text-xl text-center",
            isRTL && "font-cairo"
          )}>
            {isRTL ? 'ماذا تريد أن تنشئ؟' : 'Que souhaitez-vous créer ?'}
          </DialogTitle>
        </DialogHeader>
        
        <div className={cn(
          "grid grid-cols-2 gap-4 mt-4",
          isRTL && "font-cairo"
        )}>
          {/* Devis Button */}
          <Button
            variant="outline"
            className={cn(
              "h-auto py-8 flex flex-col gap-3 hover:border-primary hover:bg-primary/5 transition-all",
              "border-2"
            )}
            onClick={() => onSelect('devis')}
          >
            <span className="text-4xl">📋</span>
            <div className="text-center">
              <p className={cn(
                "font-bold text-lg",
                isRTL && "font-cairo"
              )}>
                {isRTL ? 'عرض سعر (دوفي)' : 'Devis'}
              </p>
              <p className={cn(
                "text-xs text-muted-foreground mt-1",
                isRTL && "font-cairo"
              )}>
                {isRTL ? 'تقدير للعميل' : 'Estimation client'}
              </p>
            </div>
          </Button>

          {/* Facture Button */}
          <Button
            variant="outline"
            className={cn(
              "h-auto py-8 flex flex-col gap-3 hover:border-primary hover:bg-primary/5 transition-all",
              "border-2"
            )}
            onClick={() => onSelect('facture')}
          >
            <span className="text-4xl">💶</span>
            <div className="text-center">
              <p className={cn(
                "font-bold text-lg",
                isRTL && "font-cairo"
              )}>
                {isRTL ? 'فاتورة (فاكتير)' : 'Facture'}
              </p>
              <p className={cn(
                "text-xs text-muted-foreground mt-1",
                isRTL && "font-cairo"
              )}>
                {isRTL ? 'بعد العمل' : 'Après le travail'}
              </p>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentTypeModal;
