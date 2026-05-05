import { buildPdfFromContainer, waitForLayout } from '@/lib/pdfEngine';
import { archivePdf, type ArchiveDocType } from '@/lib/documentArchive';

interface GenerateOfficialPdfBlobParams {
  invoiceElement: HTMLElement | null;
  footerLabel: string;
  onBeforeExport?: () => void | Promise<void>;
  onToggleArabic: (value: boolean) => void;
  showArabic: boolean;
  archive?: {
    type: ArchiveDocType;
    numero?: string | null;
    fileName: string;
    amount?: number | null;
    status?: string | null;
  };
}

export async function generateOfficialPdfBlob({
  invoiceElement,
  footerLabel,
  onBeforeExport,
  onToggleArabic,
  showArabic,
  archive,
}: GenerateOfficialPdfBlobParams): Promise<Blob | null> {
  if (!invoiceElement) return null;

  await onBeforeExport?.();

  const wasArabic = showArabic;
  if (wasArabic) {
    onToggleArabic(false);
    await waitForLayout(150);
  }

  try {
    const container = invoiceElement.closest('.print-area') || invoiceElement.parentElement;
    if (!container) return null;

    const blob = await buildPdfFromContainer(container as HTMLElement, {
      footerLabel,
    });

    // Auto-archive in background (non-blocking, fail-silent)
    if (blob && archive) {
      archivePdf({ blob, ...archive }).catch((e) => console.warn('archive failed:', e));
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
}