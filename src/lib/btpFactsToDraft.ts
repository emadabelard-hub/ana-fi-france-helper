/**
 * BTP — Transfert des prestations structurées vers le brouillon de devis.
 *
 * Source unique : le bloc <ANAFYPRO_BTP_FACTS> produit par l'analyse chantier
 * (faits structurés). Aucun texte Markdown n'est reconstitué ici.
 *
 * Statuts transférables :
 *   - ready_for_draft
 *   - ready_for_draft_with_technical_reservation  (quantité/unité conservées)
 *   - certain  (statut historique du bloc de faits)
 *
 * Statuts NON transférés automatiquement :
 *   - quantity_to_confirm, not_transferable, lecture_partielle, absent,
 *     hypothèses et informations non vérifiables.
 *
 * Règles absolues :
 *   - jamais de quantité inventée (pas de « 1 »), jamais d'unité forcée à « u » ;
 *   - jamais de prix inventé (unitPrice = 0 = « à compléter », comportement
 *     existant du Devis intelligent) ;
 *   - lot conservé, aucun doublon.
 */

import type { ValidatedLine, ValidationMeta } from './btpTransferValidator';

const TRANSFERABLE = new Set([
  'ready_for_draft',
  'ready_for_draft_with_technical_reservation',
  'certain',
]);

const RESERVATION_STATUS = 'ready_for_draft_with_technical_reservation';

export type FactsDraftResult = {
  lines: ValidatedLine[];
  meta: ValidationMeta[];
  rawItems: Record<string, unknown>[];
  /** Prestations structurées présentes mais non transférables (à confirmer). */
  pendingCount: number;
  /** Nombre total de prestations structurées trouvées. */
  totalFacts: number;
  /** true dès que des faits structurés exploitables existent dans la source. */
  hasStructuredFacts: boolean;
};

const EMPTY: FactsDraftResult = {
  lines: [],
  meta: [],
  rawItems: [],
  pendingCount: 0,
  totalFacts: 0,
  hasStructuredFacts: false,
};

const toNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

const isReadableUnit = (u: unknown): u is string => {
  if (typeof u !== 'string') return false;
  const s = u.trim();
  if (!s) return false;
  const low = s.toLowerCase();
  if (['?', '-', 'null', 'n/a', 'à définir', 'a definir'].includes(low)) return false;
  return true;
};

const parseFactsSource = (source: unknown): any | null => {
  if (!source) return null;
  if (typeof source === 'object') return source;
  if (typeof source !== 'string') return null;
  const text = source;
  const open = text.indexOf('<ANAFYPRO_BTP_FACTS>');
  const raw = open !== -1
    ? text.slice(open + '<ANAFYPRO_BTP_FACTS>'.length, text.indexOf('</ANAFYPRO_BTP_FACTS>') === -1 ? undefined : text.indexOf('</ANAFYPRO_BTP_FACTS>'))
    : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
};

const readString = (obj: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

/**
 * Construit les lignes de brouillon à partir des faits structurés.
 */
export const buildDraftLinesFromFacts = (source: unknown): FactsDraftResult => {
  const parsed = parseFactsSource(source);
  if (!parsed) return EMPTY;

  const rawFacts: unknown = Array.isArray(parsed?.facts)
    ? parsed.facts
    : Array.isArray(parsed?.prestations)
      ? parsed.prestations
      : Array.isArray(parsed)
        ? parsed
        : null;
  if (!Array.isArray(rawFacts) || rawFacts.length === 0) return EMPTY;

  const lines: ValidatedLine[] = [];
  const meta: ValidationMeta[] = [];
  const rawItems: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let pendingCount = 0;

  rawFacts.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const f = entry as Record<string, unknown>;

    const designation = readString(f, [
      'descriptionExact', 'description', 'designation_fr', 'designation', 'libelle', 'label', 'title',
    ]);
    const status = (readString(f, ['draftStatus', 'transferStatus', 'status']) || '').trim();
    const quantity = toNum(f.quantity ?? f.quantite ?? f.qty);
    const unit = f.unit ?? f.unite;

    const valid =
      !!designation &&
      TRANSFERABLE.has(status) &&
      quantity !== null &&
      Number.isFinite(quantity) &&
      quantity > 0 &&
      isReadableUnit(unit);

    if (!valid) {
      if (designation) pendingCount += 1;
      return;
    }

    const lot = readString(f, ['lot', 'category', 'categorie']);

    // Réserve technique : mention courte, jamais une prestation supplémentaire.
    const reservation = readString(f, [
      'technicalReservation', 'reserveTechnique', 'reservation', 'reserve',
    ]);
    const clientSupplied =
      f.clientSupplied === true ||
      f.fournitureClient === true ||
      f.suppliedByClient === true;

    const notes: string[] = [];
    if (status === RESERVATION_STATUS) {
      notes.push(reservation ? `réserve technique : ${reservation}` : 'réserve technique à confirmer');
    } else if (reservation) {
      notes.push(`réserve technique : ${reservation}`);
    }
    if (clientSupplied) notes.push('fourniture à la charge du client');

    const finalDesignation = notes.length > 0
      ? `${designation} (${notes.join(' ; ')})`
      : designation;

    const dedupKey = `${finalDesignation.toLowerCase()}|${quantity}|${String(unit).trim().toLowerCase()}|${lot ?? ''}`;
    if (seen.has(dedupKey)) return;
    seen.add(dedupKey);

    const index = rawItems.length;
    rawItems.push(f);
    lines.push({
      designation_fr: finalDesignation,
      designation_ar: '',
      quantity,
      unit: String(unit).trim(),
      unitPrice: 0, // prix non renseigné — comportement existant « à compléter »
      lot: lot ?? null,
    });
    meta.push({
      index,
      designation: finalDesignation,
      priceAccepted: false,
      quantityAccepted: true,
      reasons: status === RESERVATION_STATUS ? ['technical_reservation'] : [],
      priceSource: null,
      confidence: toNum(f.confidence),
      quantityConfidence: toNum(f.quantityConfidence) ?? toNum(f.confidence),
      priceConfidence: null,
      requiresReview: false,
      arithmeticOk: null,
    });
  });

  return {
    lines,
    meta,
    rawItems,
    pendingCount,
    totalFacts: rawFacts.length,
    hasStructuredFacts: true,
  };
};
