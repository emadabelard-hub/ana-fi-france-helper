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
 * Convert blob: and relative image URLs to base64 data URIs.
 * Absolute https:// URLs are left as-is (Browserless can fetch them).
 */
async function inlineLocalImages(html: string): Promise<string> {
  const imgRegex = /<img[^>]+src="([^"]+)"/g;
  const replacements: Array<{ original: string; replacement: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    // Skip data: (already inline) and absolute URLs (Browserless can fetch)
    if (url.startsWith('data:') || url.startsWith('https://') || url.startsWith('http://')) {
      continue;
    }
    // Convert blob: or relative URLs to base64
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      replacements.push({ original: url, replacement: dataUrl });
    } catch (_e) {
      // Skip failed images silently
    }
  }

  let result = html;
  for (const { original, replacement } of replacements) {
    result = result.split(original).join(replacement);
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

html, body {
  margin: 0 !important;
  padding: 0 !important;
  background: white !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

/* End-block: totals + conditions + signature + IBAN — NEVER split */
[data-pdf-section="end-block"] {
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
    // 1. Collect all compiled CSS from the document
    const css = collectAllCSS();

    // 2. Serialize the container HTML and inline local images
    let bodyHTML = container.innerHTML;
    bodyHTML = await inlineLocalImages(bodyHTML);

    // 3. Build a complete standalone HTML document
    const fullHTML = buildFullHTML(bodyHTML, css, marginMm);

    // 4. Send to Edge Function → Browserless (headless Chrome)
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
      body: JSON.stringify({
        html: fullHTML,
        marginMm,
        footerLabel,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[PDF Engine v4] Error:', response.status, errText);
      throw new Error(`PDF generation failed (${response.status}): ${errText}`);
    }

    const blob = await response.blob();
    console.log(`[PDF Engine v4] PDF received: ${(blob.size / 1024).toFixed(0)}KB`);
    return blob;
  } finally {
    invoicePages.forEach((p) => p.classList.remove('pdf-render-mode'));
  }
}
