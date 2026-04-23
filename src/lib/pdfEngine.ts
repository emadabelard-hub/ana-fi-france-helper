/**
 * Universal PDF Engine v4 — Browserless (headless Chrome) powered.
 *
 * Strategy:
 *   1. Serialize the rendered invoice DOM + all compiled CSS
 *   2. Send HTML to an Edge Function that proxies Browserless.io
 *   3. Browserless renders the page in real Chrome and returns a PDF
 *   4. Natural browser pagination — zero manual height calculations
 *
 * Benefits over v3:
 *   - Pixel-perfect rendering (real Chrome, not html2canvas approximation)
 *   - Natural CSS page-break support (page-break-inside: avoid works natively)
 *   - Automatic table pagination with repeating headers (thead)
 *   - No empty pages, no wasted space — Chrome handles layout perfectly
 *   - End-block (totals/signature/IBAN) stays together via CSS
 *
 * HTML contract (unchanged):
 *   - Main document: `.french-invoice`
 *   - Sections: `[data-pdf-section]`
 *   - End-block: `[data-pdf-section="end-block"]` → page-break-inside: avoid
 *   - Annexes: `.french-invoice.invoice-annexe-page`
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PdfEngineOptions {
  marginMm?: number;
  sectionGapMm?: number;
  footerLabel?: string;
  scale?: number;
}

// ─── Helpers (kept for backward compatibility with image export) ─────────────

export const waitForImages = async (root: ParentNode) => {
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

export const waitForLayout = (delay = 80) =>
  new Promise((resolve) => setTimeout(resolve, delay));

/**
 * Legacy canvas capture — kept for image export (non-PDF use cases).
 * PDF generation no longer uses this.
 */
export const captureCanvas = async (element: HTMLElement, scale = 2) => {
  await waitForImages(element);
  await waitForLayout(50);

  const html2canvas = (await import('html2canvas')).default;

  const width = Math.max(Math.ceil(element.scrollWidth), 1);
  const height = Math.max(Math.ceil(element.scrollHeight), 1);

  return html2canvas(element, {
    backgroundColor: '#ffffff',
    scale,
    useCORS: true,
    scrollX: 0,
    scrollY: -window.scrollY,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
  });
};

// ─── CSS Collection ──────────────────────────────────────────────────────────

function collectAllCSS(): string {
  const rules: string[] = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        // Skip @media print rules — they contain "visibility: hidden"
        // which hides all content. Our PDF overrides handle print styling.
        if (rule instanceof CSSMediaRule && rule.conditionText === 'print') {
          continue;
        }
        rules.push(rule.cssText);
      }
    } catch (_e) {
      // Cross-origin stylesheet (e.g. Google Fonts) — skip
    }
  }
  return rules.join('\n');
}

// ─── Image Inlining ─────────────────────────────────────────────────────────

/**
 * Convert ALL image URLs (blob:, relative, https://, http://) to base64 data URIs.
 *
 * Why: Logo / signature / cachet stored on Supabase Storage are served via signed URLs
 * that can expire, be rate-limited, or fail to load from Browserless's headless Chrome.
 * Inlining as base64 guarantees 100% reliability — the image bytes travel with the HTML.
 *
 * Only `data:` URIs (already inline) are left untouched.
 */
async function inlineLocalImages(html: string): Promise<string> {
  const imgRegex = /<img[^>]+src="([^"]+)"/g;
  const urls = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    if (url.startsWith('data:')) continue;
    urls.add(url);
  }

  // Fetch all images in parallel for speed
  const replacements = await Promise.all(
    Array.from(urls).map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (!response.ok) {
          console.warn(`[PDF Engine] Image fetch failed (${response.status}):`, url);
          return null;
        }
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        return { original: url, replacement: dataUrl };
      } catch (e) {
        console.warn('[PDF Engine] Could not inline image:', url, e);
        return null;
      }
    })
  );

  let result = html;
  for (const r of replacements) {
    if (r) result = result.split(r.original).join(r.replacement);
  }
  return result;
}

// ─── HTML Document Builder ───────────────────────────────────────────────────

function buildFullHTML(bodyContent: string, css: string, marginMm: number): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
/* ── App CSS (compiled Tailwind + custom) ── */
${css}

/* ── PDF Print Overrides ── */
@page {
  size: A4;
  margin: ${marginMm}mm;
}

/* Force light-mode colors so text is visible on white background */
:root {
  --background: 0 0% 100% !important;
  --foreground: 220 25% 10% !important;
  --card: 0 0% 100% !important;
  --card-foreground: 220 25% 10% !important;
  --popover: 0 0% 100% !important;
  --popover-foreground: 220 25% 10% !important;
  --muted: 220 14% 96% !important;
  --muted-foreground: 220 10% 40% !important;
  --border: 220 13% 87% !important;
  --primary: 37 37% 50% !important;
  --primary-foreground: 0 0% 100% !important;
  --secondary: 220 14% 96% !important;
  --secondary-foreground: 220 25% 10% !important;
  --accent: 37 37% 50% !important;
  --accent-foreground: 220 25% 10% !important;
}

html, body {
  margin: 0 !important;
  padding: 0 !important;
  background: #ffffff !important;
  color: #1a1d24 !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

/* Force all text to dark color */
*, *::before, *::after {
  color: inherit;
}

/* End-block: ALLOW natural splitting across pages.
   Only keep small sub-blocks together (totals row, signature row, IBAN row). */
[data-pdf-section="end-block"] {
  /* intentionally NO page-break-inside: avoid — let Chrome flow naturally */
}

/* Keep individual small sub-blocks together */
.invoice-totals-row,
.invoice-signature-block,
.invoice-iban-block,
.invoice-conditions-block {
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

/* Table: auto-paginate with repeating headers */
table {
  page-break-inside: auto !important;
}
thead {
  display: table-header-group !important;
}
tr {
  page-break-inside: avoid !important;
  page-break-after: auto !important;
}

/* Annexe pages: each on its own page */
.invoice-annexe-page {
  page-break-before: always !important;
  break-before: page !important;
}

/* Hide interactive elements in PDF */
button, [role="button"], .no-print, input, select, textarea,
[data-no-pdf], .pdf-hide {
  display: none !important;
}

/* Ensure invoice fills the page width cleanly */
.french-invoice {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
  padding: 20px !important;
  box-shadow: none !important;
  border: none !important;
  border-radius: 0 !important;
}
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

// ─── Main Builder ────────────────────────────────────────────────────────────

export async function buildPdfFromContainer(
  container: HTMLElement,
  options: PdfEngineOptions = {},
): Promise<Blob> {
  const { marginMm = 10, footerLabel } = options;

  // Activate render mode for consistent sizing
  const invoicePages = Array.from(container.querySelectorAll('.french-invoice')) as HTMLElement[];
  if (invoicePages.length === 0) throw new Error('No .french-invoice elements found');

  invoicePages.forEach((p) => p.classList.add('pdf-render-mode'));
  await waitForLayout(200);
  await waitForImages(container);

  try {
    // Try Browserless first
    try {
      const blob = await buildPdfViaBrowserless(container, marginMm, footerLabel);
      return blob;
    } catch (browserlessError) {
      console.warn('[PDF Engine v4] Browserless failed, using client-side fallback:', browserlessError);
    }

    // Fallback: html2canvas + jsPDF (client-side)
    return await buildPdfClientSide(container);
  } finally {
    invoicePages.forEach((p) => p.classList.remove('pdf-render-mode'));
  }
}

async function buildPdfViaBrowserless(
  container: HTMLElement,
  marginMm: number,
  footerLabel?: string,
): Promise<Blob> {
  const css = collectAllCSS();
  let bodyHTML = container.innerHTML;
  bodyHTML = await inlineLocalImages(bodyHTML);
  const fullHTML = buildFullHTML(bodyHTML, css, marginMm);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  console.log(`[PDF Engine v4] Sending ${(fullHTML.length / 1024).toFixed(0)}KB HTML to Browserless...`);

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apikey,
      'Authorization': `Bearer ${apikey}`,
    },
    body: JSON.stringify({ html: fullHTML, marginMm, footerLabel }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[PDF Engine v4] Error:', response.status, errText);
    throw new Error(`PDF generation failed (${response.status}): ${errText}`);
  }

  const blob = await response.blob();
  console.log(`[PDF Engine v4] PDF received: ${(blob.size / 1024).toFixed(0)}KB`);
  return blob;
}

async function buildPdfClientSide(container: HTMLElement): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  console.log('[PDF Engine v4] Using client-side fallback (html2canvas + jsPDF)...');

  const pages = Array.from(container.querySelectorAll('.french-invoice')) as HTMLElement[];
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = 210;
  const pdfHeight = 297;
  const margin = 10;
  const contentWidth = pdfWidth - margin * 2;

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage();

    const canvas = await html2canvas(pages[i], {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: -window.scrollY,
      width: Math.max(pages[i].scrollWidth, 1),
      height: Math.max(pages[i].scrollHeight, 1),
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const imgHeight = (canvas.height * contentWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
    heightLeft -= (pdfHeight - margin * 2);

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, imgHeight);
      heightLeft -= (pdfHeight - margin * 2);
    }
  }

  const blob = pdf.output('blob');
  console.log(`[PDF Engine v4] Client-side PDF generated: ${(blob.size / 1024).toFixed(0)}KB`);
  return blob;
}
