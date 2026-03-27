/**
 * Universal PDF Engine — Stable, reusable PDF generation for devis, factures, CV, etc.
 *
 * Architecture:
 *   1. HTML sections are annotated with `data-pdf-section="<key>"` attributes
 *   2. The engine collects sections in DOM order and plans pages top-to-bottom
 *   3. Tables are automatically chunked by rows to fit available space
 *   4. Critical blocks (totaux, signature, conditions, paiement) are insecable
 *   5. No page is ever left empty
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
  /** Margin in mm (default 10) */
  marginMm?: number;
  /** Gap between sections in mm (default 2) */
  sectionGapMm?: number;
  /** Footer label e.g. "Devis n° D-001" (optional) */
  footerLabel?: string;
  /** html2canvas scale (default 2) */
  scale?: number;
  /** CSS class added to container during render (default 'pdf-render-mode') */
  renderModeClass?: string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

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
 * Natural-flow page planner.
 * Content flows top-to-bottom. Tables are split by rows.
 * Non-table sections are insecable blocks — if they don't fit, they move to the next page.
 * No page is left empty.
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

  const pages: PdfPage[] = [{ chunks: [], usedPx: 0 }];
  const currentPage = () => pages[pages.length - 1];
  const startNewPage = () => pages.push({ chunks: [], usedPx: 0 });

  const addChunk = (chunk: PdfChunk) => {
    let page = currentPage();
    const gap = page.chunks.length > 0 ? gapPx : 0;
    const needed = gap + chunk.heightPx;
    const remaining = maxPagePx - page.usedPx;

    if (needed > remaining && page.chunks.length > 0) {
      startNewPage();
      page = currentPage();
    }
    page.usedPx += (page.chunks.length > 0 ? gapPx : 0) + chunk.heightPx;
    page.chunks.push(chunk);
  };

  for (const section of sectionElements) {
    const key = section.dataset.pdfSection || 'section';

    if (key === 'table' && tableElement) {
      const tableHead = tableElement.querySelector('thead') as HTMLElement | null;
      const tableHeaderHeightPx = tableHead?.getBoundingClientRect().height ?? 0;
      const allRows = Array.from(tableElement.querySelectorAll('tbody tr')) as HTMLTableRowElement[];

      let rowIndex = 0;
      let chunkIndex = 0;

      while (rowIndex < allRows.length) {
        let page = currentPage();
        let availablePx = maxPagePx - page.usedPx - (page.chunks.length > 0 ? gapPx : 0);

        if (availablePx <= tableHeaderHeightPx && page.chunks.length > 0) {
          startNewPage();
          page = currentPage();
          availablePx = maxPagePx;
        }

        const chunkRows: HTMLTableRowElement[] = [];
        let chunkHeightPx = tableHeaderHeightPx;

        while (rowIndex < allRows.length) {
          const row = allRows[rowIndex];
          const rowHeight = row.getBoundingClientRect().height;
          const projected = chunkHeightPx + rowHeight;

          if (projected <= availablePx || chunkRows.length === 0) {
            chunkRows.push(row);
            chunkHeightPx = projected;
            rowIndex += 1;
          } else {
            break;
          }
        }

        addChunk({
          kind: 'table',
          key: `table-${chunkIndex}`,
          sourceTable: tableElement,
          rows: chunkRows,
          heightPx: chunkHeightPx,
        });
        chunkIndex += 1;
      }
    } else if (key !== 'table') {
      addChunk({
        kind: 'section',
        key,
        element: section,
        heightPx: section.getBoundingClientRect().height,
      });
    }
  }

  const cleanPages = pages.filter((p) => p.chunks.length > 0);
  return { pages: cleanPages.length > 0 ? cleanPages : pages, contentWidthPx };
}

// ─── Main Builder ────────────────────────────────────────────────────────────

/**
 * Build a PDF blob from a container element.
 * The container should have one or more `.french-invoice` pages inside.
 * The first page is paginated via the block planner; subsequent pages are annexes.
 */
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

    // Plan and render main page
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
      for (let ci = 0; ci < pages[pageIndex].chunks.length; ci++) {
        const chunk = pages[pageIndex].chunks[ci];
        const canvas = await renderChunk(chunk);
        const heightMm = (canvas.height * CONTENT_WIDTH) / canvas.width;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', marginMm, currentY, CONTENT_WIDTH, heightMm);
        currentY += heightMm + (ci < pages[pageIndex].chunks.length - 1 ? sectionGapMm : 0);
      }
    }

    // Render annexe pages (full-page captures)
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

    // Add page footer
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
