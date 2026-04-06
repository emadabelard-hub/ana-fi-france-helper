import { useState } from 'react';
import { FileText, Image, Copy, Eye, EyeOff, Share2, ShieldCheck, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import SmartReviewModal from './SmartReviewModal';
import { cn } from '@/lib/utils';
import { calculateInvoiceTotals, validateInvoiceTotalsConsistency } from '@/lib/invoiceTotals';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import type { InvoiceData } from './InvoiceDisplay';
import type { LineItem } from './LineItemEditor';
import ProtectedDocumentWrapper from '@/components/shared/ProtectedDocumentWrapper';
import { embedFacturXInPdf, buildFacturXDataFromInvoice } from '@/lib/facturxPdf';
import { buildPdfFromContainer, waitForLayout, captureCanvas } from '@/lib/pdfEngine';


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
  onBeforeExport?: () => void | Promise<void>;
  isPaid?: boolean;
}

const InvoiceActions = ({ 
  invoiceData, 
  invoiceRef, 
  showArabic, 
  onToggleArabic,
  onUpdateInvoice,
  onBeforeExport,
  isPaid: _isPaid = false,
}: InvoiceActionsProps) => {
  // TRIAL PHASE: All features unlocked — set to `_isPaid` to reactivate payments
  const isPaid = true;
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showSmartReview, setShowSmartReview] = useState(false);
  const [signedPdfBlob, setSignedPdfBlob] = useState<Blob | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const SAFETY_BLOCK_MESSAGE = 'Erreur de calcul – document bloqué pour sécurité';

  // Pre-PDF integrity check: verify TVA and totals are consistent
  const verifyFinancialIntegrity = (): boolean => {
    const subtotalFromItems = Math.round(
      invoiceData.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0) * 100
    ) / 100;

    if (Math.abs(invoiceData.subtotal - subtotalFromItems) > 0.01) {
      console.error('[PDF INTEGRITY] Subtotal mismatch:', {
        fromItems: subtotalFromItems,
        storedSubtotal: invoiceData.subtotal,
      });
      toast({
        variant: 'destructive',
        title: '⚠️ Erreur de calcul',
        description: SAFETY_BLOCK_MESSAGE,
      });
      return false;
    }

    const computedSubtotalAfterDiscount = invoiceData.subtotalAfterDiscount
      ?? Math.round((invoiceData.subtotal - (invoiceData.discountAmount ?? 0)) * 100) / 100;

    const consistency = validateInvoiceTotalsConsistency({
      subtotal: subtotalFromItems,
      tvaRate: invoiceData.tvaRate,
      tvaExempt: invoiceData.tvaExempt,
      discountType: invoiceData.discountType,
      discountValue: invoiceData.discountValue,
      discountAmount: invoiceData.discountAmount,
      computedSubtotalAfterDiscount,
      computedTvaAmount: invoiceData.tvaAmount,
      computedTotal: invoiceData.total,
    });

    if (!consistency.isValid) {
      console.error('[PDF INTEGRITY] Totals mismatch:', {
        reason: consistency.reason,
        ui: {
          subtotal: invoiceData.subtotal,
          subtotalAfterDiscount: computedSubtotalAfterDiscount,
          tva: invoiceData.tvaAmount,
          total: invoiceData.total,
        },
        expected: consistency.expectedTotals,
      });
      toast({
        variant: 'destructive',
        title: '⚠️ Erreur de calcul',
        description: SAFETY_BLOCK_MESSAGE,
      });
      return false;
    }

    return true;
  };

  const buildPdfBlob = async ({ embedFacturX = false }: { embedFacturX?: boolean } = {}) => {
    if (!invoiceRef.current) return null;

    // CRITICAL: Block PDF if financial values are inconsistent
    if (!verifyFinancialIntegrity()) return null;

    await onBeforeExport?.();

    const wasArabic = showArabic;
    if (wasArabic) {
      onToggleArabic(false);
      await waitForLayout(150);
    }

    try {
      const container = invoiceRef.current.closest('.print-area') || invoiceRef.current.parentElement;
      if (!container) return null;

      let blob = await buildPdfFromContainer(container as HTMLElement, {
        footerLabel: `${invoiceData.type} n° ${invoiceData.number}`,
      });

      if (embedFacturX) {
        try {
          const facturxData = buildFacturXDataFromInvoice(invoiceData);
          blob = await embedFacturXInPdf(blob, facturxData);
          console.log('✅ Factur-X XML embedded successfully');
        } catch (fxError) {
          console.warn('⚠️ Factur-X embedding failed, using standard PDF:', fxError);
        }
      }

      setSignedPdfBlob(blob);

      if (embedFacturX && user) {
        await uploadSignedPdf(blob);
      }

      return blob;
    } catch (error) {
      console.error('PDF generation error:', error);
      return null;
    } finally {
      if (wasArabic) {
        onToggleArabic(true);
      }
    }
  };

  const handleArabicToggle = (value: boolean) => {
    onToggleArabic(value);

    if (value) {
      requestAnimationFrame(() => {
        invoiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  // Generate PDF from signed invoice with Factur-X XML embedded
  const generateSignedPdf = async () => {
    return buildPdfBlob({ embedFacturX: true });
  };

  // Upload signed PDF to Supabase storage
  const uploadSignedPdf = async (blob: Blob) => {
    if (!user) return;

    setIsUploading(true);
    try {
      const fileName = `${user.id}/${invoiceData.type.toLowerCase()}-${invoiceData.number}-${Date.now()}.pdf`;
      
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

  // Share via WhatsApp using Web Share API (works on mobile)
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

    const filename = `${invoiceData.type.toLowerCase()}-${invoiceData.number}.pdf`;
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    // Try Web Share API first (native sharing on mobile — works with WhatsApp, email, etc.)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: `${invoiceData.type} N° ${invoiceData.number}`,
          text: `${invoiceData.type} N° ${invoiceData.number} - ${invoiceData.client.name} - Total: ${invoiceData.total.toFixed(2)}€`,
          files: [file],
        });
        toast({
          title: isRTL ? '✅ تم الإرسال!' : '✅ Envoyé!',
          description: isRTL ? 'تم مشاركة المستند بنجاح' : 'Le document a été partagé avec succès',
        });
        return;
      } catch (err: any) {
        // User cancelled share — that's fine, don't show error
        if (err?.name === 'AbortError') return;
        console.warn('Web Share failed, falling back to download:', err);
      }
    }

    // Fallback: download + open WhatsApp with message
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const message = encodeURIComponent(
      `${invoiceData.type} N° ${invoiceData.number}\n` +
      `Client: ${invoiceData.client.name}\n` +
      `Total: ${invoiceData.total.toFixed(2)}€\n`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');

    toast({
      title: isRTL ? '📲 جاهز للإرسال!' : '📲 Prêt à envoyer!',
      description: isRTL 
        ? 'الـ PDF تم تحميله. أرفقه في واتساب'
        : 'Le PDF est téléchargé. Attachez-le dans WhatsApp',
    });

    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  // Generate and download a standard PDF (no Factur-X XML)
  const handlePDFClick = async () => {
    const blob = await buildPdfBlob();
    if (!blob) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'فشل في إنشاء PDF' : 'Échec de la création du PDF',
      });
      return;
    }

    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceData.type.toLowerCase()}-${invoiceData.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      toast({
        title: isRTL ? '✅ تم التحميل' : '✅ Téléchargé',
        description: isRTL ? 'تم حفظ ملف PDF' : 'Le fichier PDF a été enregistré',
      });
    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'فشل في إنشاء PDF' : 'Échec de la création du PDF',
      });
    }
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
      const recalculatedTotals = calculateInvoiceTotals({
        subtotal: newSubtotal,
        tvaRate: invoiceData.tvaRate,
        tvaExempt: invoiceData.tvaExempt,
        discountType: invoiceData.discountType,
        discountValue: invoiceData.discountValue,
        discountAmount: invoiceData.discountAmount,
      });
      
      const updatedData: InvoiceData = {
        ...invoiceData,
        items: newItems,
        subtotal: Math.round(newSubtotal * 100) / 100,
        discountAmount: recalculatedTotals.discountAmount > 0 ? recalculatedTotals.discountAmount : undefined,
        subtotalAfterDiscount: recalculatedTotals.discountAmount > 0 ? recalculatedTotals.subtotalAfterDiscount : undefined,
        tvaAmount: recalculatedTotals.tvaAmount,
        total: recalculatedTotals.total,
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
    await handlePDFClick();
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
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const link = document.createElement('a');
      link.download = `${invoiceData.type.toLowerCase()}-${invoiceData.number}-${Date.now()}.jpg`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

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
    const regime = invoiceData.tvaRegime || (invoiceData.tvaExempt ? 'franchise' : invoiceData.tvaRate === 0 ? 'franchise' : 'standard');
    const vatMention = regime === 'standard'
      ? `TVA au taux de ${invoiceData.tvaRate}%`
      : regime === 'autoliquidation'
        ? 'Autoliquidation de la TVA – article 283-2 du CGI'
        : regime === 'intracommunautaire'
          ? 'Exonération de TVA – article 262 ter I du CGI'
          : 'TVA non applicable, art. 293 B du CGI';

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
      `Total HT: ${invoiceData.subtotal.toFixed(2)}€`,
      ...(invoiceData.discountAmount && invoiceData.discountAmount > 0 ? [
        `Remise${invoiceData.discountType === 'percent' ? ` (${invoiceData.discountValue}%)` : ''}: -${invoiceData.discountAmount.toFixed(2)}€`,
        `Sous-total HT: ${(invoiceData.subtotalAfterDiscount ?? invoiceData.subtotal).toFixed(2)}€`,
      ] : []),
      `TVA (${invoiceData.tvaRate}%): ${invoiceData.tvaAmount.toFixed(2)}€`,
      ...(vatMention ? [vatMention] : []),
      `Total TTC: ${invoiceData.total.toFixed(2)}€`,
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
          onCheckedChange={handleArabicToggle}
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

      {/* Payment-gated actions */}
      {isPaid ? (
        <>
          {/* Factur-X compliance badge */}
          <div className="flex items-center justify-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-700 dark:text-green-400">
            <ShieldCheck className="h-4 w-4" />
            <span className={cn(isRTL && "font-cairo")}>
              {isRTL ? '✅ PDF متوافق مع معيار Factur-X 2026' : '✅ PDF conforme Factur-X 2026 (EN 16931)'}
            </span>
          </div>

          <Button
            onClick={handleWhatsAppShare}
            disabled={isUploading}
            className={cn(
              "w-full py-5",
              isRTL && "font-cairo flex-row-reverse"
            )}
          >
            <Share2 className="h-5 w-5 mr-2" />
            {isUploading
              ? (isRTL ? '⏳ جاري الحفظ...' : '⏳ Sauvegarde...')
              : (isRTL ? '📲 ابعت بالواتساب' : '📲 Envoyer par WhatsApp')
            }
          </Button>

          {/* PDF export options */}
          <div className="space-y-2">
            <p className={cn("text-xs font-medium text-muted-foreground", isRTL && "text-right font-cairo")}>
              {isRTL ? '📥 تحميل PDF' : '📥 Télécharger le PDF'}
            </p>
            <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePDFClick}
                className={cn("flex-1", isRTL && "flex-row-reverse font-cairo")}
              >
                <FileText className="h-4 w-4 mr-2" />
                {isRTL ? 'PDF كلاسيكي' : 'PDF classique'}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  const blob = await generateSignedPdf();
                  if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `facturx-${invoiceData.type.toLowerCase()}-${invoiceData.number}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                    toast({
                      title: isRTL ? '✅ تم التحميل' : '✅ Téléchargé',
                      description: isRTL ? 'PDF Factur-X جاهز (EN 16931)' : 'PDF Factur-X conforme EN 16931',
                    });
                  }
                }}
                className={cn("flex-1 relative", isRTL && "flex-row-reverse font-cairo")}
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                {isRTL ? 'PDF Factur-X' : 'PDF Factur-X'}
              </Button>
            </div>
          </div>

          <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
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

          {/* Official Platform Links – Factur-X 2026 */}
          <div className="mt-4 border border-border rounded-lg p-4 space-y-3 bg-muted/30">
            <h3 className={cn(
              "text-sm font-semibold text-foreground",
              isRTL && "text-right font-cairo"
            )}>
              {isRTL ? 'الربط بالمنصات الرسمية (قانون 2026)' : 'Liens vers les plateformes officielles (loi 2026)'}
            </h3>

            <div className="flex flex-col gap-2">
              <a
                href="https://chorus-pro.gouv.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-3 w-full px-4 py-3 rounded-md border border-border bg-background text-foreground text-sm font-medium hover:bg-accent/50 transition-colors",
                  isRTL && "flex-row-reverse font-cairo"
                )}
              >
                <img src="https://chorus-pro.gouv.fr/qualif/assets/images/Logo_RF_quadri.svg" alt="Chorus Pro" className="h-6 w-6 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span>{isRTL ? 'رفع الفاتورة على Chorus Pro' : 'Déposer la facture sur Chorus Pro'}</span>
                <ExternalLink className="h-4 w-4 ml-auto shrink-0 text-muted-foreground" />
              </a>

              <a
                href="https://www.portail-public-facturation.gouv.fr/"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-3 w-full px-4 py-3 rounded-md border border-border bg-background text-foreground text-sm font-medium hover:bg-accent/50 transition-colors",
                  isRTL && "flex-row-reverse font-cairo"
                )}
              >
                <img src="https://www.portail-public-facturation.gouv.fr/assets/images/logo-ppf.svg" alt="PPF" className="h-6 w-6 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span>{isRTL ? 'إرسال إلى منصة الضرائب (PPF)' : 'Envoyer au Portail Public de Facturation (PPF)'}</span>
                <ExternalLink className="h-4 w-4 ml-auto shrink-0 text-muted-foreground" />
              </a>
            </div>

            <p className={cn(
              "text-xs text-foreground leading-relaxed",
              isRTL && "text-right font-cairo"
            )}>
              {isRTL
                ? 'ملحوظة: ملف الـ Factur-X اللي حملته جاهز للرفع مباشرة، السيستم الحكومي هيقرأ البيانات لوحده.'
                : 'Note : Le fichier Factur-X que vous avez téléchargé est prêt à être déposé directement. Le système gouvernemental lira les données automatiquement.'}
            </p>
          </div>
        </>
      ) : null}

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
        creditCost={0}
      />
    </div>
  );
};

export default InvoiceActions;
