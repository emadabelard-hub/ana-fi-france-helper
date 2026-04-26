/**
 * Auto-save draft system for Devis & Facture forms.
 * Persists form data to both localStorage (offline) and Supabase cloud (cross-device).
 */

import { supabase } from '@/integrations/supabase/client';

const DRAFT_KEY = 'invoice_draft_v1';
const CURRENT_DOCUMENT_KEY = 'currentDocument';
// Per-document persistent drafts (one slot per type)
const CURRENT_DOCUMENT_KEY_BY_TYPE = (type: 'devis' | 'facture') => `currentDocument_${type}_v1`;
const ACTIVE_DRAFT_USER_KEY = 'invoice_draft_active_user_v1';
const LEGACY_BROWSER_DRAFT_KEYS = [
  DRAFT_KEY,
  CURRENT_DOCUMENT_KEY,
  CURRENT_DOCUMENT_KEY_BY_TYPE('devis'),
  CURRENT_DOCUMENT_KEY_BY_TYPE('facture'),
  'current_invoice_document',
];
// Drafts older than 48h are considered stale and offered for cleanup
export const DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
// Browser event broadcast on every successful auto-save (used by AutoSaveIndicator)
export const DRAFT_SAVED_EVENT = 'invoice-draft:saved';

const getActiveDraftUserId = () => {
  try {
    return sessionStorage.getItem(ACTIVE_DRAFT_USER_KEY);
  } catch {
    return null;
  }
};

const getScopedDraftKey = (key: string) => {
  const userId = getActiveDraftUserId();
  return userId ? `${key}:${userId}` : null;
};

const removeBrowserKeys = (keys: string[]) => {
  for (const key of keys) {
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.removeItem(key); } catch {}
  }
};

const clearLegacyBrowserDrafts = () => removeBrowserKeys(LEGACY_BROWSER_DRAFT_KEYS);

export const clearInvoiceDraftBrowserState = () => {
  const userId = getActiveDraftUserId();
  const scopedKeys = userId ? LEGACY_BROWSER_DRAFT_KEYS.map((key) => `${key}:${userId}`) : [];
  removeBrowserKeys([
    ...LEGACY_BROWSER_DRAFT_KEYS,
    ...scopedKeys,
    'quoteToInvoiceData',
    'imageQuoteToInvoiceData',
    'invoiceCreator_scroll_v1',
    'lineItemEditor_items_v1',
  ]);
};

export const setInvoiceDraftStorageUser = (userId: string | null) => {
  const previousUserId = getActiveDraftUserId();

  if (!userId) {
    clearInvoiceDraftBrowserState();
    try { sessionStorage.removeItem(ACTIVE_DRAFT_USER_KEY); } catch {}
    return;
  }

  if (previousUserId && previousUserId !== userId) {
    clearInvoiceDraftBrowserState();
  }

  try { sessionStorage.setItem(ACTIVE_DRAFT_USER_KEY, userId); } catch {}
  clearLegacyBrowserDrafts();
};

const broadcastDraftSaved = (documentType: 'devis' | 'facture') => {
  try {
    window.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail: { documentType, at: Date.now() } }));
  } catch {
    // SSR / non-browser env — ignore
  }
};

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
  descriptionChantierAr?: string;
  descriptionChantierFr?: string;
  estimatedStartDate?: string;
  estimatedDuration?: string;
  discountEnabled?: boolean;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  /** Garantie sur les travaux (toggle dans l'étape Conditions de règlement) */
  garantieEnabled?: boolean;
  garantieYears?: 1 | 2 | 10;
  currentStep?: number;
  savedAt: number;
}

export interface CurrentDocumentState extends InvoiceDraft {
  selectedClientId?: string;
  selectedChantierId?: string;
  dueDateDays?: 15 | 30 | 45 | 60;
  projectTvaType?: 'logement' | 'logement_ancien' | 'logement_neuf' | 'local_pro' | 'sous_traitance' | 'intracommunautaire';
  milestonesEnabled?: boolean;
  currentStep?: number;
  showPreview?: boolean;
  showArabic?: boolean;
  includePhotosInPdf?: boolean;
  sitePhotos?: Array<{ data: string; name: string }>;
  tempValues?: Record<string, { quantity?: string; unitPrice?: string }>;
}

// ── Local Storage (offline fallback) ──

export const saveDraft = (draft: Omit<InvoiceDraft, 'savedAt'>) => {
  try {
    const key = getScopedDraftKey(DRAFT_KEY);
    if (!key) return;
    const data: InvoiceDraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(data));
    broadcastDraftSaved(draft.documentType);
  } catch (e) {
    console.warn('Failed to save draft:', e);
  }
  // Fire-and-forget cloud save
  saveCloudDraft(draft).catch(() => {});
};

export const loadDraft = (): InvoiceDraft | null => {
  try {
    const key = getScopedDraftKey(DRAFT_KEY);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft: InvoiceDraft = JSON.parse(raw);
    // Expire drafts older than 48h
    if (Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
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
    const key = getScopedDraftKey(DRAFT_KEY);
    if (key) localStorage.removeItem(key);
    localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.warn('Failed to clear draft:', e);
  }
  // Fire-and-forget cloud clear
  clearCloudDraft().catch(() => {});
};

export const saveCurrentDocument = (document: Omit<CurrentDocumentState, 'savedAt'>) => {
  try {
    const genericKey = getScopedDraftKey(CURRENT_DOCUMENT_KEY);
    const typedKey = getScopedDraftKey(CURRENT_DOCUMENT_KEY_BY_TYPE(document.documentType));
    if (!genericKey || !typedKey) return;
    // Only save if there's meaningful content (avoid persisting empty shells)
    const hasMeaningfulCurrentDocument =
      !!document.clientName?.trim() ||
      !!document.clientAddress?.trim() ||
      (document.items && document.items.length > 0 && document.items.some(i => i.designation_fr?.trim() || i.designation_ar?.trim() || i.unitPrice > 0)) ||
      !!document.descriptionChantier?.trim() ||
      !!document.descriptionChantierFr?.trim() ||
      !!document.descriptionChantierAr?.trim();

    if (!hasMeaningfulCurrentDocument) {
      return;
    }

    const data: CurrentDocumentState = { ...document, savedAt: Date.now() };
    const serialized = JSON.stringify(data);
    // Generic slot (last touched, all types) for legacy callers
    localStorage.setItem(genericKey, serialized);
    // Per-type slot (multi-document support)
    localStorage.setItem(typedKey, serialized);
    broadcastDraftSaved(document.documentType);
  } catch (e) {
    console.warn('Failed to save current document:', e);
  }
};

export const loadCurrentDocument = (documentType?: 'devis' | 'facture'): CurrentDocumentState | null => {
  try {
    const genericKey = getScopedDraftKey(CURRENT_DOCUMENT_KEY);
    if (!genericKey) return null;
    // Prefer per-type slot when a type is requested
    if (documentType) {
      const typedKey = getScopedDraftKey(CURRENT_DOCUMENT_KEY_BY_TYPE(documentType));
      const rawTyped = typedKey ? localStorage.getItem(typedKey) : null;
      if (rawTyped) {
        const doc = JSON.parse(rawTyped) as CurrentDocumentState;
        if (doc.documentType === documentType) return doc;
      }
    }

    const raw = localStorage.getItem(genericKey);
    if (!raw) return null;

    const document: CurrentDocumentState = JSON.parse(raw);
    if (documentType && document.documentType !== documentType) return null;

    return document;
  } catch (e) {
    console.warn('Failed to load current document:', e);
    return null;
  }
};

export const clearCurrentDocument = (documentType?: 'devis' | 'facture') => {
  try {
    const genericKey = getScopedDraftKey(CURRENT_DOCUMENT_KEY);
    if (documentType) {
      const typedKey = getScopedDraftKey(CURRENT_DOCUMENT_KEY_BY_TYPE(documentType));
      if (typedKey) localStorage.removeItem(typedKey);
      localStorage.removeItem(CURRENT_DOCUMENT_KEY_BY_TYPE(documentType));
      // Clear generic slot only if it pointed to the same type
      try {
        const raw = genericKey ? localStorage.getItem(genericKey) : null;
        if (raw) {
          const doc = JSON.parse(raw) as CurrentDocumentState;
          if (doc.documentType === documentType && genericKey) localStorage.removeItem(genericKey);
        }
      } catch {
        if (genericKey) localStorage.removeItem(genericKey);
      }
      return;
    }
    // No type → wipe everything
    const scopedKeys = [CURRENT_DOCUMENT_KEY, CURRENT_DOCUMENT_KEY_BY_TYPE('devis'), CURRENT_DOCUMENT_KEY_BY_TYPE('facture')]
      .map(getScopedDraftKey)
      .filter(Boolean) as string[];
    removeBrowserKeys([CURRENT_DOCUMENT_KEY, CURRENT_DOCUMENT_KEY_BY_TYPE('devis'), CURRENT_DOCUMENT_KEY_BY_TYPE('facture'), ...scopedKeys]);
  } catch (e) {
    console.warn('Failed to clear current document:', e);
  }
};

export interface AvailableDraftSummary {
  documentType: 'devis' | 'facture';
  savedAt: number;
  isStale: boolean;
  clientName: string;
  itemsCount: number;
  currentStep: number;
}

/**
 * List all available local drafts (one per document type), with metadata
 * to power the resume modal.
 */
export const listAvailableDrafts = (): AvailableDraftSummary[] => {
  const result: AvailableDraftSummary[] = [];
  const types: Array<'devis' | 'facture'> = ['devis', 'facture'];
  const now = Date.now();
  for (const type of types) {
    try {
      const key = getScopedDraftKey(CURRENT_DOCUMENT_KEY_BY_TYPE(type));
      if (!key) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const doc = JSON.parse(raw) as CurrentDocumentState;
      if (!doc || doc.documentType !== type) continue;
      const hasContent =
        !!doc.clientName?.trim() ||
        !!doc.clientAddress?.trim() ||
        (doc.items?.length ?? 0) > 0 ||
        !!doc.descriptionChantier?.trim();
      if (!hasContent) continue;
      result.push({
        documentType: type,
        savedAt: doc.savedAt ?? 0,
        isStale: now - (doc.savedAt ?? 0) > DRAFT_MAX_AGE_MS,
        clientName: doc.clientName?.trim() || '',
        itemsCount: doc.items?.length ?? 0,
        currentStep: doc.currentStep ?? 0,
      });
    } catch (err) {
      console.warn('Failed to read draft summary:', err);
    }
  }
  // Most recent first
  return result.sort((a, b) => b.savedAt - a.savedAt);
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
