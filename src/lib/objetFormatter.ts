/**
 * Objet field formatter: ensures professional French text for devis/facture.
 * - Detects Arabic input and translates to professional French
 * - Improves raw French text to professional descriptions
 */

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function containsArabic(text: string): boolean {
  return ARABIC_REGEX.test(text);
}

export function isMainlyArabic(text: string): boolean {
  const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  const totalAlpha = (text.match(/[a-zA-ZÀ-ÿ\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  return totalAlpha > 0 && arabicChars / totalAlpha > 0.5;
}

// Common Arabic BTP terms → professional French
const ARABIC_TO_FRENCH: Record<string, string> = {
  'دهان': 'peinture',
  'صباغة': 'peinture',
  'بوية': 'peinture',
  'طلاء': 'peinture',
  'حيط': 'murs',
  'حيطان': 'murs',
  'جدران': 'murs',
  'سقف': 'plafond',
  'أرض': 'sol',
  'أرضية': 'sol',
  'بلاط': 'carrelage',
  'زليج': 'carrelage',
  'سيراميك': 'carrelage',
  'كهرباء': 'électricité',
  'سباكة': 'plomberie',
  'بلومبري': 'plomberie',
  'ترميم': 'rénovation',
  'تجديد': 'rénovation',
  'هدم': 'démolition',
  'عزل': 'isolation',
  'جبس': 'plâtrerie',
  'بلاكو': 'placo',
  'نجارة': 'menuiserie',
  'شقة': 'appartement',
  'بيت': 'maison',
  'دار': 'maison',
  'فيلا': 'villa',
  'محل': 'local commercial',
  'مكتب': 'bureau',
  'صالون': 'salon',
  'غرفة': 'chambre',
  'غرف': 'chambres',
  'مطبخ': 'cuisine',
  'حمام': 'salle de bain',
  'دوش': 'douche',
  'مدخل': 'entrée',
  'كوريدور': 'couloir',
  'ممر': 'couloir',
  'بلكونة': 'balcon',
  'تراس': 'terrasse',
  'كامل': 'complète',
  'كاملة': 'complète',
  'أشغال': 'travaux',
  'خدمة': 'prestation',
  'تركيب': 'pose',
  'إصلاح': 'réparation',
  'تنظيف': 'nettoyage',
  'واجهة': 'façade',
  'سطح': 'toiture',
};

// Professional French improvements
const FRENCH_IMPROVEMENTS: Array<[RegExp, string]> = [
  [/^peinture$/i, 'Travaux de peinture'],
  [/^peinture\s+mur/i, 'Travaux de peinture des murs'],
  [/^peinture\s+plafond/i, 'Travaux de peinture du plafond'],
  [/^peinture\s+(mur|plafond|sol)/i, 'Travaux de peinture — $1'],
  [/^carrelage$/i, 'Travaux de carrelage'],
  [/^plomberie$/i, 'Travaux de plomberie'],
  [/^électricité$/i, 'Mise aux normes électriques'],
  [/^maçonnerie$/i, 'Travaux de maçonnerie'],
  [/^rénovation$/i, 'Travaux de rénovation'],
  [/^démolition$/i, 'Travaux de démolition'],
  [/^isolation$/i, 'Travaux d\'isolation'],
  [/^plâtrerie$/i, 'Travaux de plâtrerie'],
  [/^menuiserie$/i, 'Travaux de menuiserie'],
  [/^nettoyage$/i, 'Travaux de nettoyage'],
];

/**
 * Quick local translation of Arabic BTP text to French keywords.
 * Returns null if no Arabic detected or translation not possible locally.
 */
export function quickTranslateArabic(text: string): string | null {
  if (!isMainlyArabic(text)) return null;

  const words = text.split(/[\s,،.+\-–—/]+/).filter(Boolean);
  const frenchParts: string[] = [];

  for (const word of words) {
    const clean = word.trim();
    if (!clean) continue;
    const match = ARABIC_TO_FRENCH[clean];
    if (match) {
      if (!frenchParts.includes(match)) frenchParts.push(match);
    } else if (!ARABIC_REGEX.test(clean)) {
      // Keep non-Arabic words (numbers, French words)
      frenchParts.push(clean);
    }
  }

  if (frenchParts.length === 0) return null;
  return frenchParts.join(', ');
}

/**
 * Makes a French description more professional.
 */
export function improveFrenchDescription(text: string): string {
  let result = text.trim();
  if (!result) return result;

  // Apply known improvements
  for (const [pattern, replacement] of FRENCH_IMPROVEMENTS) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      break;
    }
  }

  // Ensure starts with "Travaux" if it's just a trade name
  if (result.length < 30 && !result.toLowerCase().startsWith('travaux') && !result.toLowerCase().startsWith('mise')) {
    const tradeKeywords = ['peinture', 'carrelage', 'plomberie', 'maçonnerie', 'isolation', 'plâtrerie', 'menuiserie', 'nettoyage', 'démolition', 'rénovation'];
    const lower = result.toLowerCase();
    for (const kw of tradeKeywords) {
      if (lower.startsWith(kw)) {
        result = `Travaux de ${result.charAt(0).toLowerCase()}${result.slice(1)}`;
        break;
      }
    }
  }

  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);

  return result;
}

/**
 * Format the Objet field: translate Arabic, improve French, return structured result.
 */
export function formatObjet(rawText: string): { french: string; arabicOriginal?: string } {
  const trimmed = rawText.trim();
  if (!trimmed) return { french: '' };

  // If mainly Arabic, translate locally
  if (isMainlyArabic(trimmed)) {
    const translated = quickTranslateArabic(trimmed);
    if (translated) {
      return {
        french: improveFrenchDescription(translated),
        arabicOriginal: trimmed,
      };
    }
    // Can't translate locally — keep as-is but flag
    return { french: trimmed, arabicOriginal: trimmed };
  }

  // If French with some Arabic mixed in, clean and improve
  if (containsArabic(trimmed)) {
    // Remove Arabic words, keep French
    const frenchOnly = trimmed.replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, '').replace(/\s+/g, ' ').trim();
    return {
      french: improveFrenchDescription(frenchOnly || trimmed),
      arabicOriginal: trimmed,
    };
  }

  // Pure French — just improve
  return { french: improveFrenchDescription(trimmed) };
}
