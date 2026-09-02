import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * TEST ISOLÉ — découpage d'UNE page PDF en 4 zones avec chevauchement.
 * Ce module n'est utilisé QUE par la page de test /dev/zone-vision-test.
 * Il ne touche ni pdfIngest.ts, ni le parcours normal de l'Assistant IA.
 */

// Longueur cible du plus grand côté de CHAQUE zone : ~1560 px, juste sous la
// limite de redimensionnement automatique d'Anthropic (~1568 px), afin qu'aucune
// zone ne soit réduite côté modèle.
const ZONE_TARGET_LONG_EDGE = 1560;
const OVERLAP_RATIO = 0.08; // 8 % de chevauchement (dans la plage 5–10 %)
const ZONE_JPEG_QUALITY = 0.92;
const MAX_RENDER_SCALE = 8;

export type ZoneLabel =
  | 'HAUT GAUCHE'
  | 'HAUT DROITE'
  | 'BAS GAUCHE'
  | 'BAS DROITE';

export type PdfZone = {
  index: 1 | 2 | 3 | 4;
  label: ZoneLabel;
  dataUrl: string;
  width: number;
  height: number;
  approxBytes: number;
};

export type PdfZoneSplitResult = {
  pageNumber: number;
  pageCount: number;
  renderScale: number;
  pageWidth: number;
  pageHeight: number;
  overlapRatio: number;
  jpegQuality: number;
  zones: PdfZone[];
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function approxBytes(dataUrl: string): number {
  const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Rend UNE seule page en haute définition puis la découpe en 4 zones égales
 * (haut gauche, haut droite, bas gauche, bas droite) avec chevauchement.
 */
export async function splitPdfPageIntoZones(
  dataUrl: string,
  pageNumber = 1,
): Promise<PdfZoneSplitResult> {
  const pdf = await pdfjsLib.getDocument({ data: dataUrlToBytes(dataUrl) }).promise;
  const safePage = Math.min(Math.max(1, pageNumber), pdf.numPages);
  const page = await pdf.getPage(safePage);
  const nativeRotation = page.rotate || 0;

  const base = page.getViewport({ scale: 1, rotation: nativeRotation });
  const baseLongEdge = Math.max(base.width, base.height);
  // Chaque zone couvre (0.5 + overlap/2) de la page => on dimensionne la page
  // pour que la zone atteigne ZONE_TARGET_LONG_EDGE.
  const zoneCoverage = 0.5 + OVERLAP_RATIO / 2;
  const targetPageLongEdge = ZONE_TARGET_LONG_EDGE / zoneCoverage;
  const renderScale = Math.min(MAX_RENDER_SCALE, Math.max(1, targetPageLongEdge / baseLongEdge));

  const viewport = page.getViewport({ scale: renderScale, rotation: nativeRotation });
  console.log('[zone-test] page:', safePage, '| rotation native:', nativeRotation, '| viewport:', Math.round(viewport.width), 'x', Math.round(viewport.height), '| orientation:', viewport.width > viewport.height ? 'paysage' : 'portrait');
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = Math.round(viewport.width);
  pageCanvas.height = Math.round(viewport.height);
  const pctx = pageCanvas.getContext('2d');
  if (!pctx) throw new Error('canvas_context_unavailable');
  pctx.fillStyle = '#ffffff';
  pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
  await page.render({ canvasContext: pctx, viewport }).promise;

  const W = pageCanvas.width;
  const H = pageCanvas.height;
  const zw = Math.round(W * zoneCoverage);
  const zh = Math.round(H * zoneCoverage);

  const specs: Array<{ index: 1 | 2 | 3 | 4; label: ZoneLabel; x: number; y: number }> = [
    { index: 1, label: 'HAUT GAUCHE', x: 0, y: 0 },
    { index: 2, label: 'HAUT DROITE', x: W - zw, y: 0 },
    { index: 3, label: 'BAS GAUCHE', x: 0, y: H - zh },
    { index: 4, label: 'BAS DROITE', x: W - zw, y: H - zh },
  ];

  const zones: PdfZone[] = [];
  for (const s of specs) {
    const c = document.createElement('canvas');
    c.width = zw;
    c.height = zh;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('canvas_context_unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, zw, zh);
    ctx.drawImage(pageCanvas, s.x, s.y, zw, zh, 0, 0, zw, zh);
    const url = c.toDataURL('image/jpeg', ZONE_JPEG_QUALITY);
    zones.push({
      index: s.index,
      label: s.label,
      dataUrl: url,
      width: zw,
      height: zh,
      approxBytes: approxBytes(url),
    });
  }

  return {
    pageNumber: safePage,
    pageCount: pdf.numPages,
    renderScale: Math.round(renderScale * 100) / 100,
    pageWidth: W,
    pageHeight: H,
    overlapRatio: OVERLAP_RATIO,
    jpegQuality: ZONE_JPEG_QUALITY,
    zones,
  };
}
