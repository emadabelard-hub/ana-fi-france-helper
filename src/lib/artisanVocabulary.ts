/**
 * Smart correction layer for mixed Arabic dialect + French artisan vocabulary.
 * Converts spoken Arabic (Ammiya/Darija) construction terms into clean professional French.
 */

const ARTISAN_TERMS: [RegExp, string][] = [
  // Peinture
  [/\b(بانتي[رة]ة?|بانتير|بنتيرة|بنتير|بونتير|بنطير)\b/g, 'peinture'],
  [/\b(سوسكوش|سوسكوتش|sous ?couche)\b/gi, 'sous-couche'],
  [/\b(معجون|ماجون|أندوي)\b/g, 'enduit'],
  [/\b(صنفر[ةه]|صنفرة|بونساج)\b/g, 'ponçage'],

  // Carrelage
  [/\b(كارلاج|كاريلاج|كارولاج|كرلاج)\b/g, 'carrelage'],
  [/\b(فايونس|فيانس)\b/g, 'faïence'],
  [/\b(جوانت?|جوان)\b/g, 'joint'],

  // Électricité
  [/\b(كهربا|كهرباء|اليكتريسيتي|الكتريسيتي)\b/g, 'électricité'],
  [/\b(تابلو|طابلو)\b/g, 'tableau électrique'],
  [/\b(بريز|بريزة)\b/g, 'prise'],
  [/\b(أنتروبتور|أنتربتور)\b/g, 'interrupteur'],

  // Plomberie
  [/\b(سباكة?|سباكة|بلومبري|بلونبري)\b/g, 'plomberie'],
  [/\b(روبيني|روبينية?)\b/g, 'robinet'],
  [/\b(سيفون)\b/g, 'siphon'],
  [/\b(شوف[اأ]ج|شوفاج)\b/g, 'chauffage'],
  [/\b(بالون? ?ديو|شوف ?ماء|بالون)\b/g, 'chauffe-eau'],

  // Maçonnerie
  [/\b(ماسونري|ماصونري)\b/g, 'maçonnerie'],
  [/\b(بيطون|بيتون)\b/g, 'béton'],
  [/\b(بارب[اأ]ن|بارباينغ)\b/g, 'parpaing'],
  [/\b(دالا?ج|دالاج)\b/g, 'dallage'],

  // Surfaces & mesures
  [/\b(ميتر? ?كاري|متر ?مربع)\b/g, 'mètre carré'],
  [/\b(ميتر? ?لينيير|متر ?طولي)\b/g, 'mètre linéaire'],

  // Finitions
  [/\b(دجراسياج|ديغراسياج|ديقراسياج)\b/g, 'dégrossissage'],
  [/\b(ديكوراسيون|ديكور)\b/g, 'décoration'],
  [/\b(بلاكو|بلاكوبلاتر)\b/g, 'placo'],
  [/\b(فو ?بلافون|فوبلافون)\b/g, 'faux plafond'],
  [/\b(بلافون|سقف)\b/g, 'plafond'],
  [/\b(حيط|حيطة?)\b/g, 'mur'],

  // Général chantier
  [/\b(شونتيي|شانتيي|شانتية?)\b/g, 'chantier'],
  [/\b(دوفي|ديفي)\b/g, 'devis'],
  [/\b(فاكتور|فاتورة?)\b/g, 'facture'],
  [/\b(فورنيتور|فورنيتير)\b/g, 'fourniture'],
  [/\b(مان ?دوفر|مان ?ديفر)\b/g, "main-d'œuvre"],
  [/\b(ماتيريال|ماتيريو)\b/g, 'matériaux'],
];

/**
 * Apply artisan vocabulary corrections to a spoken transcript.
 * Replaces Arabic dialect construction terms with proper French equivalents.
 */
export function correctArtisanVocabulary(text: string): string {
  let result = text;
  for (const [pattern, replacement] of ARTISAN_TERMS) {
    result = result.replace(pattern, replacement);
  }
  return result.trim();
}
