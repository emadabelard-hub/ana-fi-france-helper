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
  // Optionnels (déduits si absents)
  paymentStatus?: 'paid' | 'unpaid' | string | null;
  paymentDate?: string | null;        // date réelle du règlement
  dueDate?: string | null;            // date d'échéance prévue
  paymentReference?: string | null;   // réf. virement bancaire
  updatedAt?: string | null;          // pour déduire la date de paiement
}

export interface CompanyHeaderInfo {
  companyName?: string | null;
  siret?: string | null;
  tvaNumber?: string | null;
  address?: string | null;
}

export interface PeriodInfo {
  start?: string | null;  // ISO date
  end?: string | null;    // ISO date
  label?: string | null;  // ex: "Du 01/01/2026 au 31/03/2026"
}

export interface AccountingExportData {
  invoices: CsvDocumentRow[];
  expenses: CsvDocumentRow[];
  company?: CompanyHeaderInfo;
  period?: PeriodInfo;
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
// Si non renseigné → "Virement" par défaut (mode le plus utilisé)
function normalizePaymentMode(raw: string | null | undefined): string {
  if (!raw) return 'Virement';
  const s = String(raw).toLowerCase().trim();
  if (!s) return 'Virement';
  if (/(virement|transfer|sepa|wire)/.test(s)) return 'Virement';
  if (/(ch[èe]que|cheque)/.test(s)) return 'Chèque';
  if (/(esp[èe]ces|espece|cash|liquide|نقد|كاش)/.test(s)) return 'Espèces';
  if (/(carte|cb|card)/.test(s)) return 'Carte bancaire';
  if (/(pr[ée]l[èe]vement)/.test(s)) return 'Prélèvement';
  return 'Virement';
}

// Uniformise les noms de tiers : casse cohérente, accents normalisés, espaces nettoyés
// Exemple : "BATI club", "bâti club", "Bâti  Club" → "Bâti Club"
const TIERS_NAME_CACHE = new Map<string, string>();
function normalizeTiersName(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.replace(/\s+/g, ' ').trim();
  if (!trimmed) return trimmed;
  // Clé de regroupement : sans accents, minuscules, sans espaces multiples
  const key = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  // Premier nom rencontré pour cette clé → titlecase canonique
  if (!TIERS_NAME_CACHE.has(key)) {
    const titled = trimmed
      .split(' ')
      .map(w => w.length > 0 ? w.charAt(0).toLocaleUpperCase('fr-FR') + w.slice(1).toLocaleLowerCase('fr-FR') : w)
      .join(' ');
    TIERS_NAME_CACHE.set(key, titled);
  }
  return TIERS_NAME_CACHE.get(key)!;
}

// ── Helpers déduction intelligente ──

function inferDueDate(invoiceDate: string): string {
  const d = new Date(invoiceDate);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 30);
  return formatDate(d.toISOString());
}

function inferPaymentDate(row: CsvDocumentRow): string {
  if (row.paymentStatus !== 'paid') return '';
  if (row.paymentDate) return formatDate(row.paymentDate);
  if (row.updatedAt) return formatDate(row.updatedAt);
  return formatDate(row.date);
}

function lettrage(row: CsvDocumentRow): 'O' | 'N' {
  return row.paymentStatus === 'paid' ? 'O' : 'N';
}

// ── Structure interne d'une écriture ──

interface AccountingEntry {
  date: string;            // DD/MM/YYYY
  isoDate: string;         // YYYY-MM-DD pour FEC
  piece: string;
  documentNumber: string;
  type: 'Vente' | 'Achat';
  compte: string;          // 706 / 601 / 625
  compteLib: string;
  compteTiers: string;     // 411000 / 401000
  tiers: string;
  libelle: string;
  ht: number;
  tvaRate: number;
  tvaMontant: number;
  compteTVA: string;       // 44571 / 44566
  ttc: number;
  paymentMode: string;
  paymentRef: string;
  dueDate: string;
  paymentDate: string;
  lettrage: 'O' | 'N';
}

function buildEntries(data: AccountingExportData): { entries: AccountingEntry[]; errors: string[] } {
  TIERS_NAME_CACHE.clear();
  const entries: AccountingEntry[] = [];
  const errors: string[] = [];
  let pieceCounter = 0;
  let achatCounter = 0;
  const currentYear = new Date().getFullYear();

  const COMPTE_LIB: Record<string, string> = {
    '706': 'Prestations de services',
    '601': 'Achats de matières premières',
    '625': 'Déplacements, missions',
    '411000': 'Clients',
    '401000': 'Fournisseurs',
    '44571': 'TVA collectée',
    '44566': 'TVA déductible sur ABS',
  };

  const toIso = (d: string) => {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
  };

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
    pieceCounter += 1;
    entries.push({
      date,
      isoDate: toIso(r.date),
      piece: `PCE-${String(pieceCounter).padStart(5, '0')}`,
      documentNumber: r.documentNumber || extractDocumentNumber(r.reference),
      type: 'Vente',
      compte: '706',
      compteLib: COMPTE_LIB['706'],
      compteTiers: '411000',
      tiers: normalizeTiersName(translateToFrench(r.clientName)),
      libelle: professionalLibelle(r.reference || r.clientName || '', 'Vente'),
      ht, tvaRate, tvaMontant,
      compteTVA: tvaMontant > 0 ? '44571' : '',
      ttc,
      paymentMode: normalizePaymentMode(r.paymentMode),
      paymentRef: r.paymentReference || '',
      dueDate: r.dueDate ? formatDate(r.dueDate) : inferDueDate(r.date),
      paymentDate: inferPaymentDate(r),
      lettrage: lettrage(r),
    });
  }

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
    achatCounter += 1;
    pieceCounter += 1;
    const extractedDoc = r.documentNumber || extractDocumentNumber(r.reference);
    // Pour dépenses : marquées payées par défaut (déjà encaissées)
    const expensePaid = r.paymentStatus === 'unpaid' ? false : true;
    entries.push({
      date,
      isoDate: toIso(r.date),
      piece: `PCE-${String(pieceCounter).padStart(5, '0')}`,
      documentNumber: extractedDoc || `ACH-${currentYear}-${String(achatCounter).padStart(3, '0')}`,
      type: 'Achat',
      compte,
      compteLib: COMPTE_LIB[compte],
      compteTiers: '401000',
      tiers: normalizeTiersName(translateToFrench(r.clientName || 'Fournisseur')),
      libelle: professionalLibelle(rawLabel, isTransport ? 'Transport' : 'Achat'),
      ht, tvaRate, tvaMontant,
      compteTVA: tvaMontant > 0 ? '44566' : '',
      ttc,
      paymentMode: normalizePaymentMode(r.paymentMode),
      paymentRef: r.paymentReference || '',
      dueDate: r.dueDate ? formatDate(r.dueDate) : inferDueDate(r.date),
      paymentDate: expensePaid ? (r.paymentDate ? formatDate(r.paymentDate) : date) : '',
      lettrage: expensePaid ? 'O' : 'N',
    });
  }

  // Tri chronologique par date ISO
  entries.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  return { entries, errors };
}

// ── Synthèse TVA ──

export interface VATSynthesis {
  collectedByRate: Record<string, { ht: number; tva: number; count: number }>;
  deductibleByRate: Record<string, { ht: number; tva: number; count: number }>;
  totalCollected: number;
  totalDeductible: number;
  netToDeclare: number;
}

export function computeVATSynthesis(data: AccountingExportData): VATSynthesis {
  const { entries } = buildEntries(data);
  const collected: Record<string, { ht: number; tva: number; count: number }> = {};
  const deductible: Record<string, { ht: number; tva: number; count: number }> = {};
  let totalCollected = 0, totalDeductible = 0;

  for (const e of entries) {
    if (e.tvaMontant <= 0) continue;
    const key = e.tvaRate.toFixed(1) + '%';
    if (e.type === 'Vente') {
      if (!collected[key]) collected[key] = { ht: 0, tva: 0, count: 0 };
      collected[key].ht += e.ht;
      collected[key].tva += e.tvaMontant;
      collected[key].count += 1;
      totalCollected += e.tvaMontant;
    } else {
      if (!deductible[key]) deductible[key] = { ht: 0, tva: 0, count: 0 };
      deductible[key].ht += e.ht;
      deductible[key].tva += e.tvaMontant;
      deductible[key].count += 1;
      totalDeductible += e.tvaMontant;
    }
  }

  return {
    collectedByRate: collected,
    deductibleByRate: deductible,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalDeductible: Math.round(totalDeductible * 100) / 100,
    netToDeclare: Math.round((totalCollected - totalDeductible) * 100) / 100,
  };
}

// ── Export Excel-friendly CSV (étendu) ──

export function generateAccountingCSV(data: AccountingExportData): string {
  const sep = ';';
  const { entries, errors } = buildEntries(data);
  if (entries.length === 0) {
    throw new Error(errors.length > 0 ? `Export impossible : ${errors.join(', ')}` : 'Aucune opération à exporter');
  }

  // EN-TÊTE
  const company = data.company || {};
  const period = data.period || {};
  const generatedOn = formatDate(new Date().toISOString());
  const headerLines: string[] = [];
  headerLines.push(`# Export comptable`);
  if (company.companyName) headerLines.push(`# Raison sociale: ${cleanCell(company.companyName)}`);
  if (company.siret) headerLines.push(`# SIRET: ${cleanCell(company.siret)}`);
  if (company.tvaNumber) headerLines.push(`# N° TVA: ${cleanCell(company.tvaNumber)}`);
  const periodLabel = period.label
    || (period.start && period.end ? `Du ${formatDate(period.start)} au ${formatDate(period.end)}` : 'Toutes périodes');
  headerLines.push(`# Période couverte: ${cleanCell(periodLabel)}`);
  headerLines.push(`# Date de génération: ${generatedOn}`);
  headerLines.push('');

  const headers = [
    'Date', 'N° Pièce', 'N° Document', 'Type', 'Compte', 'Lib. Compte', 'Compte Tiers', 'Tiers', 'Libellé',
    'Montant HT', 'Taux TVA', 'Montant TVA', 'Compte TVA', 'Montant TTC',
    'Mode règlement', 'Référence virement', 'Date échéance', 'Date règlement', 'Lettrage', 'Solde cumulé',
    'Statut',
  ];

  let solde = 0;
  const dataRows = entries.map(e => {
    // Solde cumulé : ventes encaissées + (achats payés sortants)
    if (e.type === 'Vente' && e.lettrage === 'O') solde += e.ttc;
    else if (e.type === 'Achat' && e.lettrage === 'O') solde -= e.ttc;
    return [
      e.date, e.piece, cleanCell(e.documentNumber), e.type, e.compte, cleanCell(e.compteLib),
      e.compteTiers, cleanCell(e.tiers), cleanCell(e.libelle),
      fmtNum(e.ht), fmtNum(e.tvaRate), fmtNum(e.tvaMontant), e.compteTVA, fmtNum(e.ttc),
      e.paymentMode, cleanCell(e.paymentRef), e.dueDate, e.paymentDate, e.lettrage,
      fmtNum(Math.round(solde * 100) / 100),
      'Validée',
    ].join(sep);
  });

  // TOTAUX PAR COMPTE
  const byAccount: Record<string, { ht: number; tva: number; ttc: number; count: number; lib: string }> = {};
  const tvaByAccount: Record<string, number> = {};
  for (const e of entries) {
    if (!byAccount[e.compte]) byAccount[e.compte] = { ht: 0, tva: 0, ttc: 0, count: 0, lib: e.compteLib };
    byAccount[e.compte].ht += e.ht;
    byAccount[e.compte].tva += e.tvaMontant;
    byAccount[e.compte].ttc += e.ttc;
    byAccount[e.compte].count += 1;
    if (e.compteTVA) tvaByAccount[e.compteTVA] = (tvaByAccount[e.compteTVA] || 0) + e.tvaMontant;
  }
  const totalsLines: string[] = ['', '# TOTAUX PAR COMPTE', ['Compte', 'Libellé', 'Nb écritures', 'Total HT', 'Total TVA', 'Total TTC'].join(sep)];
  for (const [compte, t] of Object.entries(byAccount).sort()) {
    totalsLines.push([compte, cleanCell(t.lib), String(t.count), fmtNum(t.ht), fmtNum(t.tva), fmtNum(t.ttc)].join(sep));
  }
  for (const [compte, tva] of Object.entries(tvaByAccount).sort()) {
    const lib = compte === '44571' ? 'TVA collectée' : compte === '44566' ? 'TVA déductible' : 'TVA';
    totalsLines.push([compte, lib, '-', '-', fmtNum(tva), '-'].join(sep));
  }

  // SYNTHÈSE TVA
  const synth = computeVATSynthesis(data);
  const synthLines: string[] = ['', '# SYNTHÈSE TVA', ['Sens', 'Compte', 'Taux', 'Base HT', 'Montant TVA', 'Nb'].join(sep)];
  for (const [rate, v] of Object.entries(synth.collectedByRate).sort()) {
    synthLines.push(['Collectée', '44571', rate, fmtNum(v.ht), fmtNum(v.tva), String(v.count)].join(sep));
  }
  for (const [rate, v] of Object.entries(synth.deductibleByRate).sort()) {
    synthLines.push(['Déductible', '44566', rate, fmtNum(v.ht), fmtNum(v.tva), String(v.count)].join(sep));
  }
  synthLines.push(['TOTAL Collectée', '44571', '-', '-', fmtNum(synth.totalCollected), '-'].join(sep));
  synthLines.push(['TOTAL Déductible', '44566', '-', '-', fmtNum(synth.totalDeductible), '-'].join(sep));
  synthLines.push(['NET TVA À DÉCLARER', '-', '-', '-', fmtNum(synth.netToDeclare), '-'].join(sep));

  return BOM + [
    ...headerLines,
    headers.join(sep),
    ...dataRows,
    ...totalsLines,
    ...synthLines,
  ].join('\n');
}

// ── Export FEC (Fichier des Écritures Comptables – DGFiP) ──
// Norme : séparateur TABULATION, encodage UTF-8, en-tête fixe.

export function generateFECCsv(data: AccountingExportData): string {
  const TAB = '\t';
  const { entries, errors } = buildEntries(data);
  if (entries.length === 0) {
    throw new Error(errors.length > 0 ? `Export FEC impossible : ${errors.join(', ')}` : 'Aucune écriture à exporter');
  }

  const headers = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
    'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
    'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
    'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise',
  ];

  const cleanFEC = (v: string | number) => String(v ?? '').replace(/[\t\r\n]/g, ' ').trim();
  const fecDate = (iso: string) => iso ? iso.replace(/-/g, '') : '';
  const fecAmount = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

  const lines: string[] = [headers.join(TAB)];
  let ecritureNum = 0;

  for (const e of entries) {
    ecritureNum += 1;
    const numStr = String(ecritureNum).padStart(6, '0');
    const journalCode = e.type === 'Vente' ? 'VTE' : 'ACH';
    const journalLib = e.type === 'Vente' ? 'Journal des ventes' : 'Journal des achats';
    const dateEcr = fecDate(e.isoDate);
    const dateLet = e.lettrage === 'O' && e.paymentDate
      ? fecDate(new Date(e.paymentDate.split('/').reverse().join('-')).toISOString().slice(0, 10))
      : '';

    if (e.type === 'Vente') {
      // Débit client (411) : TTC
      lines.push([
        journalCode, journalLib, numStr, dateEcr,
        e.compteTiers, 'Clients', cleanFEC(e.tiers), cleanFEC(e.tiers),
        cleanFEC(e.documentNumber), dateEcr, cleanFEC(e.libelle),
        fecAmount(e.ttc), fecAmount(0),
        e.lettrage === 'O' ? 'L' + numStr : '', dateLet, dateEcr, '0,00', 'EUR',
      ].join(TAB));
      // Crédit produit (706) : HT
      lines.push([
        journalCode, journalLib, numStr, dateEcr,
        e.compte, cleanFEC(e.compteLib), '', '',
        cleanFEC(e.documentNumber), dateEcr, cleanFEC(e.libelle),
        fecAmount(0), fecAmount(e.ht),
        '', '', dateEcr, '0,00', 'EUR',
      ].join(TAB));
      // Crédit TVA (44571) si applicable
      if (e.tvaMontant > 0 && e.compteTVA) {
        lines.push([
          journalCode, journalLib, numStr, dateEcr,
          e.compteTVA, 'TVA collectée', '', '',
          cleanFEC(e.documentNumber), dateEcr, cleanFEC(e.libelle),
          fecAmount(0), fecAmount(e.tvaMontant),
          '', '', dateEcr, '0,00', 'EUR',
        ].join(TAB));
      }
    } else {
      // Débit charge (601/625) : HT
      lines.push([
        journalCode, journalLib, numStr, dateEcr,
        e.compte, cleanFEC(e.compteLib), '', '',
        cleanFEC(e.documentNumber), dateEcr, cleanFEC(e.libelle),
        fecAmount(e.ht), fecAmount(0),
        '', '', dateEcr, '0,00', 'EUR',
      ].join(TAB));
      // Débit TVA déductible (44566) si applicable
      if (e.tvaMontant > 0 && e.compteTVA) {
        lines.push([
          journalCode, journalLib, numStr, dateEcr,
          e.compteTVA, 'TVA déductible', '', '',
          cleanFEC(e.documentNumber), dateEcr, cleanFEC(e.libelle),
          fecAmount(e.tvaMontant), fecAmount(0),
          '', '', dateEcr, '0,00', 'EUR',
        ].join(TAB));
      }
      // Crédit fournisseur (401) : TTC
      lines.push([
        journalCode, journalLib, numStr, dateEcr,
        e.compteTiers, 'Fournisseurs', cleanFEC(e.tiers), cleanFEC(e.tiers),
        cleanFEC(e.documentNumber), dateEcr, cleanFEC(e.libelle),
        fecAmount(0), fecAmount(e.ttc),
        e.lettrage === 'O' ? 'L' + numStr : '', dateLet, dateEcr, '0,00', 'EUR',
      ].join(TAB));
    }
  }

  // FEC : pas de BOM (norme stricte UTF-8 sans BOM)
  return lines.join('\r\n');
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
