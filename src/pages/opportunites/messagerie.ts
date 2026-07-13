// Small shared helpers for the opportunités messagerie feature.
export const PENDING_CONTACT_KEY = 'anafypro:pending_contact_annonce';

export const setPendingContact = (annonceId: string) => {
  try { sessionStorage.setItem(PENDING_CONTACT_KEY, annonceId); } catch { /* ignore */ }
};

export const readPendingContact = (): string | null => {
  try { return sessionStorage.getItem(PENDING_CONTACT_KEY); } catch { return null; }
};

export const clearPendingContact = () => {
  try { sessionStorage.removeItem(PENDING_CONTACT_KEY); } catch { /* ignore */ }
};
