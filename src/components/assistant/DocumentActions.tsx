import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Copy, Check, FileText, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface DocumentActionsProps {
  content: string;
  documentRef?: React.RefObject<HTMLDivElement>;
  documentName?: string;
  isRTL?: boolean;
  showPdfButton?: boolean;
}

const DocumentActions = ({
  content,
  documentRef,
  documentName = 'document',
  isRTL = true,
  showPdfButton = true,
}: DocumentActionsProps) => {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: isRTL ? "تم النسخ" : "Copié",
        description: isRTL ? "تم نسخ النص للحافظة" : "Le texte a été copié",
      });
    } catch {
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "فشل في النسخ" : "Échec de la copie",
      });
    }
  };

  const handleExportPDF = async () => {
    if (!documentRef?.current) {
      // If no ref, just copy the text
      handleCopy();
      return;
    }

    setIsExporting(true);

    try {
      const canvas = await html2canvas(documentRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const finalWidth = imgWidth * ratio * 0.95;
      const finalHeight = imgHeight * ratio * 0.95;
      const x = (pdfWidth - finalWidth) / 2;
      const y = 10;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      pdf.save(`${documentName}-${Date.now()}.pdf`);

      toast({
        title: isRTL ? "تم التحميل" : "Téléchargé",
        description: isRTL ? "تم حفظ الملف PDF" : "Le fichier PDF a été enregistré",
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "فشل في إنشاء PDF" : "Échec de la création du PDF",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={cn(
      "flex gap-2 mt-3",
      isRTL && "flex-row-reverse"
    )}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className={cn("gap-2", isRTL && "flex-row-reverse")}
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span>{isRTL ? 'تم النسخ' : 'Copié'}</span>
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            <span>{isRTL ? '📋 نسخ النص' : '📋 Copier'}</span>
          </>
        )}
      </Button>

      {showPdfButton && (
        <Button
          variant="default"
          size="sm"
          onClick={handleExportPDF}
          disabled={isExporting}
          className={cn("gap-2", isRTL && "flex-row-reverse")}
        >
          {isExporting ? (
            <>
              <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              <span>{isRTL ? 'جاري التحميل...' : 'Export...'}</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>{isRTL ? '📄 تحميل PDF' : '📄 Télécharger PDF'}</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default DocumentActions;
