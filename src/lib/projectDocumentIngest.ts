import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

/**
 * Lecture locale propre à « Analyser mon projet ».
 * Règle : aucune troncature silencieuse. Tout ce qui n'est pas transmis est
 * listé dans `coverage.unreadPages` (PDF) ou fait échouer la lecture (DOCX).
 * Les extracteurs partagés (pdfIngest, docxExtractor) restent inchangés.
 */

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/** Une page avec moins de caractères utiles est considérée sans couche texte. */
export const PAGE_TEXT_MIN_CHARS = 100;
/** Au-delà, la page contient un dessin vectoriel (plan, tableau tracé). */
export const PAGE_VECTOR_OPS_MIN = 150;
export const MAX_IMAGE_PAGES_PER_DOC = 8;
export const PDF_IMAGES_BUDGET_BYTES = 12 * 1024 * 1024;
/** Taille max d'une image base64 (limite API 5 Mo − 10 %). */
export const MAX_IMAGE_BASE64 = Math.floor(5 * 1024 * 1024 * 0.9);

const PAGE_TARGET_WIDTH = 2000;
const JPEG_QUALITY = 0.8;

export type PdfPageProbe = { page: number; text: string; rasterImages: number; vectorOps: number };
export type PdfPagePlan = { page: number; sendText: boolean; needsImage: boolean };

/** Décision par page, déterministe : texte transmis s'il existe, image si la page est visuelle. */
export function planPdfPages(pages: PdfPageProbe[]): PdfPagePlan[] {
  return pages.map((p) => {
    const chars = p.text.replace(/\s+/g, '').length;
    const hasText = chars > 0;
    const visual = chars < PAGE_TEXT_MIN_CHARS || p.rasterImages > 0 || p.vectorOps >= PAGE_VECTOR_OPS_MIN;
    return { page: p.page, sendText: hasText, needsImage: visual };
  });
}

export type ProjectPdfResult = {
  text: string;
  pageImages: string[];
  coverage: { totalPages: number; textPages: number[]; imagePages: number[]; unreadPages: number[] };
};

/** Assemble texte + images à partir du plan ; les pages visuelles non rendues deviennent unreadPages. */
export function assemblePdf(
  probes: PdfPageProbe[],
  rendered: Map<number, string | null>,
): ProjectPdfResult {
  const plans = planPdfPages(probes);
  const textParts: string[] = [];
  const textPages: number[] = [], imagePages: number[] = [], unreadPages: number[] = [], pageImages: string[] = [];
  plans.forEach((pl, k) => {
    const probe = probes[k];
    if (pl.sendText) { textParts.push(`--- Page ${pl.page} ---\n${probe.text}`); textPages.push(pl.page); }
    else textParts.push(`--- Page ${pl.page} --- (aucune couche texte : contenu visuel)`);
    if (pl.needsImage) {
      const img = rendered.get(pl.page);
      if (img) { pageImages.push(img); imagePages.push(pl.page); }
      else if (!pl.sendText || probe.text.replace(/\s+/g, '').length < PAGE_TEXT_MIN_CHARS) unreadPages.push(pl.page);
      else unreadPages.push(pl.page); // page avec texte mais dessin/scan non transmis : couverture partielle
    }
  });
  return {
    text: textPages.length ? textParts.join('\n\n') : '',
    pageImages,
    coverage: { totalPages: probes.length, textPages, imagePages, unreadPages },
  };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function ingestProjectPdf(dataUrl: string): Promise<ProjectPdfResult> {
  const pdf = await pdfjsLib.getDocument({ data: dataUrlToBytes(dataUrl) }).promise;
  const OPS = (pdfjsLib as any).OPS || {};
  const rasterOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject].filter((x) => x !== undefined));
  const vectorOps = new Set([OPS.constructPath, OPS.stroke, OPS.fill, OPS.eoFill].filter((x) => x !== undefined));

  const probes: PdfPageProbe[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    let text = '';
    try { text = (await page.getTextContent()).items.map((it: any) => it.str).join(' ').trim(); } catch { text = ''; }
    let raster = 0, vector = 0;
    try {
      const ops = await page.getOperatorList();
      for (const fn of ops.fnArray) { if (rasterOps.has(fn)) raster++; else if (vectorOps.has(fn)) vector++; }
    } catch { raster = 1; } // inconnu : prudence, rendu visuel
    probes.push({ page: i, text, rasterImages: raster, vectorOps: vector });
  }

  const rendered = new Map<number, string | null>();
  let budget = PDF_IMAGES_BUDGET_BYTES, count = 0;
  for (const pl of planPdfPages(probes)) {
    if (!pl.needsImage) continue;
    if (count >= MAX_IMAGE_PAGES_PER_DOC) { rendered.set(pl.page, null); continue; }
    try {
      const page = await pdf.getPage(pl.page);
      const rot = page.rotate || 0;
      const base = page.getViewport({ scale: 1, rotation: rot });
      const viewport = page.getViewport({ scale: Math.max(1, Math.min(4, PAGE_TARGET_WIDTH / base.width)), rotation: rot });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) { rendered.set(pl.page, null); continue; }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const jpeg = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const size = jpeg.length - jpeg.indexOf(',') - 1;
      if (size > MAX_IMAGE_BASE64 || size > budget) { rendered.set(pl.page, null); continue; }
      budget -= size; count++;
      rendered.set(pl.page, jpeg);
    } catch (e) {
      console.warn('[projectIngest] rendu page', pl.page, e);
      rendered.set(pl.page, null);
    }
  }
  return assemblePdf(probes, rendered);
}

// ------------------------------------------------------------------- DOCX
const clean = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim();

/**
 * HTML mammoth → texte structuré complet, ordre du document conservé.
 * Tableaux : chaque ligne garde ses cellules et l'en-tête de son tableau.
 */
export function docxHtmlToStructuredText(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out: string[] = [];
  let tableNo = 0;
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'table') {
      tableNo++;
      const rows = Array.from(el.querySelectorAll('tr')).filter((tr) => tr.closest('table') === el);
      const grid = rows.map((tr) => Array.from(tr.children).filter((c) => /^(td|th)$/i.test(c.tagName)).map((c) => clean(c.textContent)));
      out.push(`[Tableau ${tableNo} — ${grid.length} ligne(s)]`);
      const header = grid[0] || [];
      grid.forEach((cells, r) => {
        if (r === 0) { out.push(`En-tête : | ${cells.join(' | ')} |`); return; }
        const labelled = cells.map((v, c) => (header[c] ? `${header[c]} = ${v}` : v));
        out.push(`Ligne ${r} : | ${labelled.join(' | ')} |`);
      });
      out.push(`[Fin du tableau ${tableNo}]`);
      return;
    }
    if (/^(p|h[1-6]|li)$/.test(tag)) { const t = clean(el.textContent); if (t) out.push(tag === 'li' ? `- ${t}` : t); return; }
    Array.from(el.children).forEach(walk);
  };
  Array.from(doc.body.children).forEach(walk);
  return out.join('\n');
}

/** Lecture DOCX intégrale (aucune limite de caractères). Lève une erreur si vide/illisible. */
export async function extractProjectDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  let text = '';
  try {
    text = docxHtmlToStructuredText(String((await mammoth.convertToHtml({ arrayBuffer }))?.value || ''));
  } catch (e) { console.warn('[projectIngest] DOCX html', e); }
  if (!text.trim()) {
    text = String((await mammoth.extractRawText({ arrayBuffer }))?.value || '');
  }
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new Error('Document DOCX vide ou illisible.');
  return text;
}
