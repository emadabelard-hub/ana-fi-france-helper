/**
 * Universal PDF Engine — Stable, reusable PDF generation for devis, factures, CV, etc.
 *
 * Architecture:
 *   1. HTML sections annotated with `data-pdf-section="<key>"`
 *   2. Sections collected in DOM order, flowed top-to-bottom
 *   3. Tables split by rows (only dynamic element)
 *   4. End-block (totaux+conditions+signature+IBAN) is insecable
 *   5. No page is EVER left empty
 *   6. Annexes always start on a new page
 *   7. Footer integrated in flow, never absolute
 *
 * Usage:
 *   import { buildPdfFromContainer } from '@/lib/pdfEngine';
 *   const blob = await buildPdfFromContainer(containerEl, { footerLabel: 'Devis n° D-001' });
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PdfChunk =
  | { kind: 'section'; key: string; element: HTMLElement; heightPx: number }
  | { kind: 'table'; key: string; sourceTable: HTMLTableElement; rows: HTMLTableRowElement[]; heightPx: number };

export interface PdfPage {
  chunks: PdfChunk[];
  usedPx: number;
}

export interface PdfEngineOptions {
  marginMm?: number;
  sectionGapMm?: number;
  footerLabel?: string;
  scale?: number;
  renderModeClass?: string;
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

export const waitForLayout = (delay = 80) => new Promise((resolve) => setTimeout(resolve, delay));

export const captureCanvas = async (element: HTMLElement, scale = 2) => {
  await waitForImages(element);
  await waitForLayout();

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

// ─── Page Planning ───────────────────────────────────────────────────────────

/**
 * Natural-flow page planner with strict rules:
 * - Table rows split across pages (only dynamic element)
 * - All other sections are insecable blocks
 * - End-block checked BEFORE placement: if not enough space → new page BEFORE
 * - No page is ever left empty
 */
export function createPagePlan(
  mainPage: HTMLElement,
  contentWidthMm: number,
  maxContentHeightMm: number,
  sectionGapMm: number,
): { pages: PdfPage[]; contentWidthPx: number } {
  const computed = window.getComputedStyle(mainPage);
  const contentWidthPx =
    mainPage.getBoundingClientRect().width -
    parseFloat(computed.paddingLeft || '0') -
    parseFloat(computed.paddingRight || '0');

  const pxPerMm = contentWidthPx / contentWidthMm;
  const maxPagePx = maxContentHeightMm * pxPerMm;
  const gapPx = sectionGapMm * pxPerMm;

  const sectionElements = Array.from(mainPage.querySelectorAll('[data-pdf-section]')) as HTMLElement[];
  const tableElement = sectionElements.find((el) => el.dataset.pdfSection === 'table') as HTMLTableElement | undefined;

  // Separate sections into: before-table, table, after-table
  const beforeTable: HTMLElement[] = [];
  const afterTable: HTMLElement[] = [];
  let foundTable = false;

  for (const el of sectionElements) {
    const key = el.dataset.pdfSection || '';
    if (key === 'table') {
      foundTable = true;
      continue;
    }
    if (!foundTable) {
      beforeTable.push(el);
    } else {
      afterTable.push(el);
    }
  }

  const pages: PdfPage[] = [{ chunks: [], usedPx: 0 }];
  const currentPage = () => pages[pages.length - 1];
  const startNewPage = () => pages.push({ chunks: [], usedPx: 0 });

  const getRemainingPx = () => maxPagePx - currentPage().usedPx;
  const getGapPx = () => (currentPage().chunks.length > 0 ? gapPx : 0);

  const placeChunk = (chunk: PdfChunk) => {
    const gap = getGapPx();
    const needed = gap + chunk.heightPx;
    const remaining = getRemainingPx();

    // If doesn't fit and page is not empty → new page
    if (needed > remaining && currentPage().chunks.length > 0) {
      startNewPage();
    }

    const page = currentPage();
    const actualGap = page.chunks.length > 0 ? gapPx : 0;
    page.usedPx += actualGap + chunk.heightPx;
    page.chunks.push(chunk);
  };

  // ── Place header sections (before table) ──
  for (const section of beforeTable) {
    placeChunk({
      kind: 'section',
      key: section.dataset.pdfSection || 'section',
      element: section,
      heightPx: section.getBoundingClientRect().height,
    });
  }

  // ── Place table rows ──
  if (tableElement) {
    const tableHead = tableElement.querySelector('thead') as HTMLElement | null;
    const tableHeaderHeightPx = tableHead?.getBoundingClientRect().height ?? 0;
    const allRows = Array.from(tableElement.querySelectorAll('tbody tr')) as HTMLTableRowElement[];

    let rowIndex = 0;
    let chunkIndex = 0;

    while (rowIndex < allRows.length) {
      let availablePx = getRemainingPx() - getGapPx();

      // If not enough room even for header + 1 row, start new page
      if (availablePx <= tableHeaderHeightPx && currentPage().chunks.length > 0) {
        startNewPage();
        availablePx = maxPagePx;
      }

      const chunkRows: HTMLTableRowElement[] = [];
      let chunkHeightPx = tableHeaderHeightPx;

      while (rowIndex < allRows.length) {
        const row = allRows[rowIndex];
        const rowHeight = row.getBoundingClientRect().height;
        const projected = chunkHeightPx + rowHeight;

        // Always include at least 1 row per chunk
        if (projected <= availablePx || chunkRows.length === 0) {
          chunkRows.push(row);
          chunkHeightPx = projected;
          rowIndex += 1;
        } else {
          break;
        }
      }

      placeChunk({
        kind: 'table',
        key: `table-${chunkIndex}`,
        sourceTable: tableElement,
        rows: chunkRows,
        heightPx: chunkHeightPx,
      });
      chunkIndex += 1;
    }
  }

  // ── Place end-block sections (after table) ──
  // These are critical blocks: if they don't fit, they go to next page together
  // First, calculate total height of all after-table sections
  const afterChunks: PdfChunk[] = afterTable.map((section) => ({
    kind: 'section' as const,
    key: section.dataset.pdfSection || 'section',
    element: section,
    heightPx: section.getBoundingClientRect().height,
  }));

  // Check if ALL end-block sections fit on current page
  const totalEndBlockHeight = afterChunks.reduce(
    (sum, c) => sum + c.heightPx + gapPx, 0
  );

  const remainingBeforeEnd = getRemainingPx() - getGapPx();

  // If end-block doesn't fit AND page has content → new page before end-block
  if (totalEndBlockHeight > remainingBeforeEnd && currentPage().chunks.length > 0) {
    startNewPage();
  }

  // Now place each end-block chunk
  for (const chunk of afterChunks) {
    placeChunk(chunk);
  }

  // Clean: remove empty pages
  const cleanPages = pages.filter((p) => p.chunks.length > 0);
  return { pages: cleanPages.length > 0 ? cleanPages : pages, contentWidthPx };
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
    renderModeClass = 'pdf-render-mode',
  } = options;

  const allPages = Array.from(container.querySelectorAll('.french-invoice')) as HTMLElement[];
  if (allPages.length === 0) throw new Error('No .french-invoice elements found');

  // Activate render mode
  allPages.forEach((p) => p.classList.add(renderModeClass));
  await waitForLayout(150);

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const CONTENT_WIDTH = pdfWidth - marginMm * 2;
    const MAX_CONTENT_HEIGHT = pdfHeight - marginMm * 2;

    // ── Plan and render main page (first .french-invoice) ──
    const mainPage = allPages[0];
    const { pages, contentWidthPx } = createPagePlan(mainPage, CONTENT_WIDTH, MAX_CONTENT_HEIGHT, sectionGapMm);

    const renderChunk = async (chunk: PdfChunk) => {
      if (chunk.kind === 'table') {
        return renderTableChunk(chunk.sourceTable, chunk.rows, contentWidthPx, scale);
      }
      return captureCanvas(chunk.element, scale);
    };

    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      if (pageIndex > 0) pdf.addPage();

      let currentY = marginMm;
      const pageChunks = pages[pageIndex].chunks;

      for (let ci = 0; ci < pageChunks.length; ci++) {
        const chunk = pageChunks[ci];
        const canvas = await renderChunk(chunk);
        const heightMm = (canvas.height * CONTENT_WIDTH) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', marginMm, currentY, CONTENT_WIDTH, heightMm);
        currentY += heightMm + (ci < pageChunks.length - 1 ? sectionGapMm : 0);
      }
    }

    // ── Render annexe pages (full-page captures) ──
    for (let i = 1; i < allPages.length; i++) {
      pdf.addPage();
      const annexePage = allPages[i];
      const canvas = await captureCanvas(annexePage, scale);
      const rawHeightMm = (canvas.height * CONTENT_WIDTH) / canvas.width;
      const fittedHeightMm = Math.min(rawHeightMm, MAX_CONTENT_HEIGHT);
      const fittedWidthMm = rawHeightMm > MAX_CONTENT_HEIGHT
        ? CONTENT_WIDTH * (MAX_CONTENT_HEIGHT / rawHeightMm)
        : CONTENT_WIDTH;
      const xOffset = marginMm + (CONTENT_WIDTH - fittedWidthMm) / 2;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', xOffset, marginMm, fittedWidthMm, fittedHeightMm);
    }

    // ── Page footer labels ──
    if (footerLabel) {
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        const text = `${footerLabel} — Page ${p} / ${totalPages}`;
        const tw = pdf.getTextWidth(text);
        pdf.text(text, (pdfWidth - tw) / 2, pdfHeight - 6);
      }
    }

    return pdf.output('blob');
  } finally {
    allPages.forEach((p) => p.classList.remove(renderModeClass));
  }
}
