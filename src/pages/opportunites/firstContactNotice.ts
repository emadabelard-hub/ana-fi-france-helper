const KEY = 'anafypro:opp:first_contact_seen_v1';
export const hasSeenFirstContact = () => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
};
export const markFirstContactSeen = () => {
  try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
};
