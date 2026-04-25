/**
 * Auto-save draft system for CV Generator (POINT 7).
 * Mirrors invoiceDraftStorage logic: localStorage persistence, 48h TTL,
 * `cv-draft:saved` broadcast for the AutoSave badge, visibilitychange flush.
 */

import type { CVData } from '@/pages/CVGeneratorPage';

const CV_DRAFT_KEY = 'cv_draft_v1';
export const CV_DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const CV_DRAFT_SAVED_EVENT = 'cv-draft:saved';

export interface CVDraft {
  data: CVData;
  savedAt: number;
}

const broadcast = () => {
  try {
    window.dispatchEvent(new CustomEvent(CV_DRAFT_SAVED_EVENT, { detail: { at: Date.now() } }));
  } catch {
    /* SSR / non-browser env */
  }
};

const hasMeaningfulCV = (data: CVData): boolean => {
  return (
    !!data.fullName?.trim() ||
    !!data.profession?.trim() ||
    !!data.email?.trim() ||
    !!data.phone?.trim() ||
    !!data.summary?.trim() ||
    (data.experiences?.length ?? 0) > 0 ||
    (data.education?.length ?? 0) > 0 ||
    (data.skills?.length ?? 0) > 0 ||
    (data.languages?.length ?? 0) > 0
  );
};

export const saveCVDraft = (data: CVData) => {
  try {
    if (!hasMeaningfulCV(data)) return;
    const draft: CVDraft = { data, savedAt: Date.now() };
    localStorage.setItem(CV_DRAFT_KEY, JSON.stringify(draft));
    broadcast();
  } catch (e) {
    console.warn('Failed to save CV draft:', e);
  }
};

export const loadCVDraft = (): CVDraft | null => {
  try {
    const raw = localStorage.getItem(CV_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CVDraft;
    // Expire after 48h
    if (Date.now() - draft.savedAt > CV_DRAFT_MAX_AGE_MS) {
      clearCVDraft();
      return null;
    }
    return draft;
  } catch (e) {
    console.warn('Failed to load CV draft:', e);
    return null;
  }
};

export const clearCVDraft = () => {
  try {
    localStorage.removeItem(CV_DRAFT_KEY);
  } catch (e) {
    console.warn('Failed to clear CV draft:', e);
  }
};
