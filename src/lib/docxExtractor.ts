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
