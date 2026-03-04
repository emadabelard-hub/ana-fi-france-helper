/**
 * Auto-save draft system for Devis & Facture forms.
 * Persists form data to both localStorage (offline) and Supabase cloud (cross-device).
 */

import { supabase } from '@/integrations/supabase/client';

const DRAFT_KEY = 'invoice_draft_v1';

export interface DraftPaymentMilestone {
  id: string;
  label: string;
  mode: 'percent' | 'fixed';
  percent?: number;
  amount?: number;
  targetDate?: string;
}

export interface InvoiceDraft {
  documentType: 'devis' | 'facture';
  clientName: string;
  clientAddress: string;
  clientSiren?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientTvaIntra?: string;
  clientIsB2B?: boolean;
  workSiteSameAsClient: boolean;
  workSiteAddress: string;
  includeTravelCosts: boolean;
  travelDescription: string;
  travelPrice: number;
  includeWasteCosts?: boolean;
  wasteDescription?: string;
  wastePrice?: number;
  isAutoEntrepreneur: boolean;
  selectedTvaRate: 5.5 | 10 | 20;
  validityDuration: 15 | 30 | 60 | 90;
  acompteEnabled?: boolean;
  acomptePercent: number;
  acompteMode?: 'percent' | 'fixed';
  acompteFixedAmount?: number;
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
  natureOperation?: 'service' | 'goods' | 'mixed';
  assureurName?: string;
  assureurAddress?: string;
  policyNumber?: string;
  geographicCoverage?: string;
  paymentMilestones?: DraftPaymentMilestone[];
  descriptionChantier?: string;
  estimatedStartDate?: string;
  estimatedDuration?: string;
  savedAt: number;
}

// ── Local Storage (offline fallback) ──

export const saveDraft = (draft: Omit<InvoiceDraft, 'savedAt'>) => {
  try {
    const data: InvoiceDraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save draft:', e);
  }
  // Fire-and-forget cloud save
  saveCloudDraft(draft).catch(() => {});
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
  // Fire-and-forget cloud clear
  clearCloudDraft().catch(() => {});
};

// ── Cloud Storage (Supabase) ──

export const saveCloudDraft = async (draft: Omit<InvoiceDraft, 'savedAt'>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const draftData: InvoiceDraft = { ...draft, savedAt: Date.now() };

  await (supabase as any).from('invoice_drafts').upsert(
    {
      user_id: user.id,
      document_type: draft.documentType,
      draft_data: draftData,
    },
    { onConflict: 'user_id,document_type' }
  );
};

export const loadCloudDraft = async (documentType?: 'devis' | 'facture'): Promise<InvoiceDraft | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let query = (supabase as any).from('invoice_drafts')
    .select('draft_data')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (documentType) {
    query = query.eq('document_type', documentType);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  const draft = data.draft_data as InvoiceDraft;
  // Expire drafts older than 30 days in cloud
  if (Date.now() - draft.savedAt > 30 * 24 * 60 * 60 * 1000) {
    return null;
  }
  return draft;
};

export const clearCloudDraft = async (documentType?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  let query = (supabase as any).from('invoice_drafts')
    .delete()
    .eq('user_id', user.id);

  if (documentType) {
    query = query.eq('document_type', documentType);
  }

  await query;
};
