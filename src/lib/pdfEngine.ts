/**
 * Universal PDF Engine v3 — Simple, stable, predictable.
 *
 * Strategy (deliberately simple):
 *   1. Collect sections in DOM order via `data-pdf-section`
 *   2. Sections BEFORE the table → placed as insecable blocks
 *   3. TABLE → only element that splits across pages (row by row)
 *   4. Sections AFTER the table = "end-block" → grouped as ONE insecable unit
 *      If end-block doesn't fit on current page → entire block moves to next page
 *   5. Annexe pages (.invoice-annexe-page) → each gets its own PDF page
 *   6. No page is ever left empty
 *
 * HTML contract:
 *   - Main document: `.french-invoice` (first one)
 *   - Sections: `[data-pdf-section="header|client|objet|table|end-block"]`
 *   - Annexes: additional `.french-invoice.invoice-annexe-page` elements
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PdfEngineOptions {
  marginMm?: number;
  sectionGapMm?: number;
  footerLabel?: string;
  scale?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

export const captureCanvas = async (element: HTMLElement, scale = 2) => {
  await waitForImages(element);
  await waitForLayout(50);

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

const validateChunkHeight = (heightPx: number, maxPagePx: number, label: string) => {
  if (heightPx > maxPagePx) {
    throw new Error(`PDF ENGINE: bloc trop grand pour tenir sur une page (${label})`);
  }
};

/**
 * Render a subset of table rows (with thead) into an off-screen clone and capture.
 */
export const renderTableChunk = async (
  sourceTable: HTMLTableElement,
  rows: HTMLTableRowElement[],
  contentWidthPx: number,
  scale = 2,
) => {
  const mount = document.createElement('div');
  mount.className = 'french-invoice pdf-render-mode';
  Object.assign(mount.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: `${Math.ceil(contentWidthPx)}px`,
    margin: '0',
    padding: '0',
    background: '#ffffff',
    boxSizing: 'border-box',
    zIndex: '-1',
  });

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
    return await captureCanvas(mount, scale);
  } finally {
    document.body.removeChild(mount);
  }
};

// ─── Internal chunk types ────────────────────────────────────────────────────

type Chunk =
  | { type: 'section'; element: HTMLElement; heightPx: number }
  | { type: 'tableRows'; sourceTable: HTMLTableElement; rows: HTMLTableRowElement[]; heightPx: number };

interface PdfPagePlan {
  chunks: Chunk[];
  usedPx: number;
}

// ─── Main Builder ────────────────────────────────────────────────────────────

export async function buildPdfFromContainer(
  container: HTMLElement,
  options: PdfEngineOptions = {},
): Promise<Blob> {
  const {
    marginMm = 10,
    sectionGapMm = 2,
    footerLabel,
    scale = 2,
  } = options;

  const allInvoicePages = Array.from(container.querySelectorAll('.french-invoice')) as HTMLElement[];
  if (allInvoicePages.length === 0) throw new Error('No .french-invoice elements found');

  const mainPage = allInvoicePages[0];
  const annexePages = allInvoicePages.filter((el) => el.classList.contains('invoice-annexe-page'));

  // Activate render mode
  allInvoicePages.forEach((p) => p.classList.add('pdf-render-mode'));
  await waitForLayout(150);

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const CONTENT_W = pdfW - marginMm * 2;
    const MAX_H = pdfH - marginMm * 2;

    // ── Measure everything ──
    const computed = window.getComputedStyle(mainPage);
    const contentWidthPx =
      mainPage.getBoundingClientRect().width -
      parseFloat(computed.paddingLeft || '0') -
      parseFloat(computed.paddingRight || '0');

    const pxPerMm = contentWidthPx / CONTENT_W;
    const maxPagePx = MAX_H * pxPerMm;
    const gapPx = sectionGapMm * pxPerMm;

    // ── Collect sections ──
    const sectionEls = Array.from(mainPage.querySelectorAll('[data-pdf-section]')) as HTMLElement[];

    const beforeTable: HTMLElement[] = [];
    const afterTable: HTMLElement[] = [];
    let tableEl: HTMLTableElement | null = null;
    let passedTable = false;

    for (const el of sectionEls) {
      const key = el.dataset.pdfSection || '';
      if (key === 'table') {
        tableEl = el as HTMLTableElement;
        passedTable = true;
        continue;
      }
      if (!passedTable) {
        beforeTable.push(el);
      } else {
        afterTable.push(el);
      }
    }

    // ── Build page plan ──
    const pages: PdfPagePlan[] = [{ chunks: [], usedPx: 0 }];
    const cur = () => pages[pages.length - 1];
    const newPage = () => { pages.push({ chunks: [], usedPx: 0 }); };
    const remaining = () => maxPagePx - cur().usedPx;
    const gap = () => (cur().chunks.length > 0 ? gapPx : 0);

    const placeBlock = (chunk: Chunk) => {
      const needed = gap() + chunk.heightPx;
      if (needed > remaining() && cur().chunks.length > 0) {
        newPage();
      }
      cur().usedPx += (cur().chunks.length > 0 ? gapPx : 0) + chunk.heightPx;
      cur().chunks.push(chunk);
    };

    // 1) Header sections
    for (const el of beforeTable) {
      validateChunkHeight(el.getBoundingClientRect().height, maxPagePx, el.dataset.pdfSection || 'section');
      placeBlock({
        type: 'section',
        element: el,
        heightPx: el.getBoundingClientRect().height,
      });
    }

    // 2) Table rows — split across pages (NO row is ever skipped)
    if (tableEl) {
      const thead = tableEl.querySelector('thead') as HTMLElement | null;
      const theadH = thead?.getBoundingClientRect().height ?? 0;
      const rows = Array.from(tableEl.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
      const totalRowCount = rows.length;
      let placedRowCount = 0;

      let ri = 0;
      while (ri < rows.length) {
        let avail = remaining() - gap();
        if (avail < theadH + 20 && cur().chunks.length > 0) {
          newPage();
          avail = maxPagePx;
        }

        const batch: HTMLTableRowElement[] = [];
        let batchH = theadH;

        while (ri < rows.length) {
          const rowH = rows[ri].getBoundingClientRect().height;
          validateChunkHeight(theadH + rowH, maxPagePx, `table-row-${ri}`);
          // Always include at least one row per batch to avoid infinite loop
          if (batchH + rowH > avail && batch.length > 0) break;
          batch.push(rows[ri]);
          batchH += rowH;
          ri++;
        }

        if (batch.length > 0) {
          placedRowCount += batch.length;
          placeBlock({
            type: 'tableRows',
            sourceTable: tableEl,
            rows: batch,
            heightPx: batchH,
          });
        }
      }

      // VALIDATION: ensure no rows were lost
      if (placedRowCount !== totalRowCount) {
        throw new Error(`PDF ENGINE: Row count mismatch! Expected ${totalRowCount}, placed ${placedRowCount}`);
      }
    }

    // 3) End-block (totaux + conditions + signature + IBAN) — insecable group
    if (afterTable.length > 0) {
      // Measure each element's ACTUAL rendered height (excluding CSS margins to avoid double-counting)
      const endHeights = afterTable.map(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const marginTop = parseFloat(style.marginTop || '0');
        const marginBottom = parseFloat(style.marginBottom || '0');
        return rect.height + marginTop + marginBottom;
      });
      const totalEndH = endHeights.reduce((s, h) => s + h, 0) + gapPx * Math.max(0, afterTable.length - 1);

      // Only break if end-block genuinely cannot fit on current page
      const currentGap = cur().chunks.length > 0 ? gapPx : 0;
      const availableSpace = remaining() - currentGap;

      if (totalEndH > availableSpace && cur().chunks.length > 0) {
        // Double-check: would a fresh page even help? (avoid infinite loop edge case)
        if (totalEndH <= maxPagePx) {
          newPage();
        }
      }

      for (const el of afterTable) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const marginTop = parseFloat(style.marginTop || '0');
        const marginBottom = parseFloat(style.marginBottom || '0');
        const chunk: Chunk = {
          type: 'section',
          element: el,
          heightPx: rect.height + marginTop + marginBottom,
        };
        cur().usedPx += (cur().chunks.length > 0 ? gapPx : 0) + chunk.heightPx;
        cur().chunks.push(chunk);
      }
    }

    // Remove empty pages
    const cleanPages = pages.filter((p) => p.chunks.length > 0);

    // ── Render to PDF ──
    const renderChunk = async (chunk: Chunk): Promise<HTMLCanvasElement> => {
      if (chunk.type === 'tableRows') {
        return renderTableChunk(chunk.sourceTable, chunk.rows, contentWidthPx, scale);
      }
      return captureCanvas(chunk.element, scale);
    };

    for (let pi = 0; pi < cleanPages.length; pi++) {
      if (pi > 0) pdf.addPage();
      let y = marginMm;

      for (let ci = 0; ci < cleanPages[pi].chunks.length; ci++) {
        const canvas = await renderChunk(cleanPages[pi].chunks[ci]);
        const hMm = (canvas.height * CONTENT_W) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', marginMm, y, CONTENT_W, hMm);
        y += hMm + (ci < cleanPages[pi].chunks.length - 1 ? sectionGapMm : 0);
      }
    }

    // ── Annexe pages (full-page capture) ──
    for (const annexe of annexePages) {
      pdf.addPage();
      const canvas = await captureCanvas(annexe, scale);
      const rawH = (canvas.height * CONTENT_W) / canvas.width;
      const fitH = Math.min(rawH, MAX_H);
      const fitW = rawH > MAX_H ? CONTENT_W * (MAX_H / rawH) : CONTENT_W;
      const xOff = marginMm + (CONTENT_W - fitW) / 2;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', xOff, marginMm, fitW, fitH);
    }

    // ── Footer labels ──
    if (footerLabel) {
      const total = pdf.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        const text = `${footerLabel} — Page ${p} / ${total}`;
        const tw = pdf.getTextWidth(text);
        pdf.text(text, (pdfW - tw) / 2, pdfH - 6);
      }
    }

    return pdf.output('blob');
  } finally {
    allInvoicePages.forEach((p) => p.classList.remove('pdf-render-mode'));
  }
}
