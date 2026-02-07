import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { PenLine, X, Check, AlertTriangle } from 'lucide-react';
import SignaturePad from './SignaturePad';

interface SignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignatureComplete: (signatureDataUrl: string) => void;
  documentType: 'DEVIS' | 'FACTURE';
  documentNumber: string;
  validUntil?: string; // Format: DD/MM/YYYY
}

const SignatureModal = ({
  open,
  onOpenChange,
  onSignatureComplete,
  documentType,
  documentNumber,
  validUntil,
}: SignatureModalProps) => {
  const { isRTL } = useLanguage();
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Check if the quote has expired (for DEVIS only)
  const isExpired = (() => {
    if (documentType !== 'DEVIS' || !validUntil) return false;
    // Parse DD/MM/YYYY format
    const parts = validUntil.split('/');
    if (parts.length !== 3) return false;
    const expiryDate = new Date(
      parseInt(parts[2], 10),  // year
      parseInt(parts[1], 10) - 1,  // month (0-indexed)
      parseInt(parts[0], 10)  // day
    );
    return new Date() > expiryDate;
  })();

  const handleConfirm = () => {
    if (!signatureDataUrl) return;
    
    setIsConfirming(true);
    // Small delay for UX
    setTimeout(() => {
      onSignatureComplete(signatureDataUrl);
      setIsConfirming(false);
      setSignatureDataUrl(null);
      onOpenChange(false);
    }, 500);
  };

  const handleClose = () => {
    setSignatureDataUrl(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn(
        "max-w-md sm:max-w-lg",
        isRTL && "font-cairo"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "flex items-center gap-2",
            isRTL && "flex-row-reverse text-right"
          )}>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <PenLine className="h-5 w-5 text-primary" />
            </div>
            <span>
              {isRTL ? '✍️ توقيع الزبون' : '✍️ Signature du Client'}
            </span>
          </DialogTitle>
          <DialogDescription className={cn(
            "text-sm",
            isRTL && "text-right"
          )}>
            {isRTL 
              ? `${documentType === 'DEVIS' ? 'الدوفي' : 'الفاتورة'} رقم ${documentNumber}`
              : `${documentType} N° ${documentNumber}`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning for Devis */}
          {documentType === 'DEVIS' && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className={cn("text-sm", isRTL && "text-right")}>
                <p className="font-medium text-amber-700 dark:text-amber-400">
                  {isRTL ? '⚠️ التوقيع = موافقة ملزمة' : '⚠️ Signature = Engagement'}
                </p>
                <p className="text-xs text-amber-600/80 mt-1">
                  {isRTL 
                    ? 'لما الزبون يوقع، الدوفي بيبقى عقد ملزم للطرفين!'
                    : 'La signature engage les deux parties sur les termes du devis.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Expired Quote Warning - Security Alert */}
          {isExpired && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className={cn("text-sm", isRTL && "text-right")}>
                <p className="font-bold text-destructive">
                  {isRTL ? '🚨 الدوفي منتهي الصلاحية!' : '🚨 Devis expiré!'}
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  {isRTL 
                    ? 'انتبه! أسعار المواد ممكن تكون تغيرت. راجع الأسعار قبل التوقيع.'
                    : 'Attention, les prix des matériaux ont peut-être changé. Révisez les prix avant signature.'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Signature Pad */}
          <SignaturePad
            onSignatureChange={setSignatureDataUrl}
            signatureDataUrl={signatureDataUrl}
          />
        </div>

        {/* Actions */}
        <div className={cn(
          "flex gap-3 pt-2",
          isRTL && "flex-row-reverse"
        )}>
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1"
          >
            <X className="h-4 w-4 mr-1" />
            {isRTL ? 'إلغاء' : 'Annuler'}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!signatureDataUrl || isConfirming}
            className={cn(
              "flex-1 bg-green-600 hover:bg-green-700",
              (!signatureDataUrl || isConfirming) && "opacity-50"
            )}
          >
            {isConfirming ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {isRTL ? 'جاري الحفظ...' : 'Enregistrement...'}
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                {isRTL ? 'تأكيد التوقيع' : 'Confirmer la signature'}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignatureModal;
