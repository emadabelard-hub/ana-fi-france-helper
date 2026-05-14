/**
 * Tax / social charges calculation per legal status.
 * Inputs HT-based.
 */

export type StatusKind = 'auto-entrepreneur' | 'societe' | 'ei' | 'unknown';

export const resolveStatusKind = (legalStatus?: string | null): StatusKind => {
  const s = (legalStatus || '').toLowerCase().trim();
  if (!s) return 'unknown';
  if (s.includes('auto') || s === 'ae' || s.includes('micro')) return 'auto-entrepreneur';
  if (s === 'ei' || s === 'eirl' || s.includes('entrepreneur individuel')) return 'ei';
  if (
    s.includes('sarl') || s.includes('sas') || s.includes('eurl') || s.includes('sasu') ||
    s.includes('société') || s.includes('societe') || s.includes('sa ')
  ) return 'societe';
  return 'unknown';
};

/**
 * Tax computation helpers removed per request.
 * Kept: status kind resolver only.
 */
