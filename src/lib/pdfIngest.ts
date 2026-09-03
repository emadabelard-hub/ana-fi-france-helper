import * as pdfjsLib from 'pdfjs-dist';

// Le worker est déjà configuré par pdfExtractor, on le (re)configure ici pour
// que ce module reste utilisable indépendamment.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Limites d'ingestion : suffisantes pour lire un plan, sans dépasser la taille
// de requête acceptable pour l'Edge Function.
const MAX_RENDERED_PAGES = 8;
const PAGE_TARGET_WIDTH = 2800; // px — cotes de plan restent lisibles
const PAGE_JPEG_QUALITY = 0.82;
const PAGE_IMAGES_BUDGET_BYTES = 7 * 1024 * 1024;
const TEXT_LAYER_MIN_CHARS = 200; // en-dessous : PDF considéré non textuel

export type PdfTextStatus = 'text_layer' | 'empty' | 'failed';

export type PdfIngestResult = {
  /** Texte de la couche texte (jamais tronqué ici). */
  text: string;
  textStatus: PdfTextStatus;
  pageCount: number;
  /** Images JPEG (data URL) des pages rendues, uniquement si nécessaire. */
  pageImages: string[];
  pagesRendered: number;
  pagesSkipped: number;
};

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
}

/** Taille approximative en octets d'une chaîne base64. */
function base64Bytes(b64: string): number {
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Ingestion complète d'un PDF côté client :
 * - extraction de la couche texte ;
 * - rendu des pages en images lorsque la couche texte est vide/insuffisante
 *   (PDF scanné, plan vectoriel, permis de construire graphique).
 * Le binaire original n'est jamais abandonné par cette fonction.
 */
export async function ingestPdf(dataUrl: string): Promise<PdfIngestResult> {
  const result: PdfIngestResult = {
    text: '',
    textStatus: 'failed',
    pageCount: 0,
    pageImages: [],
    pagesRendered: 0,
    pagesSkipped: 0,
  };

  let pdf: any;
  try {
    pdf = await pdfjsLib.getDocument({ data: dataUrlToBytes(dataUrl) }).promise;
  } catch (e) {
    console.warn('[pdfIngest] ouverture impossible', e);
    return result;
  }

  result.pageCount = pdf.numPages;

  // 1) Couche texte
  try {
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((it: any) => it.str).join(' ');
      if (pageText.trim()) parts.push(`--- Page ${i} ---\n${pageText}`);
    }
    result.text = parts.join('\n\n');
    result.textStatus = result.text.trim().length >= TEXT_LAYER_MIN_CHARS ? 'text_layer' : 'empty';
  } catch (e) {
    console.warn('[pdfIngest] extraction texte échouée', e);
    result.textStatus = 'failed';
  }

  // 2) Rendu image des pages — TOUJOURS effectué, y compris lorsque la couche
  // texte est exploitable : un PDF de plans contient des dessins, cotes et
  // annotations invisibles dans la couche texte, et le repli Gemini n'a que
  // ces images pour « voir » le document.
  {
    let budget = PAGE_IMAGES_BUDGET_BYTES;
    const pagesToRender = Math.min(pdf.numPages, MAX_RENDERED_PAGES);
    result.pagesSkipped = Math.max(0, pdf.numPages - pagesToRender);

    for (let i = 1; i <= pagesToRender; i++) {
      try {
        const page = await pdf.getPage(i);
        const nativeRotation = page.rotate || 0;
        const base = page.getViewport({ scale: 1, rotation: nativeRotation });
        const scale = Math.max(1, Math.min(5, PAGE_TARGET_WIDTH / base.width));
        const viewport = page.getViewport({ scale, rotation: nativeRotation });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const jpeg = canvas.toDataURL('image/jpeg', PAGE_JPEG_QUALITY);
        const size = base64Bytes(dataUrlToBase64(jpeg));
        if (size > budget) {
          result.pagesSkipped += pagesToRender - i + 1;
          break;
        }
        budget -= size;
        result.pageImages.push(jpeg);
        result.pagesRendered += 1;
      } catch (e) {
        console.warn('[pdfIngest] rendu page échoué', i, e);
        result.pagesSkipped += 1;
      }
    }
  }

  return result;
}

export type ImageIngestResult = {
  dataUrl: string;
  width: number;
  height: number;
  compressed: boolean;
  lowResolution: boolean;
};

const IMAGE_MAX_DIM = 2200; // conserve les cotes et petits textes des plans
const IMAGE_QUALITY = 0.88;
const IMAGE_LOW_RES_DIM = 700; // en dessous : lecture partielle probable

/**
 * Compression prudente d'une image : réduction uniquement au-delà de 2200 px,
 * ratio conservé, qualité élevée. Signale une image trop petite à la source.
 */
export async function ingestImage(dataUrl: string): Promise<ImageIngestResult> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image_load_failed'));
    el.src = dataUrl;
  }).catch(() => null);

  if (!img) {
    return { dataUrl, width: 0, height: 0, compressed: false, lowResolution: false };
  }

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const maxDim = Math.max(w, h);
  const lowResolution = Math.max(w, h) < IMAGE_LOW_RES_DIM;

  if (maxDim <= IMAGE_MAX_DIM) {
    return { dataUrl, width: w, height: h, compressed: false, lowResolution };
  }

  const scale = IMAGE_MAX_DIM / maxDim;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl, width: w, height: h, compressed: false, lowResolution };
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', IMAGE_QUALITY),
    width: canvas.width,
    height: canvas.height,
    compressed: true,
    lowResolution,
  };
}
