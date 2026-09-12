import mammoth from 'mammoth';

const MAX_CHARS = 50000;

/**
 * Extrait uniquement le texte brut d'un fichier DOCX (aucun HTML, aucun OCR,
 * aucune exécution de contenu). Le fichier d'origine n'est jamais modifié.
 */
export async function extractTextFromDocx(file: File): Promise<string> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    throw new Error('Document DOCX illisible.');
  }

  let raw = '';
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    raw = String(result?.value || '');
  } catch (err) {
    console.error('DOCX extraction error:', err);
    throw new Error('Document DOCX illisible ou corrompu.');
  }

  const text = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) {
    throw new Error('Document DOCX vide ou illisible.');
  }

  return text.slice(0, MAX_CHARS);
}

export type DocxTableRow = { cells: string[] };
export type DocxTable = { rows: DocxTableRow[] };
export type DocxStructured = { text: string; tables: DocxTable[] };

/**
 * Extraction ADDITIVE : renvoie le texte brut (identique à extractTextFromDocx)
 * et les tableaux structurés du DOCX, sans aucune interprétation des valeurs.
 * L'ordre des tableaux, des lignes et des cellules est strictement conservé.
 */
export async function extractDocxWithTables(file: File): Promise<DocxStructured> {
  const text = await extractTextFromDocx(file);

  let tables: DocxTable[] = [];
  try {
    const arrayBuffer = await file.arrayBuffer();
    const html = String((await mammoth.convertToHtml({ arrayBuffer }))?.value || '');
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      tables = Array.from(doc.querySelectorAll('table')).map((tableEl) => ({
        rows: Array.from(tableEl.querySelectorAll('tr')).map((trEl) => ({
          cells: Array.from(trEl.querySelectorAll('th,td')).map((c) =>
            (c.textContent || '').replace(/\s+/g, ' ').trim()
          ),
        })),
      }));
    }
  } catch (err) {
    console.warn('[docxExtractor] table extraction failed', err);
    tables = [];
  }

  return { text, tables };
}
