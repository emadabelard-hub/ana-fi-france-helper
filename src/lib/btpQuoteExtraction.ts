/**
 * « Préparer le devis » — extraction propre depuis les documents originaux.
 *
 * Source : bloc <ANAFYPRO_QUOTE_LINES> produit par l'action serveur
 * `btp_quote_extract` (lecture du dossier complet, comme l'assistant
 * documentaire normal).
 *
 * Contrat simple par ligne :
 *   designation, quantity, unit, sourceFile, evidenceText,
 *   status : confirmed | quantity_missing | conditional
 *
 * Règles :
 *   - toute quantité écrite est reprise telle quelle ;
 *   - aucune quantité inventée (jamais 1, 1 u, 1 forfait, 1 ensemble) ;
 *   - aucune unité forcée ;
 *   - aucune ligne supprimée parce que sa quantité est inconnue ;
 *   - sourceFile et evidenceText conservés pour contrôle.
 */

import type { ValidatedLine, ValidationMeta } from './btpTransferValidator';
import { BTP_FACTS_ORIGIN } from './btpFactsToDraft';

export type QuoteLineStatus = 'confirmed' | 'quantity_missing' | 'conditional';

export type QuoteExtractionLine = {
  designation: string;
  quantity: number | null;
  unit: string | null;
  sourceFile: string | null;
  evidenceText: string | null;
  status: QuoteLineStatus;
  /** Caractéristiques / composants inclus (ex. « 5 bouches »), jamais une quantité. */
  characteristics: string | null;
  lot: string | null;
};

export type QuoteExtractionResult = {
  lines: (ValidatedLine & { sourceOrigin: typeof BTP_FACTS_ORIGIN })[];
  meta: ValidationMeta[];
  rawItems: Record<string, unknown>[];
  extracted: QuoteExtractionLine[];
  documents: string[];
  ok: boolean;
};

const EMPTY: QuoteExtractionResult = {
  lines: [],
  meta: [],
  rawItems: [],
  extracted: [],
  documents: [],
  ok: false,
};

const OPEN = '<ANAFYPRO_QUOTE_LINES>';
const CLOSE = '</ANAFYPRO_QUOTE_LINES>';

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (['null', 'n/a', '-', '?', 'à définir', 'a definir'].includes(low)) return null;
  return s;
};

const readStatus = (v: unknown): QuoteLineStatus => {
  const s = (typeof v === 'string' ? v.trim().toLowerCase() : '');
  if (s === 'conditional' || s === 'conditionnel') return 'conditional';
  if (s === 'quantity_missing' || s === 'quantite_manquante') return 'quantity_missing';
  return 'confirmed';
};

export const parseQuoteLinesBlock = (source: unknown): any | null => {
  if (!source) return null;
  if (typeof source === 'object') return source;
  if (typeof source !== 'string') return null;
  const open = source.indexOf(OPEN);
  const closeIdx = source.indexOf(CLOSE);
  const raw = open !== -1
    ? source.slice(open + OPEN.length, closeIdx === -1 ? undefined : closeIdx)
    : source;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
};

/**
 * Transforme le bloc d'extraction en lignes de brouillon de devis.
 * Aucune ligne n'est écartée : une quantité inconnue reste vide (0 = « à
 * compléter », comportement existant du Devis intelligent).
 */
export const buildDraftLinesFromQuoteExtraction = (source: unknown): QuoteExtractionResult => {
  const parsed = parseQuoteLinesBlock(source);
  if (!parsed) return EMPTY;

  const rawLines: unknown = Array.isArray(parsed?.lines)
    ? parsed.lines
    : Array.isArray(parsed)
      ? parsed
      : null;
  if (!Array.isArray(rawLines) || rawLines.length === 0) return EMPTY;

  const documents: string[] = Array.isArray(parsed?.documents)
    ? (parsed.documents as unknown[])
        .map((d) => (typeof d === 'string' ? d : str((d as any)?.fileName)))
        .filter((d): d is string => Boolean(d))
    : [];

  const extracted: QuoteExtractionLine[] = [];
  const lines: QuoteExtractionResult['lines'] = [];
  const meta: ValidationMeta[] = [];
  const rawItems: Record<string, unknown>[] = [];

  rawLines.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const f = entry as Record<string, unknown>;
    const designation = str(f.designation) ?? str(f.description) ?? str(f.descriptionExact);
    if (!designation) return;

    const quantity = toNum(f.quantity);
    const unit = str(f.unit);
    const status = readStatus(f.status);
    const characteristics = str(f.characteristics) ?? str(f.caracteristiques);
    const line: QuoteExtractionLine = {
      designation,
      // Une quantité absente reste absente : aucune valeur par défaut.
      quantity: status === 'quantity_missing' ? (quantity ?? null) : quantity,
      unit,
      sourceFile: str(f.sourceFile),
      evidenceText: str(f.evidenceText),
      status,
      characteristics,
      lot: str(f.lot),
    };
    extracted.push(line);
    rawItems.push({
      designation: line.designation,
      quantity: line.quantity,
      unit: line.unit,
      sourceFile: line.sourceFile,
      evidenceText: line.evidenceText,
      status: line.status,
      characteristics: line.characteristics,
      lot: line.lot,
    });

    const reasons: string[] = [];
    if (line.status === 'conditional') reasons.push('conditional');
    if (line.quantity === null) reasons.push('quantity_missing');

    lines.push({
      designation_fr: line.characteristics
        ? `${line.designation} (${line.characteristics})`
        : line.designation,
      designation_ar: '',
      // 0 = quantité vide « à compléter » : jamais 1 inventé.
      quantity: line.quantity ?? 0,
      unit: line.unit ?? '',
      unitPrice: 0, // prix jamais inventé
      lot: line.lot,
      sourceOrigin: BTP_FACTS_ORIGIN,
    });
    meta.push({
      index: rawItems.length - 1,
      designation: line.designation,
      priceAccepted: false,
      quantityAccepted: line.quantity !== null,
      reasons,
      priceSource: null,
      confidence: null,
      quantityConfidence: null,
      priceConfidence: null,
      requiresReview: line.status === 'conditional',
      arithmeticOk: null,
    });
  });

  if (lines.length === 0) return { ...EMPTY, documents };
  return { lines, meta, rawItems, extracted, documents, ok: true };
};
