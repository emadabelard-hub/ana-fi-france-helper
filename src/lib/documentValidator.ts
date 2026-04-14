/**
 * Document Validator — Expert-comptable level validation for Devis/Factures.
 * Auto-fixes language, TVA, units, prices, and descriptions silently.
 * Returns corrected data + list of applied corrections.
 */

import { containsArabic, isMainlyArabic, quickTranslateArabic, improveFrenchDescription } from './objetFormatter';

// Valid TVA rates in France
const VALID_TVA_RATES = [0, 5.5, 10, 20];

// Unit validation map: keyword → correct unit
const UNIT_CORRECTIONS: Record<string, string> = {
  'm2': 'm²',
  'M2': 'm²',
  'mètre carré': 'm²',
  'mètres carrés': 'm²',
  'metre carre': 'm²',
  'ML': 'ml',
  'mètre linéaire': 'ml',
  'mètres linéaires': 'ml',
  'metre lineaire': 'ml',
  'unité': 'U',
  'unités': 'U',
  'unite': 'U',
  'pièce': 'U',
  'pièces': 'U',
  'heure': 'h',
  'heures': 'h',
  'H': 'h',
  'jour': 'j',
  'jours': 'j',
  'J': 'j',
  'Forfait': 'forfait',
  'FORFAIT': 'forfait',
  'F': 'forfait',
  'f': 'forfait',
  'lot': 'lot',
  'LOT': 'lot',
  'ens': 'ens',
  'ENS': 'ens',
  'ensemble': 'ens',
};

// Work type → expected unit mapping for sanity checks
const WORK_UNIT_HINTS: Array<{ keywords: string[]; expectedUnit: string; wrongUnits: string[] }> = [
  { keywords: ['fissure', 'fissures', 'rebouchage fissure', 'traitement fissure'], expectedUnit: 'ml', wrongUnits: ['m²'] },
  { keywords: ['plinthe', 'plinthes', 'pose de plinthe'], expectedUnit: 'ml', wrongUnits: ['m²', 'U'] },
  { keywords: ['gouttière', 'chéneau'], expectedUnit: 'ml', wrongUnits: ['m²'] },
  { keywords: ['canalisation', 'tuyauterie', 'tuyau'], expectedUnit: 'ml', wrongUnits: ['m²'] },
  { keywords: ['porte', 'fenêtre', 'velux', 'volet', 'radiateur', 'wc', 'lavabo', 'évier', 'robinet', 'interrupteur', 'prise'], expectedUnit: 'U', wrongUnits: ['m²', 'ml'] },
];

// BTP price sanity ranges (€ HT per unit)
const PRICE_RANGES: Record<string, { min: number; max: number }> = {
  'peinture_m2': { min: 8, max: 45 },
  'carrelage_m2': { min: 20, max: 80 },
  'enduit_m2': { min: 10, max: 35 },
  'demolition_m2': { min: 10, max: 50 },
  'placo_m2': { min: 25, max: 65 },
  'isolation_m2': { min: 15, max: 60 },
  'nettoyage_m2': { min: 2, max: 15 },
  'deplacement_forfait': { min: 20, max: 150 },
  'generic_h': { min: 25, max: 80 },
  'generic_j': { min: 200, max: 600 },
};

// Weak/unprofessional descriptions → professional replacements
const DESCRIPTION_UPGRADES: Array<[RegExp, string]> = [
  [/^peinture$/i, 'Application de peinture'],
  [/^enduit$/i, 'Application d\'enduit de rebouchage et lissage'],
  [/^ponçage$/i, 'Ponçage des surfaces'],
  [/^nettoyage$/i, 'Nettoyage de fin de chantier'],
  [/^dépose$/i, 'Dépose et évacuation'],
  [/^pose$/i, 'Fourniture et pose'],
  [/^carrelage$/i, 'Fourniture et pose de carrelage'],
  [/^plomberie$/i, 'Travaux de plomberie'],
  [/^electricite$/i, 'Travaux d\'électricité'],
  [/^électricité$/i, 'Travaux d\'électricité'],
  [/^demolition$/i, 'Travaux de démolition et évacuation des gravats'],
  [/^démolition$/i, 'Travaux de démolition et évacuation des gravats'],
  [/^sous[- ]?couche$/i, 'Application de sous-couche / primaire d\'accrochage'],
  [/^ragréage$/i, 'Ragréage auto-lissant du sol'],
  [/^bandes?\s*(à\s*)?joint/i, 'Pose de bandes à joint et finition'],
  [/^fa[çc]ade$/i, 'Ravalement de façade'],
];

export interface DocumentItem {
  id: string;
  designation_fr: string;
  designation_ar?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface ValidationCorrection {
  field: string;
  original: string;
  corrected: string;
  reason: string;
}

export interface ValidatedDocumentResult {
  items: DocumentItem[];
  tvaRate: number;
  corrections: ValidationCorrection[];
}

/**
 * Normalize a unit string to a standard form.
 */
function normalizeUnit(unit: string): string {
  const trimmed = unit.trim();
  if (UNIT_CORRECTIONS[trimmed]) return UNIT_CORRECTIONS[trimmed];
  return trimmed;
}

/**
 * Find nearest valid TVA rate.
 */
function nearestValidTvaRate(rate: number): number {
  if (VALID_TVA_RATES.includes(rate)) return rate;
  let closest = 0;
  let minDiff = Math.abs(rate - 0);
  for (const valid of VALID_TVA_RATES) {
    const diff = Math.abs(rate - valid);
    if (diff < minDiff) {
      minDiff = diff;
      closest = valid;
    }
  }
  return closest;
}

/**
 * Detect price category for sanity checking.
 */
function detectPriceCategory(designation: string, unit: string): string | null {
  const lower = designation.toLowerCase();
  const u = unit.toLowerCase();

  if (u === 'h') return 'generic_h';
  if (u === 'j') return 'generic_j';
  if (lower.includes('déplacement') || lower.includes('transport')) return 'deplacement_forfait';

  if (u === 'm²') {
    if (lower.includes('peinture') || lower.includes('sous-couche') || lower.includes('primaire')) return 'peinture_m2';
    if (lower.includes('carrelage') || lower.includes('faïence')) return 'carrelage_m2';
    if (lower.includes('enduit') || lower.includes('rebouchage')) return 'enduit_m2';
    if (lower.includes('démolition') || lower.includes('dépose')) return 'demolition_m2';
    if (lower.includes('placo') || lower.includes('cloison')) return 'placo_m2';
    if (lower.includes('isolation')) return 'isolation_m2';
    if (lower.includes('nettoyage')) return 'nettoyage_m2';
  }

  return null;
}

/**
 * Upgrade a weak designation to a professional one.
 */
function upgradeDesignation(designation: string): string {
  let result = designation.trim();

  // Translate Arabic first
  if (isMainlyArabic(result)) {
    const translated = quickTranslateArabic(result);
    if (translated) {
      result = improveFrenchDescription(translated);
    }
  } else if (containsArabic(result)) {
    // Mixed: remove Arabic, keep French
    result = result.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '').replace(/\s+/g, ' ').trim();
  }

  // Apply professional upgrades
  for (const [pattern, replacement] of DESCRIPTION_UPGRADES) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      break;
    }
  }

  // Capitalize first letter
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  return result;
}

/**
 * Check if a unit is wrong for a given work type and suggest correction.
 */
function checkUnitConsistency(designation: string, currentUnit: string): string | null {
  const lower = designation.toLowerCase();
  for (const hint of WORK_UNIT_HINTS) {
    if (hint.keywords.some(kw => lower.includes(kw))) {
      if (hint.wrongUnits.includes(currentUnit)) {
        return hint.expectedUnit;
      }
    }
  }
  return null;
}

/**
 * Validate and auto-fix an entire document's items + TVA.
 * All corrections are applied silently and logged.
 */
export function validateDocument(
  items: DocumentItem[],
  tvaRate: number,
  tvaExempt: boolean
): ValidatedDocumentResult {
  const corrections: ValidationCorrection[] = [];

  // 1. Validate TVA rate
  let correctedTvaRate = tvaRate;
  if (!tvaExempt) {
    const nearest = nearestValidTvaRate(tvaRate);
    if (nearest !== tvaRate) {
      corrections.push({
        field: 'TVA',
        original: `${tvaRate}%`,
        corrected: `${nearest}%`,
        reason: `Taux TVA invalide (${tvaRate}%), corrigé au taux le plus proche`,
      });
      correctedTvaRate = nearest;
    }
  }

  // 2. Validate and fix each item
  const correctedItems = items.map((item) => {
    const corrected = { ...item };

    // 2a. Désignation : source de vérité utilisateur — ne jamais modifier automatiquement

    // 2b. Unit normalization
    const normalizedUnit = normalizeUnit(corrected.unit);
    if (normalizedUnit !== corrected.unit) {
      corrections.push({
        field: 'Unité',
        original: corrected.unit,
        corrected: normalizedUnit,
        reason: 'Unité normalisée',
      });
      corrected.unit = normalizedUnit;
    }

    // 2c. Unit consistency check
    const suggestedUnit = checkUnitConsistency(corrected.designation_fr, corrected.unit);
    if (suggestedUnit) {
      corrections.push({
        field: 'Unité',
        original: corrected.unit,
        corrected: suggestedUnit,
        reason: `Unité "${corrected.unit}" incohérente pour "${corrected.designation_fr}", corrigée en "${suggestedUnit}"`,
      });
      corrected.unit = suggestedUnit;
    }

    // 2d. Price sanity check
    const category = detectPriceCategory(corrected.designation_fr, corrected.unit);
    if (category && PRICE_RANGES[category]) {
      const range = PRICE_RANGES[category];
      if (corrected.unitPrice > 0 && corrected.unitPrice < range.min) {
        corrections.push({
          field: 'Prix unitaire',
          original: `${corrected.unitPrice.toFixed(2)} €`,
          corrected: `${range.min.toFixed(2)} €`,
          reason: `Prix trop bas pour ${category} (min ${range.min} €)`,
        });
        corrected.unitPrice = range.min;
      } else if (corrected.unitPrice > range.max * 2) {
        // Only flag extreme outliers (>2x max)
        corrections.push({
          field: 'Prix unitaire',
          original: `${corrected.unitPrice.toFixed(2)} €`,
          corrected: `${range.max.toFixed(2)} €`,
          reason: `Prix anormalement élevé pour ${category} (max recommandé ${range.max} €)`,
        });
        corrected.unitPrice = range.max;
      }
    }

    // 2e. Quantity sanity (must be > 0)
    if (corrected.quantity <= 0) {
      corrections.push({
        field: 'Quantité',
        original: `${corrected.quantity}`,
        corrected: '1',
        reason: 'Quantité invalide, corrigée à 1',
      });
      corrected.quantity = 1;
    }

    // 2f. Recalculate total
    const newTotal = Math.round(corrected.quantity * corrected.unitPrice * 100) / 100;
    if (Math.abs(newTotal - corrected.total) > 0.01) {
      corrected.total = newTotal;
    }

    return corrected;
  });

  return {
    items: correctedItems,
    tvaRate: correctedTvaRate,
    corrections,
  };
}
