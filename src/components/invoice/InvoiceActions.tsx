import { useState } from 'react';
import { FileText, Image, Copy, Eye, EyeOff, Coins, PenLine, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import InsufficientCreditsModal from '@/components/shared/InsufficientCreditsModal';
import SmartReviewModal from './SmartReviewModal';
import SignatureModal from './SignatureModal';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import type { InvoiceData } from './InvoiceDisplay';
import type { LineItem } from './LineItemEditor';

interface SuggestedAddon {
  id: string;
  label_fr: string;
  label_ar: string;
  icon: string;
  defaultPrice: number;
  price: number;
  selected: boolean;
  isParking?: boolean;
}

interface InvoiceActionsProps {
  invoiceData: InvoiceData;
  invoiceRef: React.RefObject<HTMLDivElement>;
  showArabic: boolean;
  onToggleArabic: (value: boolean) => void;
  onUpdateInvoice?: (updatedData: InvoiceData) => void;
}

const InvoiceActions = ({ 
  invoiceData, 
  invoiceRef, 
  showArabic, 
  onToggleArabic,
  onUpdateInvoice 
}: InvoiceActionsProps) => {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const { balance, canAfford, deductCredits, getCost } = useCredits();
  const [showInsufficientCredits, setShowInsufficientCredits] = useState(false);
  const [showSmartReview, setShowSmartReview] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [signedPdfBlob, setSignedPdfBlob] = useState<Blob | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const creditCost = getCost('invoice_pdf');

  // Handle signature completion
  const handleSignatureComplete = async (signatureDataUrl: string) => {
    if (!onUpdateInvoice) return;

    // Update invoice with signature
    const signedData: InvoiceData = {
      ...invoiceData,
      signatureDataUrl,
      signatureDate: new Date().toLocaleDateString('fr-FR'),
    };
    
    onUpdateInvoice(signedData);
    setIsSigned(true);

    toast({
      title: isRTL ? '✅ تم التوقيع!' : '✅ Document signé!',
      description: isRTL 
        ? 'الوثيقة جاهزة للتحميل أو الإرسال'
        : 'Le document est prêt à être téléchargé ou partagé',
    });

    // Wait for re-render then generate PDF
    setTimeout(async () => {
      await generateSignedPdf();
    }, 300);
  };

  // Generate PDF from signed invoice
  const generateSignedPdf = async () => {
    if (!invoiceRef.current) return null;

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
      
      const blob = pdf.output('blob');
      setSignedPdfBlob(blob);

      // Upload to Supabase storage
      if (user) {
        await uploadSignedPdf(blob);
      }

      return blob;
    } catch (error) {
      console.error('PDF generation error:', error);
    } finally {
      if (wasArabic) {
        onToggleArabic(true);
      }
    }
    return null;
  };

  // Upload signed PDF to Supabase storage
  const uploadSignedPdf = async (blob: Blob) => {
    if (!user) return;

    setIsUploading(true);
    try {
      const fileName = `${user.id}/${invoiceData.type.toLowerCase()}-${invoiceData.number}-signed-${Date.now()}.pdf`;
      
      const { data, error } = await supabase.storage
        .from('signed-documents')
        .upload(fileName, blob, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (error) {
        console.error('Upload error:', error);
        // Bucket might not exist yet - that's ok, we'll still have the local blob
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('signed-documents')
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        setSignedPdfUrl(urlData.publicUrl);
      }

      toast({
        title: isRTL ? '📁 تم الحفظ!' : '📁 Sauvegardé!',
        description: isRTL 
          ? 'الوثيقة محفوظة في ملفاتك'
          : 'Le document est sauvegardé dans vos fichiers',
      });
    } catch (error) {
      console.error('Storage error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Share via WhatsApp
  const handleWhatsAppShare = async () => {
    let pdfBlob = signedPdfBlob;
    
    if (!pdfBlob) {
      pdfBlob = await generateSignedPdf();
    }

    if (!pdfBlob) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'تعذر إنشاء الـ PDF' : 'Impossible de générer le PDF',
      });
      return;
    }

    // Create download link first (WhatsApp can't directly share files via web API)
    const url = URL.createObjectURL(pdfBlob);
    const filename = `${invoiceData.type.toLowerCase()}-${invoiceData.number}.pdf`;
    
    // Download the file
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    // Prepare WhatsApp message
    const message = encodeURIComponent(
      `${invoiceData.type} N° ${invoiceData.number}\n` +
      `Client: ${invoiceData.client.name}\n` +
      `Total: ${invoiceData.total.toFixed(2)}€\n\n` +
      `✅ Document signé le ${new Date().toLocaleDateString('fr-FR')}`
    );

    // Open WhatsApp with pre-filled message
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');

    toast({
      title: isRTL ? '📲 جاهز للإرسال!' : '📲 Prêt à envoyer!',
      description: isRTL 
        ? 'الـ PDF تم تحميله. أرفقه في واتساب'
        : 'Le PDF est téléchargé. Attachez-le dans WhatsApp',
    });

    URL.revokeObjectURL(url);
  };

  // Open smart review instead of directly exporting
  const handlePDFClick = () => {
    // Check if user is logged in
    if (!user) {
      toast({
        variant: "destructive",
        title: isRTL ? "تسجيل الدخول مطلوب" : "Connexion requise",
        description: isRTL 
          ? "سجل الدخول لتحميل الفواتير" 
          : "Connectez-vous pour télécharger des factures",
      });
      return;
    }

    // Check if user can afford this action
    if (!canAfford('invoice_pdf')) {
      setShowInsufficientCredits(true);
      return;
    }

    // Show smart review modal
    setShowSmartReview(true);
  };

  const handleSmartReviewConfirm = async (addons: SuggestedAddon[]) => {
    setShowSmartReview(false);
    
    // If addons were selected, update the invoice first
    if (addons.length > 0 && onUpdateInvoice) {
      const newItems = [
        ...invoiceData.items,
        ...addons.map(addon => ({
          designation_fr: addon.label_fr,
          designation_ar: addon.label_ar,
          quantity: 1,
          unit: 'forfait',
          unitPrice: addon.price,
          total: addon.price,
        }))
      ];
      
      const newSubtotal = newItems.reduce((sum, item) => sum + item.total, 0);
      const newTvaAmount = invoiceData.tvaExempt ? 0 : Math.round(newSubtotal * (invoiceData.tvaRate / 100) * 100) / 100;
      const newTotal = newSubtotal + newTvaAmount;
      
      const updatedData: InvoiceData = {
        ...invoiceData,
        items: newItems,
        subtotal: Math.round(newSubtotal * 100) / 100,
        tvaAmount: newTvaAmount,
        total: Math.round(newTotal * 100) / 100,
      };
      
      onUpdateInvoice(updatedData);
      
      // Wait for re-render before exporting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Now proceed with PDF export
    await executeExportPDF();
  };

  const handleSmartReviewCancel = () => {
    setShowSmartReview(false);
  };

  const executeExportPDF = async () => {
    if (!invoiceRef.current) return;
    
    // Temporarily switch to French for PDF
    const wasArabic = showArabic;
    if (wasArabic) {
      onToggleArabic(false);
      // Wait for re-render
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      // Deduct credits first
      const success = await deductCredits('invoice_pdf');
      if (!success) {
        if (wasArabic) onToggleArabic(true);
        return;
      }

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
      {/* Signature Button - Primary action for getting client approval */}
      <Button
        onClick={() => setShowSignatureModal(true)}
        disabled={isSigned}
        className={cn(
          "w-full py-6 text-base font-medium",
          isSigned 
            ? "bg-green-600 hover:bg-green-600 cursor-default" 
            : "bg-blue-600 hover:bg-blue-700",
          isRTL && "font-cairo flex-row-reverse"
        )}
      >
        <PenLine className="h-5 w-5 mr-2" />
        {isSigned 
          ? (isRTL ? '✅ تم التوقيع' : '✅ Document signé')
          : (isRTL ? '✍️ خلّي الزبون يوقّع' : '✍️ Faire signer le client')
        }
      </Button>

      {/* WhatsApp Share - Only shown after signing */}
      {isSigned && (
        <Button
          onClick={handleWhatsAppShare}
          disabled={isUploading}
          className={cn(
            "w-full py-5 bg-green-500 hover:bg-green-600 text-white",
            isRTL && "font-cairo flex-row-reverse"
          )}
        >
          <Share2 className="h-5 w-5 mr-2" />
          {isUploading 
            ? (isRTL ? '⏳ جاري الحفظ...' : '⏳ Sauvegarde...')
            : (isRTL ? '📲 ابعت بالواتساب' : '📲 Envoyer par WhatsApp')
          }
        </Button>
      )}

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
          onClick={handlePDFClick}
          className={cn("flex-1 relative", isRTL && "flex-row-reverse font-cairo")}
        >
          <FileText className="h-4 w-4 mr-2" />
          {isRTL ? '📄 تحميل PDF' : '📄 Télécharger PDF'}
          {creditCost > 0 && (
            <Badge 
              variant="secondary" 
              className="ml-2 text-xs px-1.5 py-0"
            >
              <Coins className="h-3 w-3 mr-0.5" />
              {creditCost}
            </Badge>
          )}
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

      <InsufficientCreditsModal
        open={showInsufficientCredits}
        onOpenChange={setShowInsufficientCredits}
        currentBalance={balance}
        requiredCredits={creditCost}
      />

      <SmartReviewModal
        open={showSmartReview}
        onOpenChange={setShowSmartReview}
        invoiceData={invoiceData}
        workSiteAddress={
          invoiceData.workSite?.sameAsClient === false && invoiceData.workSite?.address
            ? invoiceData.workSite.address
            : invoiceData.client.address
        }
        onConfirm={handleSmartReviewConfirm}
        onCancel={handleSmartReviewCancel}
        creditCost={creditCost}
      />

      <SignatureModal
        open={showSignatureModal}
        onOpenChange={setShowSignatureModal}
        onSignatureComplete={handleSignatureComplete}
        documentType={invoiceData.type as 'DEVIS' | 'FACTURE'}
        documentNumber={invoiceData.number}
      />
    </div>
  );
};

export default InvoiceActions;
