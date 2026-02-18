/**
 * Auto-save draft system for Devis & Facture forms.
 * Persists form data to localStorage and restores on return.
 */

const DRAFT_KEY = 'invoice_draft_v1';

export interface InvoiceDraft {
  documentType: 'devis' | 'facture';
  clientName: string;
  clientAddress: string;
  workSiteSameAsClient: boolean;
  workSiteAddress: string;
  includeTravelCosts: boolean;
  travelDescription: string;
  travelPrice: number;
  isAutoEntrepreneur: boolean;
  selectedTvaRate: 5.5 | 10 | 20;
  validityDuration: 15 | 30 | 60 | 90;
  acomptePercent: number;
  delaiPaiement: string;
  moyenPaiement: string;
  docNumber: string;
  items: Array<{
    id: string;
    designation_fr: string;
    designation_ar: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;
  savedAt: number;
}

export const saveDraft = (draft: Omit<InvoiceDraft, 'savedAt'>) => {
  try {
    const data: InvoiceDraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save draft:', e);
  }
};

export const loadDraft = (): InvoiceDraft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft: InvoiceDraft = JSON.parse(raw);
    // Expire drafts older than 7 days
    if (Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) {
      clearDraft();
      return null;
    }
    return draft;
  } catch (e) {
    console.warn('Failed to load draft:', e);
    return null;
  }
};

export const clearDraft = () => {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.warn('Failed to clear draft:', e);
  }
};
