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

export type PdfPageProbe = { page: number; text: string; rasterImages: number; vectorOps: number; columnsSuspected?: boolean };

export type PdfTextItem = { str: string; transform: number[]; width?: number; height?: number };

/**
 * Reconstruit des lignes à partir des positions (au lieu de joindre tous les mots).
 * Les grands écarts horizontaux sont rendus par « ‖ » : colonnes possibles,
 * signalées, jamais réordonnées par conjecture.
 */
export function pdfItemsToLines(items: PdfTextItem[]): { text: string; columnsSuspected: boolean } {
  const rows: { y: number; parts: { x: number; end: number; str: string; h: number }[] }[] = [];
  for (const it of items) {
    if (!it || typeof it.str !== 'string' || !it.str.trim() || !Array.isArray(it.transform)) continue;
    const x = it.transform[4] ?? 0, y = it.transform[5] ?? 0;
    const h = Math.abs(it.height || it.transform[3] || 10) || 10;
    const row = rows.find((r) => Math.abs(r.y - y) <= h * 0.5);
    const part = { x, end: x + (it.width ?? it.str.length * h * 0.5), str: it.str, h };
    if (row) row.parts.push(part); else rows.push({ y, parts: [part] });
  }
  rows.sort((a, b) => b.y - a.y);
  let wideGaps = 0;
  const lines = rows.map((r) => {
    r.parts.sort((a, b) => a.x - b.x);
    let line = '';
    r.parts.forEach((p, k) => {
      if (k === 0) { line = p.str; return; }
      const gap = p.x - r.parts[k - 1].end;
      if (gap > p.h * 3) { line += ' ‖ '; wideGaps++; } else line += gap > p.h * 0.15 ? ' ' : '';
      line += p.str;
    });
    return line.replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
  return { text: lines.join('\n'), columnsSuspected: wideGaps >= 3 };
}
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
  coverage: { totalPages: number; textPages: number[]; imagePages: number[]; unreadPages: number[]; structureIssues?: string[] };
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
      else unreadPages.push(pl.page); // contenu visuel non transmis : couverture partielle, signalée
    }
  });
  const structureIssues = probes.filter((p) => p.columnsSuspected).map((p) => `page_${p.page}_columns_possible`);
  return {
    text: textPages.length ? textParts.join('\n\n') : '',
    pageImages,
    coverage: { totalPages: probes.length, textPages, imagePages, unreadPages, ...(structureIssues.length ? { structureIssues } : {}) },
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
    let text = '', columnsSuspected = false;
    try { const l = pdfItemsToLines((await page.getTextContent()).items as PdfTextItem[]); text = l.text; columnsSuspected = l.columnsSuspected; } catch { text = ''; }
    let raster = 0, vector = 0;
    try {
      const ops = await page.getOperatorList();
      for (const fn of ops.fnArray) { if (rasterOps.has(fn)) raster++; else if (vectorOps.has(fn)) vector++; }
    } catch { raster = 1; } // inconnu : prudence, rendu visuel
    probes.push({ page: i, text, rasterImages: raster, vectorOps: vector, columnsSuspected });
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

export type DocxStructure = {
  text: string;
  /** Images incorporées transmises (data URL), dans l'ordre du document. */
  images: string[];
  coverage: {
    /** Images incorporées trouvées dans le document. */
    mediaTotal: number;
    /** Images incorporées non transmises (format/taille/budget) : couverture partielle. */
    untransmittedMedia: number;
    /** Structures signalées comme ambiguës (jamais résolues par conjecture). */
    structureIssues: string[];
  };
};

const SENDABLE_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,/i;

/**
 * HTML mammoth → texte structuré complet, ordre du document conservé.
 * - En-tête : uniquement si la ligne est explicitement marquée (cellules <th>) ;
 *   la première ligne n'est jamais supposée être un en-tête.
 * - Fusions : colspan/rowspan signalés, aucune valeur recopiée dans les cellules couvertes.
 * - Images : chaque image est repérée à sa place ; transmise dans la limite des
 *   budgets existants, sinon signalée comme non transmise.
 */
export function docxHtmlToStructure(html: string): DocxStructure {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out: string[] = [];
  const images: string[] = [];
  const issues: string[] = [];
  let tableNo = 0, mediaTotal = 0, untransmitted = 0, budget = PDF_IMAGES_BUDGET_BYTES;
  const media = (img: Element) => {
    mediaTotal++;
    const src = img.getAttribute('src') || '';
    const size = src.length - src.indexOf(',') - 1;
    const alt = clean(img.getAttribute('alt'));
    if (SENDABLE_IMAGE.test(src) && images.length < MAX_IMAGE_PAGES_PER_DOC && size <= MAX_IMAGE_BASE64 && size <= budget) {
      images.push(src); budget -= size;
      out.push(`[Image ${mediaTotal} du document Word — transmise en pièce jointe n°${images.length}${alt ? ` — texte alternatif : ${alt}` : ''}]`);
    } else {
      untransmitted++;
      const why = !SENDABLE_IMAGE.test(src) ? 'format non transmissible' : images.length >= MAX_IMAGE_PAGES_PER_DOC ? "limite d'images atteinte" : 'taille ou budget dépassé';
      out.push(`[Image ${mediaTotal} du document Word — NON TRANSMISE (${why}) : contenu non lu]`);
    }
  };
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') { media(el); return; }
    if (tag === 'table') {
      tableNo++;
      const rows = Array.from(el.querySelectorAll('tr')).filter((tr) => tr.closest('table') === el);
      out.push(`[Tableau ${tableNo} — ${rows.length} ligne(s)]`);
      let vertical = false, nested = false;
      let explicitHeader: string[] | null = null;
      let dataRow = 0;
      rows.forEach((tr) => {
        const cells = Array.from(tr.children).filter((c) => /^(td|th)$/i.test(c.tagName));
        const header = cells.length > 0 && cells.every((c) => c.tagName.toLowerCase() === 'th');
        const parts = cells.map((c) => {
          if (c.querySelector('table')) nested = true;
          c.querySelectorAll('img').forEach(media);
          const span = Number(c.getAttribute('colspan') || '1');
          const rs = Number(c.getAttribute('rowspan') || '1');
          if (rs > 1) vertical = true;
          const v = clean(c.textContent);
          return `${v}${span > 1 ? ` (fusion horizontale ×${span})` : ''}${rs > 1 ? ` (fusion verticale ×${rs})` : ''}`;
        });
        if (header) { explicitHeader = cells.map((c) => clean(c.textContent)); out.push(`En-tête explicite : | ${parts.join(' | ')} |`); return; }
        dataRow++;
        const labelled = explicitHeader ? parts.map((v, c) => (explicitHeader![c] ? `${explicitHeader![c]} = ${v}` : v)) : parts;
        out.push(`Ligne ${dataRow} : | ${labelled.join(' | ')} |`);
      });
      if (!explicitHeader && rows.length > 0) out.push(`[Tableau ${tableNo} : aucun en-tête marqué — aucune ligne n'est interprétée comme en-tête]`);
      if (vertical) { issues.push(`table_${tableNo}_vertical_merge`); out.push(`[Tableau ${tableNo} : cellules fusionnées verticalement — l'alignement des colonnes des lignes suivantes est à vérifier]`); }
      if (nested) issues.push(`table_${tableNo}_nested_table`);
      out.push(`[Fin du tableau ${tableNo}]`);
      return;
    }
    if (/^(p|h[1-6]|li)$/.test(tag)) {
      const t = clean(el.textContent);
      if (t) out.push(tag === 'li' ? `- ${t}` : t);
      el.querySelectorAll('img').forEach(media);
      return;
    }
    Array.from(el.children).forEach(walk);
  };
  Array.from(doc.body.children).forEach(walk);
  return { text: out.join('\n'), images, coverage: { mediaTotal, untransmittedMedia: untransmitted, structureIssues: issues } };
}

/** Compatibilité : texte structuré seul. */
export function docxHtmlToStructuredText(html: string): string {
  return docxHtmlToStructure(html).text;
}

/** Lecture DOCX intégrale (aucune limite de caractères). Lève une erreur si vide/illisible. */
export async function extractProjectDocxStructured(file: File): Promise<DocxStructure> {
  const arrayBuffer = await file.arrayBuffer();
  let res: DocxStructure | null = null;
  try {
    res = docxHtmlToStructure(String((await mammoth.convertToHtml({ arrayBuffer }))?.value || ''));
  } catch (e) { console.warn('[projectIngest] DOCX html', e); }
  if (!res || !res.text.trim()) {
    // Repli texte brut : structure perdue, signalée (jamais un succès silencieux).
    const raw = String((await mammoth.extractRawText({ arrayBuffer }))?.value || '');
    res = { text: raw, images: [], coverage: { mediaTotal: res?.coverage.mediaTotal ?? 0, untransmittedMedia: res?.coverage.untransmittedMedia ?? 0, structureIssues: ['raw_text_fallback_structure_lost'] } };
  }
  const text = res.text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text && res.images.length === 0) throw new Error('Document DOCX vide ou illisible.');
  return { ...res, text };
}

export async function extractProjectDocx(file: File): Promise<string> {
  return (await extractProjectDocxStructured(file)).text;
}
