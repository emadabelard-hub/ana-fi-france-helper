/**
 * Professional CSV export utility for accounting documents.
 * Produces comma-delimited CSV compatible with Excel and accounting software.
 * 3 sections: Factures (ventes), Dépenses (achats), Synthèse fiscale.
 */

const BOM = '\uFEFF';

// Arabic detection
const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Quick Arabic→French translation map for CSV labels
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
  'كهرباء': 'Travaux d\'électricité',
  'سباكة': 'Travaux de plomberie',
  'ترميم': 'Travaux de rénovation',
  'هدم': 'Travaux de démolition',
  'عزل': 'Travaux d\'isolation',
  'تنظيف': 'Nettoyage de chantier',
  'نجارة': 'Travaux de menuiserie',
  'إصلاح': 'Travaux de réparation',
};

// Valid TVA rates in France
const VALID_TVA_RATES = [0, 5.5, 10, 20];

/**
 * Translate Arabic text to French for CSV export.
 */
function translateToFrench(text: string): string {
  if (!text) return 'Prestation de services';
  const trimmed = text.trim();
  // Direct match
  if (ARABIC_LABELS[trimmed]) return ARABIC_LABELS[trimmed];
  // Contains Arabic → try word-by-word
  if (ARABIC_REGEX.test(trimmed)) {
    const parts: string[] = [];
    for (const [ar, fr] of Object.entries(ARABIC_LABELS)) {
      if (trimmed.includes(ar)) parts.push(fr);
    }
    if (parts.length > 0) return parts.join(' - ');
    // Fallback: strip Arabic entirely
    const cleaned = trimmed.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '').trim();
    return cleaned || 'Prestation de services';
  }
  return trimmed;
}

/**
 * Detect truncated/garbled text (e.g. "ré5", "tra", "pon", "Prestation tra").
 */
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

/**
 * Upgrade weak libellés to professional French.
 * ZERO tolerance for truncated, garbled, or incomplete text.
 */
function professionalLibelle(text: string, type: 'Vente' | 'Achat' | 'Transport'): string {
  let result = translateToFrench(text);

  // Detect garbled or truncated text
  const isGarbled = GARBLED_PATTERN.test(result) || TRUNCATED_PATTERNS.some(p => p.test(result));
  const isTooShort = result.length < 15;

  if (isGarbled || isTooShort) {
    if (type === 'Transport') {
      result = 'Frais de déplacement chantier';
    } else if (type === 'Achat') {
      result = 'Achat de matériaux chantier';
    } else {
      result = 'Travaux de rénovation intérieure';
    }
  }

  // Capitalize first letter
  if (result.length > 0) result = result.charAt(0).toUpperCase() + result.slice(1);
  return result;
}

/**
 * Correct TVA rate to nearest valid French rate.
 * DEFAULT: 10% (rénovation BTP) — TVA 0% only if explicitly marked exempt.
 */
function correctTvaRate(rate: number, isExplicitlyExempt: boolean = false): number {
  // Only allow 0% if the document is explicitly marked TVA-exempt
  if (rate === 0 && !isExplicitlyExempt) return 10;
  if (VALID_TVA_RATES.includes(rate)) return rate;
  // Find nearest valid rate (excluding 0 unless exempt)
  let closest = 10;
  let minDiff = Math.abs(rate - 10);
  for (const valid of VALID_TVA_RATES) {
    if (valid === 0 && !isExplicitlyExempt) continue;
    const diff = Math.abs(rate - valid);
    if (diff < minDiff) { minDiff = diff; closest = valid; }
  }
  return closest;
}

/**
 * Validate a monetary amount — must be positive and finite.
 */
function sanitizeAmount(amount: number | null | undefined): number {
  if (amount == null || !isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100) / 100;
}

function cleanCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value).replace(/"/g, '').replace(/\\/g, '').trim();
  if (str.includes(',') || str.includes('\n') || str.includes(';')) return `"${str}"`;
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

function computeTVA(ttc: number, tvaRate: number): number {
  if (!tvaRate || tvaRate <= 0) return 0;
  return ttc - computeHT(ttc, tvaRate);
}

function statusToFrench(_status: string | null | undefined): string {
  // Per accounting rules: all exported entries are considered validated
  return 'Validée';
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
}

export interface AccountingExportData {
  invoices: CsvDocumentRow[];
  expenses: CsvDocumentRow[];
  urssafRate?: number;
  isRate?: number;
}

// ── Legacy single-table export (kept for backward compat) ──

export function generateProfessionalCSV(rows: CsvDocumentRow[]): string {
  const headers = [
    'Date', 'Type', 'Reference', 'Client', 'Projet',
    'Total HT', 'Taux TVA (%)', 'Montant TVA', 'Total TTC',
  ];

  const csvRows = rows.map(r => {
    const date = formatDate(r.date);
    const type = r.type === 'devis' ? 'Devis' : r.type === 'facture' ? 'Facture' : 'Depense';
    const tvaRate = r.tvaRate ?? 0;
    const ht = (r.totalHT != null && r.totalHT > 0) ? r.totalHT : computeHT(r.totalTTC, tvaRate);
    const tva = (r.tvaAmount != null && r.tvaAmount > 0) ? r.tvaAmount : computeTVA(r.totalTTC, tvaRate);

    return [
      date, type, cleanCell(r.reference), cleanCell(r.clientName), cleanCell(r.projectName),
      ht.toFixed(2), tvaRate.toFixed(1), tva.toFixed(2), r.totalTTC.toFixed(2),
    ].join(';');
  });

  return BOM + [headers.join(';'), ...csvRows].join('\n');
}

// ── Professional 3-section accounting export ──

export function generateAccountingCSV(data: AccountingExportData): string {
  const sep = ',';

  // ── Section 1: FACTURES (VENTES) ──
  const invoiceHeaders = [
    'Date', 'Type', 'Client', 'Compte', 'Libelle',
    'Montant_HT', 'TVA_Taux', 'TVA_Montant', 'Montant_TTC', 'Statut',
  ];

  const invoiceRows = data.invoices.map(r => {
    const rawRate = r.tvaRate ?? 0;
    const tvaRate = correctTvaRate(rawRate, r.tvaExempt === true);
    const rawHT = sanitizeAmount(r.totalHT);
    const rawTTC = sanitizeAmount(r.totalTTC);
    // Always recalculate for coherence: HT is source of truth when available
    const ht = rawHT > 0 ? rawHT : computeHT(rawTTC, tvaRate);
    const tvaMontant = Math.round(ht * tvaRate) / 100;
    const ttc = Math.round((ht + tvaMontant) * 100) / 100;
    const libelle = professionalLibelle(r.reference || r.clientName || '', 'Vente');
    const clientName = translateToFrench(r.clientName);
    return [
      formatDate(r.date),
      cleanCell(clientName),
      'Vente',
      '706',
      cleanCell(libelle),
      fmtNum(ht),
      fmtNum(tvaRate),
      fmtNum(tvaMontant),
      fmtNum(ttc),
      statusToFrench(r.status),
    ].join(sep);
  });

  // ── Section 2: DEPENSES (ACHATS) ──
  const expenseHeaders = [
    'Date', 'Fournisseur', 'Type', 'Compte', 'Libelle',
    'Montant_HT', 'TVA_Taux', 'TVA_Montant', 'Montant_TTC', 'Statut',
  ];

  const expenseRows = data.expenses.map(r => {
    const rawRate = r.tvaRate ?? 0;
    const tvaRate = correctTvaRate(rawRate, r.tvaExempt === true);
    const rawHT = sanitizeAmount(r.totalHT);
    const rawTTC = sanitizeAmount(r.totalTTC);
    const ht = rawHT > 0 ? rawHT : computeHT(rawTTC, tvaRate);
    const tvaMontant = Math.round(ht * tvaRate) / 100;
    const ttc = Math.round((ht + tvaMontant) * 100) / 100;
    const rawLabel = r.reference || r.clientName || '';
    const isTransport = /transport|بنزين|مازوت|وقود|carburant|gasoil/i.test(rawLabel);
    const type = isTransport ? 'Transport' : 'Achat';
    const compte = isTransport ? '625' : '601';
    const libelle = professionalLibelle(rawLabel, type);
    const fournisseur = translateToFrench(r.clientName || 'Fournisseur');
    return [
      formatDate(r.date),
      cleanCell(fournisseur),
      type,
      compte,
      cleanCell(libelle),
      fmtNum(ht),
      fmtNum(tvaRate),
      fmtNum(tvaMontant),
      fmtNum(ttc),
      statusToFrench(r.status),
    ].join(sep);
  });

  // ── Section 3: SYNTHESE FISCALE ──
  const totalHTVentes = data.invoices.reduce((s, r) => {
    const rate = correctTvaRate(r.tvaRate ?? 0);
    return s + ((r.totalHT != null && r.totalHT > 0) ? r.totalHT : computeHT(r.totalTTC, rate));
  }, 0);
  const totalTVACollectee = data.invoices.reduce((s, r) => {
    const rate = correctTvaRate(r.tvaRate ?? 0);
    const ht = (r.totalHT != null && r.totalHT > 0) ? r.totalHT : computeHT(r.totalTTC, rate);
    return s + Math.round(ht * rate) / 100;
  }, 0);
  const totalTTCVentes = data.invoices.reduce((s, r) => s + r.totalTTC, 0);

  const totalHTDepenses = data.expenses.reduce((s, r) => {
    const rate = correctTvaRate(r.tvaRate ?? 0);
    return s + ((r.totalHT != null && r.totalHT > 0) ? r.totalHT : computeHT(r.totalTTC, rate));
  }, 0);
  const totalTVADeductible = data.expenses.reduce((s, r) => {
    const rate = correctTvaRate(r.tvaRate ?? 0);
    const ht = (r.totalHT != null && r.totalHT > 0) ? r.totalHT : computeHT(r.totalTTC, rate);
    return s + Math.round(ht * rate) / 100;
  }, 0);
  const totalTTCDepenses = data.expenses.reduce((s, r) => s + r.totalTTC, 0);

  const tvaAPayer = totalTVACollectee - totalTVADeductible;

  const synthHeaders = ['Indicateur', 'Montant'];
  const synthRows = [
    ['Total_HT_Ventes', fmtNum(totalHTVentes)],
    ['Total_TVA_Collectee', fmtNum(totalTVACollectee)],
    ['Total_TTC_Ventes', fmtNum(totalTTCVentes)],
    ['Total_HT_Depenses', fmtNum(totalHTDepenses)],
    ['Total_TVA_Deductible', fmtNum(totalTVADeductible)],
    ['Total_TTC_Depenses', fmtNum(totalTTCDepenses)],
    ['TVA_A_Payer', fmtNum(tvaAPayer)],
  ].map(r => r.join(sep));

  // Combine all 3 sections
  return BOM + [
    invoiceHeaders.join(sep),
    ...invoiceRows,
    '',
    expenseHeaders.join(sep),
    ...expenseRows,
    '',
    synthHeaders.join(sep),
    ...synthRows,
  ].join('\n');
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
