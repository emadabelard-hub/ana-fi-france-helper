/**
 * Service isolé — Rentabilité simple par chantier.
 * Lecture seule côté client. Aucun effet de bord.
 *
 * Règles :
 *  - CA HT du chantier = somme des factures (document_type='facture', status!='cancelled') → total_ht
 *  - Coûts HT du chantier =
 *      (a) somme des dépenses NON liées à une facture fournisseur (supplier_invoice_id IS NULL),
 *          converties en HT selon amount_type ('HT' → amount, 'TTC' → amount - tva_amount)
 *      (b) + somme des factures fournisseurs (amount_ht)
 *    → évite le double comptage strict via supplier_invoice_id.
 *  - Marge HT = CA HT − Coûts HT
 *  - Statut :
 *      • incomplet : CA HT = 0, ou au moins une dépense sans amount_type
 *      • deficitaire : marge < 0
 *      • surveiller : 0 ≤ marge/CA < 15%
 *      • rentable : marge/CA ≥ 15%
 */

export type ProfitabilityStatus = 'rentable' | 'surveiller' | 'deficitaire' | 'incomplet';

export interface ExpenseRow {
  amount: number | string | null;
  tva_amount?: number | string | null;
  amount_type?: 'HT' | 'TTC' | null;
  supplier_invoice_id?: string | null;
}

export interface SupplierInvoiceRow {
  amount_ht: number | string | null;
}

export interface FactureRow {
  document_type: string;
  status?: string | null;
  subtotal_ht?: number | string | null;
  total_ttc?: number | string | null;
  tva_amount?: number | string | null;
}

export interface ProfitabilityResult {
  revenueHT: number;
  expensesHT: number;
  supplierHT: number;
  costsHT: number;
  marginHT: number;
  marginRate: number | null; // null si CA = 0
  status: ProfitabilityStatus;
  incompleteReasons: string[];
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export function expenseToHT(e: ExpenseRow): number {
  const amt = num(e.amount);
  const tva = num(e.tva_amount);
  if (e.amount_type === 'HT') return amt;
  if (e.amount_type === 'TTC') return Math.max(0, amt - tva);
  // fallback prudent : considérer amount comme TTC si tva connue, sinon amount tel quel
  return tva > 0 ? Math.max(0, amt - tva) : amt;
}

export function computeChantierProfitability(params: {
  documents: FactureRow[];
  expenses: ExpenseRow[];
  supplierInvoices: SupplierInvoiceRow[];
}): ProfitabilityResult {
  // Seules les factures VALIDÉES (finalized/converted) comptent — exclut les brouillons
  const factures = params.documents.filter(
    (d) => d.document_type === 'facture' && (d.status === 'finalized' || d.status === 'converted'),
  );

  const revenueHT = factures.reduce((s, f) => {
    const ht = num(f.subtotal_ht);
    if (ht > 0) return s + ht;
    // fallback : total_ttc − tva_amount si HT absent
    const ttc = num(f.total_ttc);
    const tva = num(f.tva_amount);
    return s + Math.max(0, ttc - tva);
  }, 0);

  // Dépenses non déjà comptées via une facture fournisseur
  const standaloneExpenses = params.expenses.filter((e) => !e.supplier_invoice_id);
  const expensesHT = standaloneExpenses.reduce((s, e) => s + expenseToHT(e), 0);
  const supplierHT = params.supplierInvoices.reduce((s, i) => s + num(i.amount_ht), 0);
  const costsHT = expensesHT + supplierHT;
  const marginHT = revenueHT - costsHT;
  const marginRate = revenueHT > 0 ? marginHT / revenueHT : null;

  const incompleteReasons: string[] = [];
  const missingType = standaloneExpenses.filter((e) => !e.amount_type).length;
  if (missingType > 0) {
    incompleteReasons.push(
      `${missingType} dépense${missingType > 1 ? 's' : ''} sans mention HT/TTC`,
    );
  }
  if (revenueHT <= 0) {
    incompleteReasons.push('Aucune facture rattachée à ce chantier');
  }

  let status: ProfitabilityStatus;
  if (incompleteReasons.length > 0) {
    status = 'incomplet';
  } else if (marginHT < 0) {
    status = 'deficitaire';
  } else if (marginRate !== null && marginRate < 0.15) {
    status = 'surveiller';
  } else {
    status = 'rentable';
  }

  return {
    revenueHT,
    expensesHT,
    supplierHT,
    costsHT,
    marginHT,
    marginRate,
    status,
    incompleteReasons,
  };
}

export const statusLabelFR: Record<ProfitabilityStatus, string> = {
  rentable: 'Rentable',
  surveiller: 'À surveiller',
  deficitaire: 'Déficitaire',
  incomplet: 'Incomplet',
};
