import { buildPdfFromContainer, waitForLayout } from '@/lib/pdfEngine';

interface GenerateOfficialPdfBlobParams {
  invoiceElement: HTMLElement | null;
  footerLabel: string;
  onBeforeExport?: () => void | Promise<void>;
  onToggleArabic: (value: boolean) => void;
  showArabic: boolean;
}

export async function generateOfficialPdfBlob({
  invoiceElement,
  footerLabel,
  onBeforeExport,
  onToggleArabic,
  showArabic,
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

    return await buildPdfFromContainer(container as HTMLElement, {
      footerLabel,
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    return null;
  } finally {
    if (wasArabic) {
      onToggleArabic(true);
    }
  }
}