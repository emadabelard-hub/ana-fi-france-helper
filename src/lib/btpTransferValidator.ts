/**
 * BTP Transfer Validator
 *
 * Verrouille le parcours Assistant IA → Devis intelligent.
 * Empêche tout prix / quantité incertain(e) d'être injecté(e) automatiquement.
 *
 * Règles (voir mission "Sécurisation du transfert Assistant IA → Devis intelligent"):
 *  - Prix accepté SEULEMENT si:
 *      priceSource === "document"
 *      requiresReview === false
 *      confidence >= 0.90
 *      quantity présent, unitPrice présent
 *      contrôle arithmétique quantity × unitPrice ≈ total (tol. 0,02 €) — si total fourni
 *  - Quantité acceptée SEULEMENT si:
 *      quantity > 0
 *      unit lisible (non vide, ≠ "?")
 *      confidence >= 0.75
 *  - Sinon: la désignation est conservée, mais unitPrice = 0 (= "à compléter"
 *    côté Devis intelligent) et/ou quantity = 1 (valeur neutre non-facturante
 *    imposée par le type LineItem existant, sans invention de prix).
 *
 * Aucun modèle / fournisseur IA n'est modifié ici.
 */

const PRICE_EPS = 0.02;
const PRICE_CONF_MIN = 0.9;
const QTY_CONF_MIN = 0.75;

type RawItem = {
  description?: string | null;
  designation_fr?: string | null;
  designation?: string | null;
  libelle?: string | null;
  label?: string | null;
  quantity?: number | string | null;
  quantite?: number | string | null;
  qty?: number | string | null;
  unit?: string | null;
  unite?: string | null;
  unitPrice?: number | string | null;
  prix_unitaire?: number | string | null;
  pu?: number | string | null;
  total?: number | string | null;
  priceSource?: string | null;
  requiresReview?: boolean | null;
  confidence?: number | string | null;
  quantityConfidence?: number | string | null;
  priceConfidence?: number | string | null;
};

export type ValidatedLine = {
  designation_fr: string;
  designation_ar: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lot: string | null;
};

export type ValidationMeta = {
  index: number;
  designation: string;
  priceAccepted: boolean;
  quantityAccepted: boolean;
  reasons: string[];
  priceSource: string | null;
  confidence: number | null;
  quantityConfidence: number | null;
  priceConfidence: number | null;
  requiresReview: boolean | null;
  arithmeticOk: boolean | null;
};

export type ValidationReport = {
  lines: ValidatedLine[];
  meta: ValidationMeta[];
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
  if (s === '?' || s === '-' || s.toLowerCase() === 'null') return false;
  return true;
};

/**
 * Valide et normalise les items produits par l'Assistant IA (bloc
 * <ANAFYPRO_DOCUMENT_DATA>) avant écriture dans sessionStorage.
 *
 * @param rawItems        - Items extraits du document (tableau).
 * @param documentTotalHT - Total HT lu sur le document (optionnel). S'il est
 *                          strictement positif et que la somme recalculée des
 *                          lignes acceptées s'en écarte de plus de 0,02 €,
 *                          tous les prix transférés sont refusés.
 */
export const validateBtpItemsForTransfer = (
  rawItems: unknown,
  documentTotalHT?: number | string | null
): ValidationReport => {
  const arr: RawItem[] = Array.isArray(rawItems) ? (rawItems as RawItem[]) : [];
  const lines: ValidatedLine[] = [];
  const meta: ValidationMeta[] = [];

  arr.forEach((it, index) => {
    const designation = String(
      it?.description ?? it?.designation_fr ?? it?.designation ?? it?.libelle ?? it?.label ?? ''
    ).trim();
    if (!designation) return;

    const qtyRaw = toNum(it?.quantity ?? it?.quantite ?? it?.qty);
    const puRaw = toNum(it?.unitPrice ?? it?.prix_unitaire ?? it?.pu);
    const totalRaw = toNum(it?.total);
    const unitRaw = it?.unit ?? it?.unite;
    const priceSource = typeof it?.priceSource === 'string' ? it.priceSource : null;
    const requiresReview =
      typeof it?.requiresReview === 'boolean' ? it.requiresReview : null;
    const confidence = toNum(it?.confidence);
    const quantityConfidence = toNum(it?.quantityConfidence) ?? confidence;
    const priceConfidence = toNum(it?.priceConfidence) ?? confidence;

    const reasons: string[] = [];

    // ── Contrôle arithmétique (uniquement si tout est fourni) ──
    let arithmeticOk: boolean | null = null;
    if (qtyRaw !== null && puRaw !== null && totalRaw !== null) {
      arithmeticOk = Math.abs(qtyRaw * puRaw - totalRaw) <= PRICE_EPS;
      if (!arithmeticOk) reasons.push('arithmetic_mismatch');
    }

    // ── Décision quantité ──
    let quantityAccepted =
      qtyRaw !== null &&
      qtyRaw > 0 &&
      isReadableUnit(unitRaw) &&
      (quantityConfidence === null ? false : quantityConfidence >= QTY_CONF_MIN);

    if (!quantityAccepted) {
      if (qtyRaw === null || qtyRaw <= 0) reasons.push('quantity_missing_or_invalid');
      if (!isReadableUnit(unitRaw)) reasons.push('unit_unreadable');
      if (quantityConfidence === null || quantityConfidence < QTY_CONF_MIN) reasons.push('quantity_low_confidence');
    }

    // ── Décision prix ──
    let priceAccepted =
      puRaw !== null &&
      puRaw > 0 &&
      priceSource === 'document' &&
      requiresReview === false &&
      quantityAccepted && // prix ⇒ quantité fiable
      (priceConfidence === null ? false : priceConfidence >= PRICE_CONF_MIN) &&
      arithmeticOk !== false; // null (pas de total fourni) toléré, false interdit

    if (!priceAccepted) {
      if (puRaw === null || puRaw <= 0) reasons.push('price_missing');
      if (priceSource !== 'document') reasons.push('price_source_not_document');
      if (requiresReview !== false) reasons.push('price_requires_review');
      if (priceConfidence === null || priceConfidence < PRICE_CONF_MIN) reasons.push('price_low_confidence');
      if (arithmeticOk === false) reasons.push('price_arithmetic_failed');
      if (!quantityAccepted) reasons.push('price_blocked_by_quantity');
    }

    // ── Construction ligne (jamais d'invention) ──
    // Type LineItem impose quantity: number > 0 et unitPrice: number.
    // On respecte le contrat existant : quantité neutre 1 et prix 0 = "à compléter".
    lines.push({
      designation_fr: designation,
      designation_ar: '',
      quantity: quantityAccepted && qtyRaw !== null ? qtyRaw : 1,
      unit: quantityAccepted && isReadableUnit(unitRaw) ? unitRaw.trim() : 'u',
      unitPrice: priceAccepted && puRaw !== null ? puRaw : 0,
      lot: null,
    });

    meta.push({
      index,
      designation,
      priceAccepted,
      quantityAccepted,
      reasons,
      priceSource,
      confidence,
      quantityConfidence,
      priceConfidence,
      requiresReview,
      arithmeticOk,
    });
  });

  // ── Contrôle global du total HT ──
  const totalHT = toNum(documentTotalHT);
  const acceptedPriceIndexes = meta
    .map((m, i) => (m.priceAccepted ? i : -1))
    .filter((i) => i !== -1);

  if (totalHT !== null && totalHT > 0 && acceptedPriceIndexes.length > 0) {
    const sumRecomputed = acceptedPriceIndexes.reduce((sum, i) => {
      const line = lines[i];
      return sum + line.quantity * line.unitPrice;
    }, 0);

    if (Math.abs(sumRecomputed - totalHT) > PRICE_EPS) {
      // Refus global des prix transférés ; quantités et unités restent inchangées.
      lines.forEach((line) => {
        line.unitPrice = 0;
      });
      meta.forEach((m) => {
        m.priceAccepted = false;
        m.reasons.push('global_total_mismatch');
      });
    }
  }

  return { lines, meta };
};
