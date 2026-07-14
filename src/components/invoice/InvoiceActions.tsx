import { useState } from 'react';
import { FileText, Copy, Eye, EyeOff, Share2, ShieldCheck, ExternalLink, Download, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MessageCircle, Mail } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import SmartReviewModal from './SmartReviewModal';
import { cn } from '@/lib/utils';
import { calculateInvoiceTotals, validateInvoiceTotalsConsistency } from '@/lib/invoiceTotals';
import { supabase } from '@/integrations/supabase/client';
import type { InvoiceData } from './InvoiceDisplay';
import { embedFacturXInPdf, buildFacturXDataFromInvoice } from '@/lib/facturxPdf';
import { generateFacturXXml } from '@/lib/facturxXml';
import { buildPdfFromContainer, buildHtmlSnapshot, waitForLayout } from '@/lib/pdfEngine';


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
  status?: string | null;
  documentNumber?: string;
}

// ───────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────

/** Sanitize a string for use in a filename (ASCII-safe, no spaces). */
const sanitizeForFilename = (input: string, fallback = 'document'): string => {
  if (!input) return fallback;
  const cleaned = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-zA-Z0-9-_]+/g, '-') // non-alphanum → dash
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
};

/** Build the canonical PDF filename: [TYPE]-[NUMERO]-[CLIENT].pdf */
const buildPdfFilename = (type: string, number: string, clientName: string): string => {
  const typePart = sanitizeForFilename(type, 'Document');
  // Capitalize first letter of type for readability (Devis / Facture)
  const typeNice = typePart.charAt(0).toUpperCase() + typePart.slice(1).toLowerCase();
  const numberPart = sanitizeForFilename(number, 'SansNumero');
  const clientPart = sanitizeForFilename(clientName, 'Client');
  return `${typeNice}-${numberPart}-${clientPart}.pdf`;
};

/** Format an amount as European currency (1.250,00 €). */
const formatEUR = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const InvoiceActions = ({ 
  invoiceData, 
  invoiceRef, 
  showArabic, 
  onToggleArabic,
  onUpdateInvoice,
  onBeforeExport,
  isPaid: _isPaid = false,
  status,
  documentNumber,
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
  const [signatureChoice, setSignatureChoice] = useState<{ url: string; token: string } | null>(null);
  const [isSendingSignatureEmail, setIsSendingSignatureEmail] = useState(false);
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

  /**
   * Generate a real binary PDF from the rendered invoice DOM.
   * Returns the Blob (caller decides what to do with it).
   */
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

  /**
   * Trigger a real download of the binary PDF blob to the user's device.
   * Uses a synthetic <a download> link as required.
   */
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  /**
   * Upload the PDF to Supabase Storage at /{user_id}/{type}-{numero}-{date}.pdf
   * and return a signed public URL (24h validity) for sharing.
   * Also persists pdf_url in documents_comptables when documentId is known.
   */
  const uploadPdfAndGetShareUrl = async (blob: Blob): Promise<string | null> => {
    if (!user) return null;

    setIsUploading(true);
    try {
      const datePart = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const typePart = sanitizeForFilename(invoiceData.type, 'document').toLowerCase();
      const numberPart = sanitizeForFilename(invoiceData.number, 'sansnumero');
      const storagePath = `${user.id}/${typePart}-${numberPart}-${datePart}.pdf`;

      // Upsert: re-uploads overwrite previous version of the same document
      const { error: uploadError } = await supabase.storage
        .from('signed-documents')
        .upload(storagePath, blob, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadError) {
        console.error('[PDF Upload] Storage error:', uploadError);
        return null;
      }

      // Generate a signed URL valid 24h for sharing (bucket is private)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('signed-documents')
        .createSignedUrl(storagePath, 60 * 60 * 24);

      if (signedError || !signedData?.signedUrl) {
        console.error('[PDF Upload] Signed URL error:', signedError);
        return null;
      }

      const shareUrl = signedData.signedUrl;
      setSignedPdfUrl(shareUrl);

      // Persist pdf_url in the documents table if we have a documentId
      const docId = (invoiceData as { documentId?: string }).documentId;
      if (docId) {
        // SECURITY: Scope by user_id (RLS protects too, but defence-in-depth)
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser?.id) return shareUrl;
        const { error: updateError } = await supabase
          .from('documents_comptables')
          .update({ pdf_url: shareUrl })
          .eq('id', docId)
          .eq('user_id', authUser.id);
        if (updateError) {
          console.warn('[PDF Upload] Could not persist pdf_url:', updateError);
        }
      }

      return shareUrl;
    } catch (error) {
      console.error('[PDF Upload] Unexpected error:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * CORRECTION 2 — WhatsApp share:
   * 1. Build the real PDF (with Factur-X embedded)
   * 2. Upload to Supabase Storage
   * 3. Get a public signed URL
   * 4. Open WhatsApp with structured message including the link
   */
  const handleWhatsAppShare = async () => {
    let pdfBlob = signedPdfBlob;

    if (!pdfBlob) {
      pdfBlob = await buildPdfBlob({ embedFacturX: true });
    }

    if (!pdfBlob) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'تعذر إنشاء الـ PDF' : 'Impossible de générer le PDF',
      });
      return;
    }

    // Upload + get share URL
    let shareUrl = signedPdfUrl;
    if (!shareUrl) {
      shareUrl = await uploadPdfAndGetShareUrl(pdfBlob);
    }

    const docTypeLower = (invoiceData.type || 'document').toLowerCase();
    const message = shareUrl
      ? `Bonjour, veuillez trouver ci-joint votre ${docTypeLower} n° ${invoiceData.number} d'un montant de ${formatEUR(invoiceData.total)} TTC.\nLien : ${shareUrl}`
      : `Bonjour, veuillez trouver ci-joint votre ${docTypeLower} n° ${invoiceData.number} d'un montant de ${formatEUR(invoiceData.total)} TTC.`;

    // Always also offer the file locally so the user has a copy
    const filename = buildPdfFilename(invoiceData.type, invoiceData.number, invoiceData.client.name);
    downloadBlob(pdfBlob, filename);

    // Open WhatsApp with the prefilled message
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');

    toast({
      title: isRTL ? '📲 جاهز للإرسال!' : '📲 Prêt à envoyer!',
      description: shareUrl
        ? (isRTL ? 'الرابط جاهز في الواتساب والـ PDF محفوظ' : 'Lien partagé dans WhatsApp + PDF téléchargé')
        : (isRTL ? 'الـ PDF تم تحميله. أرفقه في واتساب' : 'PDF téléchargé. Joignez-le dans WhatsApp'),
    });
  };

  /**
   * CORRECTION 1 + 4 — Direct PDF download:
   * Generates a real binary PDF, names it [TYPE]-[NUMERO]-[CLIENT].pdf,
   * triggers a real download and silently uploads it to Storage.
   */
  const handlePDFClick = async () => {
    const blob = await buildPdfBlob({ embedFacturX: true });
    if (!blob) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'فشل في إنشاء PDF' : 'Échec de la création du PDF',
      });
      return;
    }

    try {
      const filename = buildPdfFilename(invoiceData.type, invoiceData.number, invoiceData.client.name);
      downloadBlob(blob, filename);

      // CORRECTION 5 — Silent upload to Storage in the background
      void uploadPdfAndGetShareUrl(blob);

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

  /**
   * Download the raw Factur-X CII XML.
   */
  const handleDownloadXmlFacturX = () => {
    try {
      const number = documentNumber || invoiceData.number;
      const xml = generateFacturXXml(buildFacturXDataFromInvoice({ ...invoiceData, number }));
      const filename = `facturx-Facture-${sanitizeForFilename(number, 'SansNumero')}.xml`;
      downloadBlob(new Blob([xml], { type: 'application/xml;charset=utf-8' }), filename);
      toast({
        title: isRTL ? '✅ تم التحميل' : '✅ Téléchargé',
        description: isRTL ? 'XML Factur-X جاهز' : 'XML Factur-X téléchargé',
      });
    } catch (error) {
      console.error('XML Factur-X download error:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'فشل تحميل XML Factur-X' : 'Échec du téléchargement XML Factur-X',
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
    await handlePDFClick();
  };

  const handleSmartReviewCancel = () => {
    setShowSmartReview(false);
  };

  /**
   * CORRECTION 3 — "نسخ النص" now copies the public PDF link
   * (uploads the PDF first if needed) instead of raw text.
   */
  const handleCopyText = async () => {
    let pdfBlob = signedPdfBlob;
    let shareUrl = signedPdfUrl;

    if (!shareUrl) {
      if (!pdfBlob) {
        pdfBlob = await buildPdfBlob({ embedFacturX: true });
      }
      if (pdfBlob) {
        shareUrl = await uploadPdfAndGetShareUrl(pdfBlob);
      }
    }

    if (!shareUrl) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL
          ? 'تعذر إنشاء رابط الـ PDF'
          : 'Impossible de générer le lien du PDF',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: isRTL ? '🔗 تم نسخ الرابط' : '🔗 Lien copié',
        description: isRTL
          ? 'الصق الرابط في الواتساب أو الإيميل'
          : 'Collez le lien dans WhatsApp ou un e-mail',
      });
    } catch (error) {
      console.error('Copy error:', error);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL ? 'فشل في النسخ' : 'Échec de la copie',
      });
    }
  };

  /** Create a signature request and open WhatsApp with the public sign link. */
  const handleSendForSignature = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: isRTL
          ? 'احفظ المستند الأول قبل الإرسال للتوقيع'
          : "Enregistrez d'abord le document avant de l'envoyer pour signature",
      });
      return;
    }

    try {
      let docId = (invoiceData as { documentId?: string }).documentId;

      if (!docId && invoiceData.number) {
        const documentType = invoiceData.type?.toLowerCase().includes('fact') ? 'facture' : 'devis';
        const { data: savedDocument, error: lookupError } = await supabase
          .from('documents_comptables')
          .select('id')
          .eq('user_id', user.id)
          .eq('document_type', documentType)
          .eq('document_number', invoiceData.number)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lookupError) {
          console.error('[Signature] document lookup error:', lookupError);
          toast({
            variant: 'destructive',
            title: isRTL ? 'خطأ في البحث عن المستند' : 'Erreur recherche document',
            description: lookupError.message,
          });
          return;
        }

        docId = savedDocument?.id;
      }

      if (!docId) {
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ' : 'Erreur',
          description: isRTL
            ? 'احفظ المستند الأول قبل الإرسال للتوقيع'
            : "Enregistrez d'abord le document avant de l'envoyer pour signature",
        });
        return;
      }

      const { data: existing } = await supabase
        .from('signature_requests')
        .select('token, status')
        .eq('document_id', docId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let token: string | null = existing?.status === 'pending' ? (existing as any).token : null;

      if (!token) {
        // ── PRE-REQUIS SIGNATURE : garantir que le PDF original existe ──
        // Génère le PDF actuel, l'upload à un chemin stable {user_id}/{document_id}.pdf
        // (upsert), puis met à jour documents_comptables.pdf_url. En cas d'échec,
        // on N'INSÈRE PAS la demande de signature (fail-fast avec message clair).
        try {
          const originalPdfBlob = await buildPdfBlob({ embedFacturX: true });
          if (!originalPdfBlob) {
            toast({
              variant: 'destructive',
              title: isRTL ? 'خطأ في إنشاء PDF' : 'Erreur génération PDF',
              description: isRTL
                ? 'تعذر إنشاء PDF الأصلي للمستند'
                : "Impossible de générer le PDF original du devis. Réessayez.",
            });
            return;
          }

          const stablePath = `${user.id}/${docId}.pdf`;
          const { error: uploadError } = await supabase.storage
            .from('signed-documents')
            .upload(stablePath, originalPdfBlob, {
              contentType: 'application/pdf',
              upsert: true,
            });
          if (uploadError) {
            console.error('[Signature] original PDF upload error:', uploadError);
            toast({
              variant: 'destructive',
              title: isRTL ? 'خطأ في رفع PDF' : 'Erreur téléversement PDF',
              description: isRTL
                ? 'تعذر تحميل PDF الأصلي. لم يتم إنشاء طلب التوقيع.'
                : "Le PDF original n'a pas pu être téléversé. La demande de signature n'a pas été créée.",
            });
            return;
          }

          const { data: signedData, error: signedError } = await supabase.storage
            .from('signed-documents')
            .createSignedUrl(stablePath, 60 * 60 * 24 * 7);
          if (signedError || !signedData?.signedUrl) {
            console.error('[Signature] original PDF signed URL error:', signedError);
            toast({
              variant: 'destructive',
              title: isRTL ? 'خطأ في رابط PDF' : 'Erreur lien PDF',
              description: isRTL
                ? 'تعذر إنشاء رابط PDF الأصلي. لم يتم إنشاء طلب التوقيع.'
                : "URL du PDF original indisponible. La demande de signature n'a pas été créée.",
            });
            return;
          }

          const { error: updateError } = await supabase
            .from('documents_comptables')
            .update({ pdf_url: signedData.signedUrl })
            .eq('id', docId)
            .eq('user_id', user.id);
          if (updateError) {
            console.error('[Signature] pdf_url persist error:', updateError);
            toast({
              variant: 'destructive',
              title: isRTL ? 'خطأ' : 'Erreur',
              description: isRTL
                ? 'تعذر تحديث رابط PDF. لم يتم إنشاء طلب التوقيع.'
                : "Impossible d'enregistrer l'URL du PDF. La demande de signature n'a pas été créée.",
            });
            return;
          }
        } catch (prepErr: any) {
          console.error('[Signature] PDF preparation failed:', prepErr);
          toast({
            variant: 'destructive',
            title: isRTL ? 'خطأ في تحضير PDF' : 'Erreur préparation PDF',
            description: prepErr?.message || (isRTL
              ? 'تعذر تحضير PDF. لم يتم إنشاء طلب التوقيع.'
              : "Préparation du PDF impossible. La demande de signature n'a pas été créée."),
          });
          return;
        }

        const snapshot = {
          document_number: invoiceData.number,
          document_type: invoiceData.type,
          client_name: invoiceData.client?.name,
          total_ttc: invoiceData.total,
          nature_operation: (invoiceData as any).natureOperation || (invoiceData as any).objet || '',
          date: new Date().toISOString(),
          artisan_name: (invoiceData as any).company?.name || '',
        };
        // Capture HTML snapshot so the signed PDF can be regenerated by injecting
        // the client signature directly into the original document HTML.
        let htmlSnapshot: string | null = null;
        try {
          if (invoiceRef.current) {
            htmlSnapshot = await buildHtmlSnapshot(invoiceRef.current);
          }
        } catch (snapErr) {
          console.warn('[Signature] HTML snapshot failed (non-blocking):', snapErr);
        }
        const { data: created, error } = await supabase
          .from('signature_requests')
          .insert({ document_id: docId, user_id: user.id, document_snapshot: snapshot, html_snapshot: htmlSnapshot } as any)
          .select('token')
          .single();
        if (error || !created) {
          console.error('[Signature] create error:', error);
          toast({
            variant: 'destructive',
            title: isRTL ? 'خطأ في إنشاء الرابط' : 'Erreur création lien',
            description: error?.message || (isRTL ? 'تعذر إنشاء رابط التوقيع' : 'Impossible de créer le lien de signature'),
          });
          return;
        }
        token = (created as any).token;
      }

      const baseUrl = window.location.origin.includes('lovable')
        ? window.location.origin
        : 'https://anafypro.com';
      const signUrl = `${baseUrl}/sign/${token}`;

      try { await navigator.clipboard.writeText(signUrl); } catch { /* ignore */ }

      setSignatureChoice({ url: signUrl, token: token! });
    } catch (e: any) {
      console.error('[Signature] unexpected:', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: e?.message || String(e),
      });
    }
  };

  const sendSignatureViaWhatsApp = () => {
    if (!signatureChoice) return;
    const clientName = invoiceData.client?.name || '';
    const artisanName = (invoiceData as any).company?.name || '';
    const message = `Bonjour ${clientName},\n\nVeuillez signer le devis n° ${invoiceData.number} en cliquant sur ce lien :\n${signatureChoice.url}\n\nMerci — ${artisanName}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    setSignatureChoice(null);
  };

  const sendSignatureViaEmail = async () => {
    if (!signatureChoice || isSendingSignatureEmail) return;
    const clientEmail = (invoiceData.client as any)?.email || '';
    setIsSendingSignatureEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('signature-email-invite', {
        body: {
          token: signatureChoice.token,
          signUrl: signatureChoice.url,
          recipientEmail: clientEmail || undefined,
        },
      });
      if (error || (data as any)?.error) {
        const details = (data as any)?.error || error?.message || 'Envoi impossible.';
        console.error('[signature-email-invite] failed:', details);
        toast({
          variant: 'destructive',
          title: isRTL ? 'خطأ' : 'Échec de l’envoi',
          description: typeof details === 'string' ? details : 'Impossible d’envoyer l’e-mail au client.',
        });
        return;
      }
      toast({
        title: isRTL ? 'تم الإرسال' : 'E-mail envoyé',
        description: isRTL ? 'تم إرسال رابط التوقيع للعميل.' : 'Le lien de signature a été envoyé au client.',
      });
      setSignatureChoice(null);
    } catch (e: any) {
      console.error('[signature-email-invite] unexpected:', e);
      toast({
        variant: 'destructive',
        title: isRTL ? 'خطأ' : 'Erreur',
        description: 'Impossible d’envoyer l’e-mail au client.',
      });
    } finally {
      setIsSendingSignatureEmail(false);
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

          <Button
            onClick={handleSendForSignature}
            className={cn(
              "w-full py-5 bg-green-600 hover:bg-green-700 text-white border-0",
              isRTL && "font-cairo flex-row-reverse"
            )}
          >
            <PenLine className="h-5 w-5 mr-2" />
            {isRTL ? '✍️ إرسال للتوقيع' : '✍️ Envoyer pour signature'}
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
                  const blob = await buildPdfBlob({ embedFacturX: true });
                  if (blob) {
                    const filename = `facturx-${buildPdfFilename(invoiceData.type, invoiceData.number, invoiceData.client.name)}`;
                    downloadBlob(blob, filename);
                    void uploadPdfAndGetShareUrl(blob);
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
              {invoiceData.type?.toLowerCase() === 'facture' && status === 'finalized' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadXmlFacturX}
                  className={cn("flex-1", isRTL && "flex-row-reverse font-cairo")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  [📄 XML Factur-X]
                </Button>
              )}
            </div>
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

      <Dialog open={!!signatureChoice} onOpenChange={(o) => !o && setSignatureChoice(null)}>
        <DialogContent className={cn(isRTL && "font-cairo")}>
          <DialogHeader>
            <DialogTitle className={cn(isRTL && "text-right")}>
              {isRTL ? '✍️ إرسال رابط التوقيع' : '✍️ Envoyer le lien de signature'}
            </DialogTitle>
            <DialogDescription className={cn(isRTL && "text-right")}>
              {isRTL ? 'اختر طريقة الإرسال للزبون' : 'Choisissez le mode d\'envoi au client'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Button onClick={sendSignatureViaWhatsApp} className="w-full py-5 bg-green-600 hover:bg-green-700">
              <MessageCircle className="h-5 w-5 mr-2" />
              {isRTL ? '📲 واتساب' : 'WhatsApp'}
            </Button>
            <Button onClick={sendSignatureViaEmail} disabled={isSendingSignatureEmail} variant="outline" className="w-full py-5">
              <Mail className="h-5 w-5 mr-2" />
              {isSendingSignatureEmail
                ? (isRTL ? 'جارٍ الإرسال…' : 'Envoi en cours…')
                : (isRTL ? '✉️ إيميل' : 'Email')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
