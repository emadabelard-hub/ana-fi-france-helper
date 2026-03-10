/**
 * Professional CSV export utility for accounting documents.
 * Produces semicolon-delimited CSV compatible with Excel and accounting software.
 */

const BOM = '\uFEFF';

function cleanCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const str = String(value).replace(/"/g, '').replace(/\\/g, '').trim();
  // Wrap in quotes if contains semicolons or newlines
  if (str.includes(';') || str.includes('\n')) return `"${str}"`;
  return str;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function computeHT(ttc: number, tvaRate: number): number {
  if (!tvaRate || tvaRate <= 0) return ttc;
  return ttc / (1 + tvaRate / 100);
}

function computeTVA(ttc: number, tvaRate: number): number {
  if (!tvaRate || tvaRate <= 0) return 0;
  const ht = computeHT(ttc, tvaRate);
  return ttc - ht;
}

export interface CsvDocumentRow {
  date: string;           // ISO or locale date string
  type: 'devis' | 'facture' | 'expense';
  reference: string;      // document_number or EXP-xxx
  clientName: string;
  projectName?: string | null;
  totalHT?: number | null;
  tvaRate?: number | null;
  tvaAmount?: number | null;
  totalTTC: number;
}

/**
 * Generate a professional CSV string with proper headers and math.
 * Headers: Date;Type;Reference;Client;Projet;Total HT;Taux TVA (%);Montant TVA;Total TTC
 */
export function generateProfessionalCSV(rows: CsvDocumentRow[]): string {
  const headers = [
    'Date',
    'Type',
    'Reference',
    'Client',
    'Projet',
    'Total HT',
    'Taux TVA (%)',
    'Montant TVA',
    'Total TTC',
  ];

  const csvRows = rows.map(r => {
    const date = formatDate(r.date);
    const type = r.type === 'devis' ? 'Devis' : r.type === 'facture' ? 'Facture' : 'Depense';
    const tvaRate = r.tvaRate ?? 0;
    
    // Use stored HT if available, otherwise compute from TTC
    const ht = (r.totalHT != null && r.totalHT > 0) ? r.totalHT : computeHT(r.totalTTC, tvaRate);
    const tva = (r.tvaAmount != null && r.tvaAmount > 0) ? r.tvaAmount : computeTVA(r.totalTTC, tvaRate);

    return [
      date,
      type,
      cleanCell(r.reference),
      cleanCell(r.clientName),
      cleanCell(r.projectName),
      ht.toFixed(2),
      tvaRate.toFixed(1),
      tva.toFixed(2),
      r.totalTTC.toFixed(2),
    ].join(';');
  });

  return BOM + [headers.join(';'), ...csvRows].join('\n');
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
