/**
 * Professional CSV export utility for accounting documents.
 * Produces comma-delimited CSV compatible with Excel and accounting software.
 * 3 sections: Factures (ventes), Dépenses (achats), Synthèse fiscale.
 */

const BOM = '\uFEFF';

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

function statusToFrench(status: string | null | undefined): string {
  if (!status) return 'Brouillon';
  const s = status.toLowerCase();
  if (s === 'finalized' || s === 'converted') return 'Validee';
  if (s === 'draft') return 'Brouillon';
  if (s === 'cancelled' || s === 'canceled') return 'Annulee';
  return 'Brouillon';
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
    'Numero', 'Date', 'Client', 'Type', 'Compte', 'Libelle',
    'Montant_HT', 'TVA_Taux', 'TVA_Montant', 'Montant_TTC', 'Statut',
  ];

  const invoiceRows = data.invoices.map(r => {
    const tvaRate = r.tvaRate ?? 0;
    const ht = (r.totalHT != null && r.totalHT > 0) ? r.totalHT : computeHT(r.totalTTC, tvaRate);
    const tva = (r.tvaAmount != null && r.tvaAmount > 0) ? r.tvaAmount : computeTVA(r.totalTTC, tvaRate);
    return [
      cleanCell(r.reference),
      formatDate(r.date),
      cleanCell(r.clientName),
      'Vente',
      '706',
      'Prestation travaux',
      fmtNum(ht),
      fmtNum(tvaRate),
      fmtNum(tva),
      fmtNum(r.totalTTC),
      statusToFrench(r.status),
    ].join(sep);
  });

  // ── Section 2: DEPENSES (ACHATS) ──
  const expenseHeaders = [
    'Date', 'Fournisseur', 'Type', 'Compte', 'Libelle',
    'Montant_HT', 'TVA_Taux', 'TVA_Montant', 'Montant_TTC',
  ];

  const expenseRows = data.expenses.map(r => {
    const tvaRate = r.tvaRate ?? 0;
    const ht = (r.totalHT != null && r.totalHT > 0) ? r.totalHT : computeHT(r.totalTTC, tvaRate);
    const tva = (r.tvaAmount != null && r.tvaAmount > 0) ? r.tvaAmount : computeTVA(r.totalTTC, tvaRate);
    const isTransport = (r.clientName || '').toLowerCase().includes('transport') ||
                        (r.reference || '').toLowerCase().includes('transport');
    return [
      formatDate(r.date),
      cleanCell(r.clientName || 'Fournisseur'),
      isTransport ? 'Transport' : 'Achat',
      isTransport ? '625' : '601',
      cleanCell(r.reference || 'Achat materiel'),
      fmtNum(ht),
      fmtNum(tvaRate),
      fmtNum(tva),
      fmtNum(r.totalTTC),
    ].join(sep);
  });

  // ── Section 3: SYNTHESE FISCALE ──
  const totalHTVentes = data.invoices.reduce((s, r) => {
    const rate = r.tvaRate ?? 0;
    return s + ((r.totalHT != null && r.totalHT > 0) ? r.totalHT : computeHT(r.totalTTC, rate));
  }, 0);
  const totalTVACollectee = data.invoices.reduce((s, r) => {
    const rate = r.tvaRate ?? 0;
    return s + ((r.tvaAmount != null && r.tvaAmount > 0) ? r.tvaAmount : computeTVA(r.totalTTC, rate));
  }, 0);
  const totalTTCVentes = data.invoices.reduce((s, r) => s + r.totalTTC, 0);

  const totalHTDepenses = data.expenses.reduce((s, r) => {
    const rate = r.tvaRate ?? 0;
    return s + ((r.totalHT != null && r.totalHT > 0) ? r.totalHT : computeHT(r.totalTTC, rate));
  }, 0);
  const totalTVADeductible = data.expenses.reduce((s, r) => {
    const rate = r.tvaRate ?? 0;
    return s + ((r.tvaAmount != null && r.tvaAmount > 0) ? r.tvaAmount : computeTVA(r.totalTTC, rate));
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
