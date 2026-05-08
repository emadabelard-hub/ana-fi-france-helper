/**
 * Génère un ZIP Anafy pour le comptable :
 *  - rapport_comptable.xlsx
 *  - rapport_FEC.txt
 *  - synthese_TVA.xlsx
 */
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import {
  generateAccountingCSV,
  generateFECCsv,
  computeVATSynthesis,
  type AccountingExportData,
} from './csvExport';

export interface AccountantPackageMeta {
  artisanName: string;
  periodLabel: string; // ex: "2026-01" ou "Tout"
  companyName?: string | null;
}

const slug = (s: string) =>
  (s || 'Anafy')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'Anafy';

// Convertit un CSV semicolon en feuille xlsx (en ignorant les lignes commençant par # = en-têtes)
function csvToSheet(csv: string): XLSX.WorkSheet {
  // Strip BOM
  const clean = csv.replace(/^\uFEFF/, '');
  const lines = clean.split('\n');
  const aoa: (string | number)[][] = lines.map((line) => {
    if (!line.trim()) return [''];
    // Split sur ; en respectant les guillemets simples
    const cells: string[] = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ';' && !inQ) { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    // Conversion numérique pour cellules purement numériques
    return cells.map((c) => {
      const t = c.trim();
      if (/^-?\d+([.,]\d+)?$/.test(t)) {
        const num = parseFloat(t.replace(',', '.'));
        return isFinite(num) ? num : c;
      }
      return c;
    });
  });
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildVATSheet(data: AccountingExportData): XLSX.WorkSheet {
  const synth = computeVATSynthesis(data);
  const aoa: (string | number)[][] = [];
  aoa.push(['SYNTHÈSE TVA']);
  aoa.push([]);
  aoa.push(['Sens', 'Compte', 'Taux', 'Base HT', 'Montant TVA', 'Nb écritures']);
  for (const [rate, v] of Object.entries(synth.collectedByRate).sort()) {
    aoa.push(['Collectée', '44571', rate, v.ht, v.tva, v.count]);
  }
  for (const [rate, v] of Object.entries(synth.deductibleByRate).sort()) {
    aoa.push(['Déductible', '44566', rate, v.ht, v.tva, v.count]);
  }
  aoa.push([]);
  aoa.push(['TOTAL TVA Collectée', '', '', '', synth.totalCollected, '']);
  aoa.push(['TOTAL TVA Déductible', '', '', '', synth.totalDeductible, '']);
  aoa.push(['NET TVA À DÉCLARER', '', '', '', synth.netToDeclare, '']);
  return XLSX.utils.aoa_to_sheet(aoa);
}

export async function buildAccountantZip(
  data: AccountingExportData,
  meta: AccountantPackageMeta,
): Promise<{ zipBase64: string; fileName: string; summary: { invoices: number; expenses: number; totalTTC: number; netVAT: number } }> {
  // 1. rapport_comptable.xlsx
  const rapportCsv = generateAccountingCSV(data);
  const wb1 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb1, csvToSheet(rapportCsv), 'Rapport comptable');
  const rapportXlsx = XLSX.write(wb1, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  // 2. rapport_FEC.txt
  const fecTxt = generateFECCsv(data);

  // 3. synthese_TVA.xlsx
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, buildVATSheet(data), 'Synthèse TVA');
  const synthXlsx = XLSX.write(wb2, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  // ZIP
  const zip = new JSZip();
  zip.file('rapport_comptable.xlsx', rapportXlsx);
  zip.file('rapport_FEC.txt', fecTxt);
  zip.file('synthese_TVA.xlsx', synthXlsx);
  const blob = await zip.generateAsync({ type: 'blob' });
  const buf = await blob.arrayBuffer();
  // Conversion en base64 par chunks (évite stack overflow)
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const zipBase64 = btoa(bin);

  const fileName = `Anafy_${slug(meta.artisanName)}_${slug(meta.periodLabel)}.zip`;
  const synth = computeVATSynthesis(data);
  const totalTTC = data.invoices.reduce((s, r) => s + (r.totalTTC || 0), 0);

  return {
    zipBase64,
    fileName,
    summary: {
      invoices: data.invoices.length,
      expenses: data.expenses.length,
      totalTTC: Math.round(totalTTC * 100) / 100,
      netVAT: synth.netToDeclare,
    },
  };
}
