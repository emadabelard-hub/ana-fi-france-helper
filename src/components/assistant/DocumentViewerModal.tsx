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

/**
 * Parse and render a formal French letter with proper layout:
 * - Sender block (left) + Date (right) on same row
 * - Recipient block below
 * - Separator line
 * - Bold + underlined "Objet"
 * - Body
 */
const FormattedLetter = ({ text }: { text: string }) => {
  const raw = (text || '').replace(/\r\n/g, '\n').trim();
  const lines = raw.split('\n');

  const dateRegex = /((?:[A-ZÀ-Ý][a-zà-ÿ\-]+),?\s*le\s+[^\n]+?\d{4})/;
  const recipientRegex = /^\s*(À l'attention|A l'attention|Madame,?\s*$|Monsieur,?\s*$)/i;
  const objetRegex = /^\s*Objet\s*:/i;

  // Find date line/index
  let dateText = '';
  let dateLineIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const m = lines[i].match(dateRegex);
    if (m) {
      dateText = m[1].trim();
      dateLineIdx = i;
      break;
    }
  }

  // Find recipient start (À l'attention)
  let recipientStart = -1;
  let recipientEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(À|A) l'attention/i.test(lines[i])) {
      recipientStart = i;
      break;
    }
  }

  // Find objet line
  let objetIdx = -1;
  let objetText = '';
  for (let i = 0; i < lines.length; i++) {
    if (objetRegex.test(lines[i])) {
      objetIdx = i;
      objetText = lines[i].replace(/^\s*Objet\s*:\s*/i, '').trim();
      // Multi-line objet (until blank line)
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '' && !/^(Madame|Monsieur|Madame,|Monsieur,)/i.test(lines[j].trim())) {
        objetText += ' ' + lines[j].trim();
        j++;
      }
      objetIdx = i;
      break;
    }
  }

  // Recipient end = blank line before objet (or before body)
  if (recipientStart !== -1) {
    const upper = objetIdx !== -1 ? objetIdx : lines.length;
    recipientEnd = upper;
    for (let i = recipientStart + 1; i < upper; i++) {
      if (lines[i].trim() === '') {
        recipientEnd = i;
        break;
      }
    }
  }

  // Sender block = lines before recipient (or objet), excluding date
  const senderEnd = recipientStart !== -1
    ? recipientStart
    : (objetIdx !== -1 ? objetIdx : Math.min(6, lines.length));

  const senderLines: string[] = [];
  for (let i = 0; i < senderEnd; i++) {
    if (i === dateLineIdx) {
      // Strip the date portion from the line; keep remainder (e.g. name)
      const remainder = lines[i].replace(dateRegex, '').trim();
      if (remainder) senderLines.push(remainder);
    } else {
      const t = lines[i].trim();
      if (t) senderLines.push(t);
    }
  }

  const recipientLines: string[] = [];
  if (recipientStart !== -1) {
    for (let i = recipientStart; i < recipientEnd; i++) {
      const t = lines[i].trim();
      if (t) recipientLines.push(t);
    }
  }

  // Body = everything after objet block (skip objet lines + trailing blank)
  let bodyStart = lines.length;
  if (objetIdx !== -1) {
    bodyStart = objetIdx + 1;
    while (bodyStart < lines.length && lines[bodyStart].trim() !== '' && /^[^A-ZÀ-Ý]/.test(lines[bodyStart].trim()) === false && bodyStart === objetIdx + 1) {
      // skip continuation of objet (already merged)
      bodyStart++;
      break;
    }
    // Skip blank lines
    while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++;
    // Skip any continuation lines we already merged into objetText
    // (heuristic: skip until we hit "Madame"/"Monsieur" salutation or any non-empty line)
  } else if (recipientEnd !== -1) {
    bodyStart = recipientEnd;
    while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++;
  } else {
    bodyStart = senderEnd;
    while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++;
  }

  const bodyText = lines.slice(bodyStart).join('\n').trim();

  return (
    <div style={{ fontFamily: 'Arial, "Times New Roman", serif', fontSize: '11pt', lineHeight: 1.6 }}>
      {/* Sender + Date row */}
      <div className="flex justify-between items-start gap-6 mb-8">
        <div className="text-left">
          {senderLines.map((line, idx) => (
            <div key={idx} style={{ fontWeight: idx === 0 ? 700 : 400 }}>
              {line}
            </div>
          ))}
        </div>
        {dateText && (
          <div className="text-right whitespace-nowrap">{dateText}</div>
        )}
      </div>

      {/* Recipient block */}
      {recipientLines.length > 0 && (
        <div className="mb-6 ml-auto text-left" style={{ maxWidth: '60%', marginLeft: 'auto' }}>
          {recipientLines.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </div>
      )}

      {/* Separator */}
      <hr className="my-6 border-t border-border" />

      {/* Objet */}
      {objetText && (
        <div className="mb-6" style={{ fontWeight: 700, textDecoration: 'underline' }}>
          Objet : {objetText}
        </div>
      )}

      {/* Body */}
      <div className="whitespace-pre-wrap" style={{ textAlign: 'justify' }}>
        {bodyText}
      </div>
    </div>
  );
};

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
                returnPath="/ai-assistant"
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
                    fontFamily: 'Arial, "Times New Roman", serif',
                    fontSize: '11pt',
                    lineHeight: 1.5,
                  }}
                >
                  <FormattedLetter text={documentText} />

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
