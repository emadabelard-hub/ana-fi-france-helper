import { FileText, Image, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import type { InvoiceData } from './InvoiceDisplay';

interface InvoiceActionsProps {
  invoiceData: InvoiceData;
  invoiceRef: React.RefObject<HTMLDivElement>;
  showArabic: boolean;
  onToggleArabic: (value: boolean) => void;
}

const InvoiceActions = ({ 
  invoiceData, 
  invoiceRef, 
  showArabic, 
  onToggleArabic 
}: InvoiceActionsProps) => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();

  const handleExportPDF = async () => {
    if (!invoiceRef.current) return;
    
    // Temporarily switch to French for PDF
    const wasArabic = showArabic;
    if (wasArabic) {
      onToggleArabic(false);
      // Wait for re-render
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const canvas = await html2canvas(invoiceRef.current, {
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
      pdf.save(`${invoiceData.type.toLowerCase()}-${invoiceData.number}-${Date.now()}.pdf`);

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
      // Restore Arabic if it was on
      if (wasArabic) {
        onToggleArabic(true);
      }
    }
  };

  const handleExportImage = async () => {
    if (!invoiceRef.current) return;

    // Temporarily switch to French for image
    const wasArabic = showArabic;
    if (wasArabic) {
      onToggleArabic(false);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      
      const link = document.createElement('a');
      link.download = `${invoiceData.type.toLowerCase()}-${invoiceData.number}-${Date.now()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();

      toast({
        title: isRTL ? "تم الحفظ" : "Enregistré",
        description: isRTL ? "تم حفظ الصورة" : "L'image a été enregistrée",
      });
    } catch (error) {
      console.error('Image export error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "فشل في إنشاء الصورة" : "Échec de la création de l'image",
      });
    } finally {
      if (wasArabic) {
        onToggleArabic(true);
      }
    }
  };

  const handleCopyText = async () => {
    const lines = [
      `${invoiceData.type} N° ${invoiceData.number}`,
      `Date: ${invoiceData.date}`,
      '',
      'ÉMETTEUR:',
      invoiceData.emitter.name,
      `SIRET: ${invoiceData.emitter.siret}`,
      invoiceData.emitter.address,
      '',
      'CLIENT:',
      invoiceData.client.name,
      invoiceData.client.address,
      '',
      'PRESTATIONS:',
      ...invoiceData.items.map(item => 
        `- ${item.designation_fr}: ${item.quantity} ${item.unit} x ${item.unitPrice}€ = ${item.total}€`
      ),
      '',
      `Total HT: ${invoiceData.subtotal}€`,
      invoiceData.tvaExempt 
        ? invoiceData.tvaExemptText 
        : `TVA (${invoiceData.tvaRate}%): ${invoiceData.tvaAmount}€`,
      `Total TTC: ${invoiceData.total}€`,
      '',
      `Conditions: ${invoiceData.paymentTerms}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast({
        title: isRTL ? "تم النسخ" : "Copié",
        description: isRTL ? "تم نسخ النص للحافظة" : "Le texte a été copié",
      });
    } catch (error) {
      console.error('Copy error:', error);
      toast({
        variant: "destructive",
        title: isRTL ? "خطأ" : "Erreur",
        description: isRTL ? "فشل في النسخ" : "Échec de la copie",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Arabic Toggle */}
      <div className={cn(
        "flex items-center justify-center gap-3 p-3 bg-muted rounded-lg",
        isRTL && "flex-row-reverse"
      )}>
        <div className={cn(
          "flex items-center gap-2",
          isRTL && "flex-row-reverse"
        )}>
          {showArabic ? (
            <Eye className="h-4 w-4 text-primary" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <Label 
            htmlFor="arabic-toggle" 
            className={cn(
              "text-sm font-medium cursor-pointer",
              isRTL && "font-cairo"
            )}
          >
            {isRTL ? '👁️ ترجمة للعربي (للفهم فقط)' : '👁️ Voir en Arabe (pour comprendre)'}
          </Label>
        </div>
        <Switch
          id="arabic-toggle"
          checked={showArabic}
          onCheckedChange={onToggleArabic}
        />
      </div>

      {showArabic && (
        <p className={cn(
          "text-xs text-center text-muted-foreground",
          isRTL && "font-cairo"
        )}>
          {isRTL 
            ? '⚠️ الترجمة دي للفهم بس. الـ PDF هيطلع بالفرنساوي الرسمي.' 
            : '⚠️ Cette traduction est pour comprendre. Le PDF sera en français officiel.'}
        </p>
      )}

      {/* Export Buttons */}
      <div className={cn(
        "flex gap-2",
        isRTL && "flex-row-reverse"
      )}>
        <Button
          variant="default"
          size="sm"
          onClick={handleExportPDF}
          className={cn("flex-1", isRTL && "flex-row-reverse font-cairo")}
        >
          <FileText className="h-4 w-4 mr-2" />
          {isRTL ? '📄 تحميل PDF' : '📄 Télécharger PDF'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportImage}
          className={cn("flex-1", isRTL && "flex-row-reverse font-cairo")}
        >
          <Image className="h-4 w-4 mr-2" />
          {isRTL ? '🖼️ حفظ كصورة' : '🖼️ Enregistrer image'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyText}
          className={cn("flex-1", isRTL && "flex-row-reverse font-cairo")}
        >
          <Copy className="h-4 w-4 mr-2" />
          {isRTL ? '📋 نسخ النص' : '📋 Copier texte'}
        </Button>
      </div>
    </div>
  );
};

export default InvoiceActions;
