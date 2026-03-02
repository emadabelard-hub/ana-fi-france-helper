import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Lock } from 'lucide-react';
import DocumentWatermark from './DocumentWatermark';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AuthModal from '@/components/auth/AuthModal';

interface ProtectedDocumentWrapperProps {
  children: ReactNode;
  /** The document type label for the payment metadata */
  documentType: 'devis' | 'facture' | 'cv' | 'letter' | 'quote_to_invoice';
  /** Path to return to after payment */
  returnPath: string;
  /** Whether the document has been paid for (unlocked) */
  isPaid?: boolean;
  /** Called when payment is confirmed */
  onUnlocked?: () => void;
  /** Render the download button (only shown when paid) */
  renderDownloadButton?: () => ReactNode;
  className?: string;
}

const PRICE_LABELS: Record<string, string> = {
  cv: '4,00€',
  devis: '5,00€',
  facture: '5,00€',
  quote_to_invoice: '5,00€',
  letter: '5,00€',
};

const PRICE_LABELS_AR: Record<string, string> = {
  cv: '4.00€',
  devis: '5.00€',
  facture: '5.00€',
  quote_to_invoice: '5.00€',
  letter: '5.00€',
};

/**
 * Wraps a document preview with:
 * - Watermark overlay (when unpaid)
 * - Text selection / right-click / copy disabled (when unpaid)
 * - Pay-to-unlock button replacing Download
 */
const ProtectedDocumentWrapper = ({
  children,
  documentType,
  returnPath,
  isPaid = false,
  onUnlocked,
  renderDownloadButton,
  className,
}: ProtectedDocumentWrapperProps) => {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // Disable right-click on protected content
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!isPaid) {
        e.preventDefault();
      }
    },
    [isPaid]
  );

  // Disable copy
  useEffect(() => {
    if (isPaid) return;
    const el = containerRef.current;
    if (!el) return;

    const blockCopy = (e: ClipboardEvent) => {
      e.preventDefault();
    };

    el.addEventListener('copy', blockCopy);
    return () => el.removeEventListener('copy', blockCopy);
  }, [isPaid]);

  const handlePayment = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-document-payment', {
        body: { documentType, returnPath },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Payment error:', err);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'تعذر بدء عملية الدفع' : 'Impossible de lancer le paiement',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div
        ref={containerRef}
        onContextMenu={handleContextMenu}
        className={cn(
          'relative',
          !isPaid && 'select-none',
          className
        )}
        style={!isPaid ? { WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none', userSelect: 'none' } as React.CSSProperties : undefined}
      >
        {/* Document content */}
        {children}

        {/* Watermark overlay when unpaid */}
        {!isPaid && <DocumentWatermark />}
      </div>

      {/* Action buttons */}
      <div className="mt-4">
        {isPaid && renderDownloadButton ? (
          renderDownloadButton()
        ) : (
          <Button
            onClick={handlePayment}
            disabled={isProcessing}
            size="lg"
            className={cn(
              "w-full gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-base",
              isRTL && "font-cairo flex-row-reverse"
            )}
          >
            {isProcessing ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Lock className="h-5 w-5" />
            )}
             {isRTL
               ? `ادفع ${PRICE_LABELS_AR[documentType]} لتحميل النسخة الأصلية 🔒`
               : `Payer ${PRICE_LABELS[documentType]} pour télécharger l'original 🔒`}
          </Button>
        )}
      </div>

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </>
  );
};

export default ProtectedDocumentWrapper;
