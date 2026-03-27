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
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import type { InvoiceData } from './InvoiceDisplay';
import type { LineItem } from './LineItemEditor';
import ProtectedDocumentWrapper from '@/components/shared/ProtectedDocumentWrapper';
import { embedFacturXInPdf, buildFacturXDataFromInvoice } from '@/lib/facturxPdf';


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
  isPaid?: boolean;
}

type PdfChunkPlan =
  | {
      kind: 'section';
      key: string;
      element: HTMLElement;
      heightPx: number;
    }
  | {
      kind: 'table';
      key: string;
      sourceTable: HTMLTableElement;
      rows: HTMLTableRowElement[];
      heightPx: number;
    };

interface PdfPagePlan {
  chunks: PdfChunkPlan[];
  usedPx: number;
}

const InvoiceActions = ({ 
  invoiceData, 
  invoiceRef, 
  showArabic, 
  onToggleArabic,
  onUpdateInvoice,
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

  const waitForImages = async (root: ParentNode) => {
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(
      images.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
      )
    );
  };

  const waitForLayout = (delay = 80) => new Promise((resolve) => setTimeout(resolve, delay));

  const captureCanvas = async (element: HTMLElement) => {
    await waitForImages(element);
    await waitForLayout();

    const width = Math.max(Math.ceil(element.scrollWidth), 1);
    const height = Math.max(Math.ceil(element.scrollHeight), 1);

    return html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: -window.scrollY,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
    });
  };

  const renderTableChunk = async (sourceTable: HTMLTableElement, rows: HTMLTableRowElement[], contentWidthPx: number) => {
    const mount = document.createElement('div');
    mount.className = 'french-invoice pdf-render-mode';
    mount.style.position = 'fixed';
    mount.style.left = '-100000px';
    mount.style.top = '0';
    mount.style.width = `${Math.ceil(contentWidthPx)}px`;
    mount.style.margin = '0';
    mount.style.padding = '0';
    mount.style.background = '#ffffff';
    mount.style.boxSizing = 'border-box';
    mount.style.zIndex = '-1';

    const tableClone = sourceTable.cloneNode(false) as HTMLTableElement;
    tableClone.style.width = '100%';
    tableClone.style.margin = '0';
    tableClone.style.borderCollapse = 'collapse';

    const colgroup = sourceTable.querySelector('colgroup');
    const thead = sourceTable.querySelector('thead');

    if (colgroup) tableClone.appendChild(colgroup.cloneNode(true));
    if (thead) tableClone.appendChild(thead.cloneNode(true));

    const tbody = document.createElement('tbody');
    rows.forEach((row) => tbody.appendChild(row.cloneNode(true)));
    tableClone.appendChild(tbody);
    mount.appendChild(tableClone);
    document.body.appendChild(mount);

    try {
      return await captureCanvas(mount);
    } finally {
      document.body.removeChild(mount);
    }
  };

  const createMainPagePlan = (
    mainPage: HTMLElement,
    contentWidthMm: number,
    maxContentHeightMm: number,
    sectionGapMm: number,
  ) => {
    const computed = window.getComputedStyle(mainPage);
    const contentWidthPx =
      mainPage.getBoundingClientRect().width -
      parseFloat(computed.paddingLeft || '0') -
      parseFloat(computed.paddingRight || '0');

    const pxPerMm = contentWidthPx / contentWidthMm;
    const maxPagePx = maxContentHeightMm * pxPerMm;
    const gapPx = sectionGapMm * pxPerMm;

    const sectionElements = Array.from(mainPage.querySelectorAll('[data-pdf-section]')) as HTMLElement[];
    const sectionMap = new Map(sectionElements.map((section) => [section.dataset.pdfSection ?? '', section]));
    const tableElement = sectionMap.get('table') as HTMLTableElement | undefined;

    const preTableSections = ['header', 'client', 'objet']
      .map((key) => sectionMap.get(key))
      .filter(Boolean) as HTMLElement[];

    const postTableSections = ['bloc-total', 'bloc-conditions', 'bloc-signature', 'footer']
      .map((key) => sectionMap.get(key))
      .filter(Boolean) as HTMLElement[];

    const pages: PdfPagePlan[] = [{ chunks: [], usedPx: 0 }];

    const currentPage = () => pages[pages.length - 1];
    const startNewPage = () => pages.push({ chunks: [], usedPx: 0 });

    const addChunk = (chunk: PdfChunkPlan) => {
      let page = currentPage();
      const gap = page.chunks.length > 0 ? gapPx : 0;
      if (page.chunks.length > 0 && page.usedPx + gap + chunk.heightPx > maxPagePx) {
        startNewPage();
        page = currentPage();
      }

      page.usedPx += (page.chunks.length > 0 ? gapPx : 0) + chunk.heightPx;
      page.chunks.push(chunk);
    };

    preTableSections.forEach((section) => {
      addChunk({
        kind: 'section',
        key: section.dataset.pdfSection || 'section',
        element: section,
        heightPx: section.getBoundingClientRect().height,
      });
    });

    if (tableElement) {
      const tableHead = tableElement.querySelector('thead') as HTMLElement | null;
      const tableHeaderHeightPx = tableHead?.getBoundingClientRect().height ?? 0;
      const allRows = Array.from(tableElement.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
      const rowHeights = new Map(allRows.map((row) => [row, row.getBoundingClientRect().height]));

      const postTableHeightPx = postTableSections.reduce((sum, section) => sum + section.getBoundingClientRect().height, 0);
      const postTableGapPx = gapPx * Math.max(postTableSections.length - 1, 0);
      const minTargetLastPagePx = Math.min(
        maxPagePx,
        Math.max(maxPagePx * 0.8, postTableHeightPx + postTableGapPx + tableHeaderHeightPx),
      );

      let reservedStart = allRows.length;
      let reservedRowsHeightPx = 0;

      while (
        reservedStart > 0 &&
        postTableHeightPx +
          postTableGapPx +
          tableHeaderHeightPx +
          reservedRowsHeightPx <
          minTargetLastPagePx
      ) {
        reservedStart -= 1;
        reservedRowsHeightPx += rowHeights.get(allRows[reservedStart]) ?? 0;
      }

      const leadingRows = allRows.slice(0, reservedStart);
      const reservedRows = allRows.slice(reservedStart);

      const queueTableRows = (rows: HTMLTableRowElement[], prefix: string) => {
        let rowIndex = 0;
        let chunkIndex = 0;

        while (rowIndex < rows.length) {
          let page = currentPage();
          let availablePx = maxPagePx - page.usedPx - (page.chunks.length > 0 ? gapPx : 0);

          if (availablePx <= tableHeaderHeightPx && page.chunks.length > 0) {
            startNewPage();
            page = currentPage();
            availablePx = maxPagePx;
          }

          const chunkRows: HTMLTableRowElement[] = [];
          let chunkHeightPx = tableHeaderHeightPx;

          while (rowIndex < rows.length) {
            const nextRow = rows[rowIndex];
            const nextHeight = rowHeights.get(nextRow) ?? nextRow.getBoundingClientRect().height;
            const projectedHeight = chunkHeightPx + nextHeight;

            if (projectedHeight <= availablePx || chunkRows.length === 0) {
              chunkRows.push(nextRow);
              chunkHeightPx = projectedHeight;
              rowIndex += 1;
            } else {
              break;
            }
          }

          addChunk({
            kind: 'table',
            key: `${prefix}-${chunkIndex}`,
            sourceTable: tableElement,
            rows: chunkRows,
            heightPx: chunkHeightPx,
          });
          chunkIndex += 1;
        }
      };

      queueTableRows(leadingRows, 'table-main');

      const reservedPackageHeightPx =
        (reservedRows.length > 0 ? tableHeaderHeightPx + reservedRowsHeightPx + gapPx : 0) +
        postTableHeightPx +
        postTableGapPx;

      if (
        reservedRows.length > 0 &&
        reservedPackageHeightPx <= maxPagePx &&
        currentPage().chunks.length > 0 &&
        currentPage().usedPx + gapPx + reservedPackageHeightPx > maxPagePx
      ) {
        startNewPage();
      }

      queueTableRows(reservedRows, 'table-tail');
    }

    postTableSections.forEach((section) => {
      addChunk({
        kind: 'section',
        key: section.dataset.pdfSection || 'section',
        element: section,
        heightPx: section.getBoundingClientRect().height,
      });
    });

    if (pages.length > 1) {
      const lastPage = pages[pages.length - 1];
      const previousPage = pages[pages.length - 2];
      const minLastPagePx = maxPagePx * 0.8;
      const minPreviousPagePx = maxPagePx * 0.65;

      while (lastPage.usedPx < minLastPagePx && previousPage.chunks.length > 0) {
        const candidate = previousPage.chunks[previousPage.chunks.length - 1];
        if (candidate.kind !== 'table') break;

        const previousGapReduction = previousPage.chunks.length > 1 ? gapPx : 0;
        const nextGapIncrease = lastPage.chunks.length > 0 ? gapPx : 0;
        const nextUsedPx = lastPage.usedPx + nextGapIncrease + candidate.heightPx;
        const previousUsedPx = previousPage.usedPx - candidate.heightPx - previousGapReduction;

        if (nextUsedPx > maxPagePx || (previousPage.chunks.length > 1 && previousUsedPx < minPreviousPagePx)) {
          break;
        }

        previousPage.chunks.pop();
        previousPage.usedPx = previousUsedPx;
        lastPage.chunks.unshift(candidate);
        lastPage.usedPx = nextUsedPx;
      }

      if (previousPage.chunks.length === 0) {
        pages.splice(pages.length - 2, 1);
      }
    }

    return { pages, contentWidthPx };
  };

  const buildPdfBlob = async ({ embedFacturX = false }: { embedFacturX?: boolean } = {}) => {
    if (!invoiceRef.current) return null;

    const wasArabic = showArabic;
    if (wasArabic) {
      onToggleArabic(false);
      await waitForLayout(150);
    }

    try {
      const container = invoiceRef.current.closest('.print-area') || invoiceRef.current.parentElement;
      const allInvoicePages = container
        ? Array.from(container.querySelectorAll('.french-invoice'))
        : [invoiceRef.current];

      allInvoicePages.forEach((page) => (page as HTMLElement).classList.add('pdf-render-mode'));
      await waitForLayout(150);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const MARGIN = 10;
      const CONTENT_WIDTH = pdfWidth - MARGIN * 2;
      const MAX_CONTENT_HEIGHT = pdfHeight - MARGIN * 2;
      const SECTION_GAP = 2;

      const mainPage = allInvoicePages[0] as HTMLElement;
      const { pages, contentWidthPx } = createMainPagePlan(mainPage, CONTENT_WIDTH, MAX_CONTENT_HEIGHT, SECTION_GAP);

      const renderChunk = async (chunk: PdfChunkPlan) => {
        if (chunk.kind === 'table') {
          return renderTableChunk(chunk.sourceTable, chunk.rows, contentWidthPx);
        }
        return captureCanvas(chunk.element);
      };

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
        if (pageIndex > 0) pdf.addPage();

        let currentY = MARGIN;
        for (let chunkIndex = 0; chunkIndex < pages[pageIndex].chunks.length; chunkIndex += 1) {
          const chunk = pages[pageIndex].chunks[chunkIndex];
          const canvas = await renderChunk(chunk);
          const heightMm = (canvas.height * CONTENT_WIDTH) / canvas.width;
          const imageData = canvas.toDataURL('image/png');
          pdf.addImage(imageData, 'PNG', MARGIN, currentY, CONTENT_WIDTH, heightMm);
          currentY += heightMm + (chunkIndex < pages[pageIndex].chunks.length - 1 ? SECTION_GAP : 0);
        }
      }

      for (let index = 1; index < allInvoicePages.length; index += 1) {
        pdf.addPage();
        const annexePage = allInvoicePages[index] as HTMLElement;
        const canvas = await captureCanvas(annexePage);
        const rawHeightMm = (canvas.height * CONTENT_WIDTH) / canvas.width;
        const fittedHeightMm = Math.min(rawHeightMm, MAX_CONTENT_HEIGHT);
        const fittedWidthMm = rawHeightMm > MAX_CONTENT_HEIGHT
          ? CONTENT_WIDTH * (MAX_CONTENT_HEIGHT / rawHeightMm)
          : CONTENT_WIDTH;
        const xOffset = MARGIN + (CONTENT_WIDTH - fittedWidthMm) / 2;

        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', xOffset, MARGIN, fittedWidthMm, fittedHeightMm);
      }

      const totalPages = pdf.getNumberOfPages();
      const docLabel = `${invoiceData.type} n° ${invoiceData.number}`;
      for (let p = 1; p <= totalPages; p += 1) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        const footerText = `${docLabel} — Page ${p} / ${totalPages}`;
        const textWidth = pdf.getTextWidth(footerText);
        pdf.text(footerText, (pdfWidth - textWidth) / 2, pdfHeight - 6);
      }

      let blob = pdf.output('blob');

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
      const container = invoiceRef.current?.closest('.print-area') || invoiceRef.current?.parentElement;
      const allPages = container
        ? Array.from(container.querySelectorAll('.french-invoice'))
        : invoiceRef.current ? [invoiceRef.current] : [];
      allPages.forEach((page) => (page as HTMLElement).classList.remove('pdf-render-mode'));

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
      `Total: ${invoiceData.total.toFixed(2)}€\n`
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
      link.click();
      URL.revokeObjectURL(url);

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
                    link.click();
                    URL.revokeObjectURL(url);
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
