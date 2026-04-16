/**
 * Bilingual translation for payment milestone labels.
 * Local dictionary only — no network calls, no loops.
 *
 * The French label remains the source of truth used in PDFs.
 * Arabic is purely a UI helper. If the user edits the Arabic field
 * and the value matches a known Arabic phrase, we map it back to
 * the canonical French phrase. Otherwise we keep the previous
 * French value (so PDF output stays in French).
 */

const FR_TO_AR: Record<string, string> = {
  "acompte à la commande": "دفعة مقدمة عند الطلب",
  "acompte": "دفعة مقدمة",
  "acompte de démarrage": "دفعة بداية الشغل",
  "début des travaux": "بداية الشغل",
  "fin de gros œuvre": "نهاية الأشغال الكبرى",
  "fin de second œuvre": "نهاية الأشغال الثانوية",
  "milieu de chantier": "نص الشانتي",
  "réception des travaux": "استلام الشغل",
  "remise des clés": "تسليم المفاتيح",
  "solde final": "الدفعة الأخيرة",
  "solde": "الدفعة الأخيرة",
  "paiement final": "الدفعة الأخيرة",
  "livraison": "التسليم",
  "signature du devis": "توقيع الديفي",
};

const normalize = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, ' ');

const AR_TO_FR: Record<string, string> = Object.entries(FR_TO_AR).reduce(
  (acc, [fr, ar]) => {
    acc[normalize(ar)] = fr.charAt(0).toUpperCase() + fr.slice(1);
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Returns an Arabic display for a French milestone label.
 * If unknown, returns an empty string (UI shows placeholder).
 */
export const milestoneLabelToArabic = (frenchLabel: string): string => {
  if (!frenchLabel) return '';
  return FR_TO_AR[normalize(frenchLabel)] ?? '';
};

/**
 * Maps an Arabic edit back to its canonical French label.
 * If the Arabic value is unknown, keeps the previous French label
 * (so the PDF stays in French and we never overwrite with Arabic).
 */
export const arabicMilestoneLabelToFrench = (
  arabicValue: string,
  previousFrench: string
): string => {
  const key = normalize(arabicValue);
  if (!key) return previousFrench;
  return AR_TO_FR[key] ?? previousFrench;
};

/**
 * Translates Arabic input to French for display in the read-only FR field.
 * - If Arabic matches a known phrase, returns the canonical French label.
 * - If Arabic is empty, returns an empty string.
 * - Otherwise returns an empty string (FR field stays blank until a known
 *   Arabic phrase is typed). The caller is responsible for falling back to
 *   the raw Arabic value when persisting, so the PDF never loses data.
 */
export const arabicToFrenchDisplay = (arabicValue: string): string => {
  const key = normalize(arabicValue);
  if (!key) return '';
  return AR_TO_FR[key] ?? '';
};
