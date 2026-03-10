import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import DocumentWatermark from './DocumentWatermark';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AuthModal from '@/components/auth/AuthModal';

interface ProtectedDocumentWrapperProps {
  children: ReactNode;
  /** The document type label for the payment metadata */
  documentType: 'devis' | 'facture' | 'cv' | 'letter' | 'quote_to_invoice' | 'smart_devis';
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

const PRICE_MAP: Record<string, string> = {
  cv: '4.00€',
  devis: '6.00€',
  facture: '6.00€',
  quote_to_invoice: '6.00€',
  letter: '6.00€',
  smart_devis: '14.99€',
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
  isPaid: _isPaid = false,
  onUnlocked,
  renderDownloadButton,
  className,
}: ProtectedDocumentWrapperProps) => {
  // TRIAL PHASE: All documents unlocked — set to `_isPaid` to reactivate payments
  const isPaid = true;
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  // Preview expiry removed — users can always see the watermarked preview

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
        {/* Document content — always visible, watermarked when unpaid */}
        {children}
        {!isPaid && <DocumentWatermark />}
      </div>

      {/* AI badge for smart devis */}
      {documentType === 'smart_devis' && !isPaid && (
        <div className={cn("mt-3 flex justify-center", isRTL && "font-cairo")}>
          <Badge className="gap-1.5 bg-violet-600/90 hover:bg-violet-600 text-white px-3 py-1 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            {isRTL ? 'تم التحليل بواسطة الذكاء الاصطناعي' : 'Analysé par Intelligence Artificielle'}
          </Badge>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-3">
      {isPaid && renderDownloadButton ? (
          renderDownloadButton()
        ) : isPaid ? (
          /* TRIAL PHASE: Free download fallback when no renderDownloadButton provided */
          <Button
            onClick={() => window.print()}
            size="lg"
            className={cn(
              "w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-6 text-base",
              isRTL && "font-cairo flex-row-reverse"
            )}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {isRTL ? 'تحميل النسخة الأصلية (PDF)' : 'Télécharger l\'original (PDF)'}
          </Button>
        ) : (
          /* PAYMENT BUTTON — hidden during trial, restore by setting isPaid = _isPaid above */
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
               ? `ادفع ${PRICE_MAP[documentType]} لتحميل النسخة الأصلية 🔒`
               : `Payer ${PRICE_MAP[documentType]} pour télécharger l'original 🔒`}
          </Button>
        )}
      </div>

      <AuthModal open={showAuth} onOpenChange={setShowAuth} />
    </>
  );
};

export default ProtectedDocumentWrapper;
