/**
 * Professional CSV export utility for French accounting.
 * Single flat table, semicolon-delimited, strict validation.
 * Format: Date;Type;Tiers;Compte;Libelle;Montant_HT;TVA_Taux;TVA_Montant;Montant_TTC;Statut
 */

const BOM = '\uFEFF';

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

const ARABIC_LABELS: Record<string, string> = {
  'بنزين': 'Frais de carburant',
  'مازوت': 'Frais de gasoil',
  'وقود': 'Frais de carburant',
  'شراء دهان': 'Achat de peinture',
  'شراء مواد': 'Achat de matériaux',
  'نقل': 'Frais de transport',
  'دهان': 'Travaux de peinture',
  'صباغة': 'Travaux de peinture',
  'بلاط': 'Travaux de carrelage',
  'كهرباء': "Travaux d'électricité",
  'سباكة': 'Travaux de plomberie',
  'ترميم': 'Travaux de rénovation',
  'هدم': 'Travaux de démolition',
  'عزل': "Travaux d'isolation",
  'تنظيف': 'Nettoyage de chantier',
  'نجارة': 'Travaux de menuiserie',
  'إصلاح': 'Travaux de réparation',
};

const VALID_TVA_RATES = [0, 5.5, 10, 20];

function translateToFrench(text: string): string {
  if (!text) return 'Prestation de services';
  const trimmed = text.trim();
  if (ARABIC_LABELS[trimmed]) return ARABIC_LABELS[trimmed];
  if (ARABIC_REGEX.test(trimmed)) {
    const parts: string[] = [];
    for (const [ar, fr] of Object.entries(ARABIC_LABELS)) {
      if (trimmed.includes(ar)) parts.push(fr);
    }
    if (parts.length > 0) return parts.join(' - ');
    const cleaned = trimmed.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '').trim();
    return cleaned || 'Prestation de services';
  }
  return trimmed;
}

const GARBLED_PATTERN = /^[a-zàâéèêëïôùûüç]{1,4}\d|^.{1,5}$/i;
const TRUNCATED_PATTERNS = [
  /^prestation\s*tra/i,
  /^travaux?\s*$/i,
  /^ré\d/i,
  /^tra$/i,
  /^pon$/i,
  /^end$/i,
  /^pei$/i,
  /^net$/i,
  /^dém$/i,
  /^fou$/i,
  /^\s*$/,
];

function professionalLibelle(text: string, type: 'Vente' | 'Achat' | 'Transport'): string {
  let result = translateToFrench(text);
  const isGarbled = GARBLED_PATTERN.test(result) || TRUNCATED_PATTERNS.some(p => p.test(result));
  const isTooShort = result.length < 15;

  if (isGarbled || isTooShort) {
    if (type === 'Transport') result = 'Frais de déplacement chantier';
    else if (type === 'Achat') result = 'Achat de matériaux chantier';
    else result = 'Travaux de rénovation intérieure';
  }

  if (result.length > 0) result = result.charAt(0).toUpperCase() + result.slice(1);
  return result;
}

function correctTvaRate(rate: number, isExplicitlyExempt: boolean = false): number {
  if (rate === 0 && !isExplicitlyExempt) return 10;
  if (VALID_TVA_RATES.includes(rate)) return rate;
  let closest = 10;
  let minDiff = Math.abs(rate - 10);
  for (const valid of VALID_TVA_RATES) {
    if (valid === 0 && !isExplicitlyExempt) continue;
    const diff = Math.abs(rate - valid);
    if (diff < minDiff) { minDiff = diff; closest = valid; }
  }
  return closest;
}

function sanitizeAmount(amount: number | null | undefined): number {
  if (amount == null || !isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100) / 100;
}

function cleanCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value).replace(/"/g, '').replace(/\\/g, '').trim();
  if (str.includes(';') || str.includes('\n')) return `"${str}"`;
  return str;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function fmtNum(n: number): string {
  return n.toFixed(2);
}

function computeHT(ttc: number, tvaRate: number): number {
  if (!tvaRate || tvaRate <= 0) return ttc;
  return ttc / (1 + tvaRate / 100);
}

// ── Types ──

export interface CsvDocumentRow {
  date: string;
  type: 'devis' | 'facture' | 'expense';
  reference: string;
  clientName: string;
  projectName?: string | null;
  totalHT?: number | null;
  tvaRate?: number | null;
  tvaAmount?: number | null;
  totalTTC: number;
  status?: string | null;
  tvaExempt?: boolean;
  documentNumber?: string | null;
  paymentMode?: string | null;
}

export interface AccountingExportData {
  invoices: CsvDocumentRow[];
  expenses: CsvDocumentRow[];
}

// ── Legacy simple export (kept for backward compat) ──

export function generateProfessionalCSV(rows: CsvDocumentRow[]): string {
  const sep = ';';
  const headers = [
    'Date', 'Type', 'Reference', 'Client', 'Projet',
    'Total HT', 'Taux TVA (%)', 'Montant TVA', 'Total TTC',
  ];

  const csvRows = rows.map(r => {
    const date = formatDate(r.date);
    const type = r.type === 'devis' ? 'Devis' : r.type === 'facture' ? 'Facture' : 'Depense';
    const tvaRate = correctTvaRate(r.tvaRate ?? 0, r.tvaExempt === true);
    const rawHT = sanitizeAmount(r.totalHT);
    const rawTTC = sanitizeAmount(r.totalTTC);
    const ht = rawHT > 0 ? rawHT : computeHT(rawTTC, tvaRate);
    const tvaMontant = Math.round(ht * tvaRate) / 100;
    const ttc = Math.round((ht + tvaMontant) * 100) / 100;

    return [
      date, type, cleanCell(r.reference), cleanCell(r.clientName), cleanCell(r.projectName),
      ht.toFixed(2), tvaRate.toFixed(1), tvaMontant.toFixed(2), ttc.toFixed(2),
    ].join(sep);
  });

  return BOM + [headers.join(sep), ...csvRows].join('\n');
}

// ── Professional SINGLE-TABLE accounting export ──
// FORMAT FRANÇAIS COMPTABILITÉ STANDARD :
// Date;N° Pièce;N° Document;Type;Compte;Compte Tiers;Tiers;Libellé;
// Montant HT;Taux TVA;Montant TVA;Compte TVA;Montant TTC;Mode règlement;Statut
// Séparateur: point-virgule (;)

// Détecte un numéro de document (F-2026-049, D-2026-001…) dans une chaîne libre
function extractDocumentNumber(raw: string | null | undefined): string {
  if (!raw) return '';
  const m = String(raw).match(/\b([FD])[-_ ]?\d{2,4}[-_ ]?\d{1,5}\b/i);
  return m ? m[0].toUpperCase().replace(/[_ ]/g, '-') : '';
}

// Normalise le mode de règlement vers le vocabulaire comptable français
function normalizePaymentMode(raw: string | null | undefined): string {
  if (!raw) return 'Non spécifié';
  const s = String(raw).toLowerCase();
  if (/(virement|transfer|sepa|wire)/.test(s)) return 'Virement';
  if (/(ch[èe]que|cheque)/.test(s)) return 'Chèque';
  if (/(esp[èe]ces|espece|cash|liquide|نقد|كاش)/.test(s)) return 'Espèces';
  if (/(carte|cb|card)/.test(s)) return 'Carte bancaire';
  if (/(pr[ée]l[èe]vement)/.test(s)) return 'Prélèvement';
  return 'Non spécifié';
}

export function generateAccountingCSV(data: AccountingExportData): string {
  const sep = ';';
  const headers = [
    'Date', 'N° Pièce', 'N° Document', 'Type', 'Compte', 'Compte Tiers', 'Tiers', 'Libellé',
    'Montant HT', 'Taux TVA', 'Montant TVA', 'Compte TVA', 'Montant TTC', 'Mode règlement', 'Statut',
  ];

  const allRows: string[] = [];
  const errors: string[] = [];
  let pieceCounter = 0;

  // ── Ventes (factures) ──
  for (const r of data.invoices) {
    const date = formatDate(r.date);
    if (!date) { errors.push(`Date manquante pour ${r.reference}`); continue; }

    const tvaRate = correctTvaRate(r.tvaRate ?? 0, r.tvaExempt === true);
    const rawHT = sanitizeAmount(r.totalHT);
    const rawTTC = sanitizeAmount(r.totalTTC);
    if (rawHT <= 0 && rawTTC <= 0) { errors.push(`Montant nul pour ${r.reference}`); continue; }

    const ht = rawHT > 0 ? rawHT : computeHT(rawTTC, tvaRate);
    const tvaMontant = Math.round(ht * tvaRate) / 100;
    const ttc = Math.round((ht + tvaMontant) * 100) / 100;

    const libelle = professionalLibelle(r.reference || r.clientName || '', 'Vente');
    const clientName = translateToFrench(r.clientName);
    const docNumber = r.documentNumber || extractDocumentNumber(r.reference);
    const paymentMode = normalizePaymentMode(r.paymentMode);
    pieceCounter += 1;
    const piece = `PCE-${String(pieceCounter).padStart(5, '0')}`;
    const compteTVA = tvaMontant > 0 ? '44571' : '';

    allRows.push([
      date, piece, cleanCell(docNumber), 'Vente', '706', '411000', cleanCell(clientName), cleanCell(libelle),
      fmtNum(ht), fmtNum(tvaRate), fmtNum(tvaMontant), compteTVA, fmtNum(ttc), paymentMode, 'Validée',
    ].join(sep));
  }

  // ── Achats (dépenses) ──
  for (const r of data.expenses) {
    const date = formatDate(r.date);
    if (!date) { errors.push(`Date manquante pour dépense`); continue; }

    const tvaRate = correctTvaRate(r.tvaRate ?? 0, r.tvaExempt === true);
    const rawHT = sanitizeAmount(r.totalHT);
    const rawTTC = sanitizeAmount(r.totalTTC);
    if (rawHT <= 0 && rawTTC <= 0) continue;

    const ht = rawHT > 0 ? rawHT : computeHT(rawTTC, tvaRate);
    const tvaMontant = Math.round(ht * tvaRate) / 100;
    const ttc = Math.round((ht + tvaMontant) * 100) / 100;

    const rawLabel = r.reference || r.clientName || '';
    const isTransport = /transport|بنزين|مازوت|وقود|carburant|gasoil/i.test(rawLabel);
    const compte = isTransport ? '625' : '601';
    const libelle = professionalLibelle(rawLabel, isTransport ? 'Transport' : 'Achat');
    const fournisseurName = translateToFrench(r.clientName || 'Fournisseur');
    const docNumber = r.documentNumber || extractDocumentNumber(r.reference);
    const paymentMode = normalizePaymentMode(r.paymentMode);
    pieceCounter += 1;
    const piece = `PCE-${String(pieceCounter).padStart(5, '0')}`;
    const compteTVA = tvaMontant > 0 ? '44566' : '';

    allRows.push([
      date, piece, cleanCell(docNumber), 'Achat', compte, '401000', cleanCell(fournisseurName), cleanCell(libelle),
      fmtNum(ht), fmtNum(tvaRate), fmtNum(tvaMontant), compteTVA, fmtNum(ttc), paymentMode, 'Validée',
    ].join(sep));
  }

  if (allRows.length === 0) {
    throw new Error(errors.length > 0
      ? `Export impossible : ${errors.join(', ')}`
      : 'Aucune opération à exporter');
  }

  return BOM + [headers.join(sep), ...allRows].join('\n');
}

/**
 * Download a CSV string as a file.
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
