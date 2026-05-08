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

export interface TaxComputation {
  statusKind: StatusKind;
  socialCharges: number;     // URSSAF / TNS / charges gérant
  socialChargesRate: number; // pourcentage affiché
  socialChargesLabelFr: string;
  socialChargesLabelAr: string;
  incomeTax: number;         // IS (uniquement société)
  incomeTaxLabelFr: string;
  incomeTaxLabelAr: string;
  beneficeNet: number;
}

/**
 * Compute social charges + income tax based on status.
 * - Auto-entrepreneur: URSSAF = 21.2% du CA HT, pas d'IS
 * - EI/EIRL: TNS = 40% du bénéfice, pas d'IS (IR géré ailleurs)
 * - Société: charges gérant = 45% du bénéfice net, IS 15% jusqu'à 42 500€ puis 25%
 */
export const computeTaxes = (params: {
  legalStatus?: string | null;
  caHT: number;
  depensesHT: number;
  urssafRateOverride?: number; // pour AE custom
}): TaxComputation => {
  const { legalStatus, caHT, depensesHT, urssafRateOverride } = params;
  const kind = resolveStatusKind(legalStatus);
  const beneficeBrut = Math.max(0, caHT - depensesHT);

  if (kind === 'auto-entrepreneur') {
    const rate = urssafRateOverride ?? 21.2;
    const social = caHT * (rate / 100);
    return {
      statusKind: kind,
      socialCharges: social,
      socialChargesRate: rate,
      socialChargesLabelFr: 'URSSAF estimée',
      socialChargesLabelAr: 'URSSAF المقدرة',
      incomeTax: 0,
      incomeTaxLabelFr: '',
      incomeTaxLabelAr: '',
      beneficeNet: Math.max(0, caHT - depensesHT - social),
    };
  }

  if (kind === 'ei') {
    const rate = 40;
    const social = beneficeBrut * (rate / 100);
    return {
      statusKind: kind,
      socialCharges: social,
      socialChargesRate: rate,
      socialChargesLabelFr: 'Cotisations TNS',
      socialChargesLabelAr: 'cotisations TNS',
      incomeTax: 0,
      incomeTaxLabelFr: '',
      incomeTaxLabelAr: '',
      beneficeNet: Math.max(0, beneficeBrut - social),
    };
  }

  if (kind === 'societe') {
    // IS sur bénéfice brut : 15% jusqu'à 42 500€, 25% au-delà
    const beneficeAvantIS = beneficeBrut;
    const isReduit = Math.min(beneficeAvantIS, 42500) * 0.15;
    const isPlein = Math.max(0, beneficeAvantIS - 42500) * 0.25;
    const incomeTax = isReduit + isPlein;
    const beneficeApresIS = Math.max(0, beneficeAvantIS - incomeTax);
    // Charges sociales gérant : 45% du bénéfice net après IS
    const socialRate = 45;
    const social = beneficeApresIS * (socialRate / 100);
    return {
      statusKind: kind,
      socialCharges: social,
      socialChargesRate: socialRate,
      socialChargesLabelFr: 'Charges sociales gérant',
      socialChargesLabelAr: 'الأعباء الاجتماعية',
      incomeTax,
      incomeTaxLabelFr: 'Impôt société (IS)',
      incomeTaxLabelAr: 'ضريبة الشركات',
      beneficeNet: Math.max(0, beneficeApresIS - social),
    };
  }

  // Fallback : comportement AE par défaut
  const rate = urssafRateOverride ?? 21.2;
  const social = caHT * (rate / 100);
  return {
    statusKind: 'unknown',
    socialCharges: social,
    socialChargesRate: rate,
    socialChargesLabelFr: 'URSSAF estimée',
    socialChargesLabelAr: 'URSSAF المقدرة',
    incomeTax: 0,
    incomeTaxLabelFr: '',
    incomeTaxLabelAr: '',
    beneficeNet: Math.max(0, caHT - depensesHT - social),
  };
};
