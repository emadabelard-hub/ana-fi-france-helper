import { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Download } from 'lucide-react';
import EnvelopeHelper from './EnvelopeHelper';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import ProtectedDocumentWrapper from '@/components/shared/ProtectedDocumentWrapper';

interface DispatchInfo {
  recipientName?: string;
  recipientAddress?: string;
  referenceNumber?: string;
  subjectLine?: string;
}

interface DocumentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRTL?: boolean;
  title?: string;
  documentText: string;
  dispatchInfo?: DispatchInfo;
}

const DocumentViewerModal = ({
  open,
  onOpenChange,
  isRTL = true,
  title,
  documentText,
  dispatchInfo,
}: DocumentViewerModalProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  // TRIAL PHASE: All documents unlocked — revert to useState(false) to reactivate payments
  const [isPaid, setIsPaid] = useState(true);
  const letterRef = useRef<HTMLDivElement>(null);

  const displayTitle = useMemo(() => {
    if (title?.trim()) return title.trim();
    if (dispatchInfo?.subjectLine?.trim()) return dispatchInfo.subjectLine.trim();
    return isRTL ? 'خطاب رسمي' : 'Lettre officielle';
  }, [title, dispatchInfo?.subjectLine, isRTL]);

  const handleExportPDF = async () => {
    if (!letterRef.current) return;

    setIsExporting(true);
    try {
      // Ensure all images are loaded
      const imgs = Array.from(letterRef.current.querySelectorAll('img'));
      await Promise.all(imgs.map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })
      ));

      // Wait for layout to settle
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(letterRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        scrollY: -window.scrollY,
        windowWidth: letterRef.current.scrollWidth,
        windowHeight: letterRef.current.scrollHeight,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const margin = 5;
      const usableWidth = pdfWidth - margin * 2;
      const scaledHeight = (canvas.height * usableWidth) / canvas.width;

      if (scaledHeight <= pdfHeight - margin * 2) {
        pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, scaledHeight);
      } else {
        pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, pdfHeight - margin * 2);
      }
      pdf.save(`document-${Date.now()}.pdf`);

      toast({
        title: isRTL ? 'تم التحميل' : 'Téléchargé',
        description: isRTL ? 'تم حفظ ملف PDF' : 'Le PDF a été enregistré',
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'فشل إنشاء PDF' : 'Échec de la création du PDF',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Override the default centered dialog into a fullscreen overlay
          'left-0 top-0 translate-x-0 translate-y-0 w-screen max-w-none h-[100dvh] rounded-none p-0',
          // Keep the modal as a clean paper environment
          'bg-background text-foreground',
        )}
      >
        <div className="flex h-[100dvh] flex-col">
          {/* Header */}
          <header className={cn('flex items-center justify-between gap-3 border-b border-border px-4 py-3', isRTL && 'flex-row-reverse font-cairo')}>
            <div className={cn('min-w-0', isRTL && 'text-right')}>
              <h2 className="truncate text-base font-semibold">{displayTitle}</h2>
              <p className={cn('text-xs text-muted-foreground', isRTL && 'leading-relaxed')}>
                {isRTL
                  ? 'عرض ورقة جاهز للطباعة (LTR)'
                  : 'Vue “papier” prête à imprimer (LTR)'}
              </p>
            </div>
          </header>

          {/* Scrollable document body */}
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[900px] px-4 py-6">
              <ProtectedDocumentWrapper
                documentType="letter"
                returnPath="/assistant"
                isPaid={isPaid}
                onUnlocked={() => setIsPaid(true)}
                renderDownloadButton={() => (
                  <Button onClick={handleExportPDF} disabled={isExporting} className={cn('w-full gap-2', isRTL && 'flex-row-reverse')}>
                    {isExporting ? (
                      <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isRTL ? 'تحميل PDF' : 'Télécharger PDF'}
                  </Button>
                )}
              >
                <div
                  ref={letterRef}
                  dir="ltr"
                  lang="fr"
                  className={cn(
                    'border border-border rounded-lg shadow-sm',
                    'bg-background text-foreground',
                    'px-8 py-10',
                  )}
                  style={{
                    direction: 'ltr',
                    textAlign: 'justify',
                    fontFamily: 'Arial, Roboto, sans-serif',
                  }}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ textAlign: 'justify' }}>
                    {documentText}
                  </div>

                  {/* Leave space for signature bottom-right */}
                  <div className="mt-10 flex justify-end">
                    <div className="h-20 w-64" />
                  </div>
                </div>
              </ProtectedDocumentWrapper>

              {/* Envelope helper */}
              {dispatchInfo?.recipientName && (
                <EnvelopeHelper
                  recipientName={dispatchInfo.recipientName}
                  recipientAddress={dispatchInfo.recipientAddress}
                  referenceNumber={dispatchInfo.referenceNumber}
                  isRTL={isRTL}
                />
              )}
            </div>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentViewerModal;
