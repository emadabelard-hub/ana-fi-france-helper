/**
 * Alphabet Validation Module
 * 
 * Strict validation to ensure only French (Latin) and Arabic alphabets are used.
 * Blocks Cyrillic, Greek, Chinese, and any other scripts.
 */

// Allowed character ranges
const LATIN_RANGE = /[\u0020-\u007F\u00A0-\u00FF\u0100-\u017F\u0180-\u024F]/; // Basic Latin + Extended Latin
const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/; // Arabic, Arabic Supplement, Extended Arabic
const NUMBERS_PUNCTUATION = /[\d\s.,;:!?'"()\-–—€$%@#&*+=\/<>[\]{}|\\^~`_\n\r\t]/;
const EMOJIS = /[\u{1F300}-\u{1F9FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|\u{1F600}-\u{1F64F}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}]/u;

// Forbidden character ranges (explicit blocks)
const CYRILLIC = /[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]/;
const GREEK = /[\u0370-\u03FF\u1F00-\u1FFF]/;
const CHINESE = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
const JAPANESE = /[\u3040-\u309F\u30A0-\u30FF]/;
const KOREAN = /[\uAC00-\uD7AF\u1100-\u11FF]/;
const THAI = /[\u0E00-\u0E7F]/;
const HEBREW = /[\u0590-\u05FF]/;
const DEVANAGARI = /[\u0900-\u097F]/; // Hindi

export interface ValidationResult {
  isValid: boolean;
  hasForbiddenChars: boolean;
  forbiddenCharsFound: string[];
  detectedScripts: string[];
}

/**
 * Detects which forbidden scripts are present in the text
 */
export function detectForbiddenScripts(text: string): string[] {
  const detected: string[] = [];
  
  if (CYRILLIC.test(text)) detected.push('cyrillic');
  if (GREEK.test(text)) detected.push('greek');
  if (CHINESE.test(text)) detected.push('chinese');
  if (JAPANESE.test(text)) detected.push('japanese');
  if (KOREAN.test(text)) detected.push('korean');
  if (THAI.test(text)) detected.push('thai');
  if (HEBREW.test(text)) detected.push('hebrew');
  if (DEVANAGARI.test(text)) detected.push('devanagari');
  
  return detected;
}

/**
 * Validates that text contains only allowed characters (Latin, Arabic, numbers, punctuation, emojis)
 */
export function validateAlphabet(text: string): ValidationResult {
  const forbiddenScripts = detectForbiddenScripts(text);
  const hasForbidden = forbiddenScripts.length > 0;
  
  // Extract actual forbidden characters for display
  const forbiddenChars: string[] = [];
  for (const char of text) {
    const isLatin = LATIN_RANGE.test(char);
    const isArabic = ARABIC_RANGE.test(char);
    const isNumber = NUMBERS_PUNCTUATION.test(char);
    const isEmoji = EMOJIS.test(char);
    
    if (!isLatin && !isArabic && !isNumber && !isEmoji) {
      // Check if it's from a forbidden script
      const charCode = char.charCodeAt(0);
      const isForbidden = 
        (charCode >= 0x0400 && charCode <= 0x04FF) || // Cyrillic
        (charCode >= 0x0370 && charCode <= 0x03FF) || // Greek
        (charCode >= 0x4E00 && charCode <= 0x9FFF) || // Chinese
        (charCode >= 0x3040 && charCode <= 0x30FF) || // Japanese
        (charCode >= 0xAC00 && charCode <= 0xD7AF) || // Korean
        (charCode >= 0x0590 && charCode <= 0x05FF);   // Hebrew
        
      if (isForbidden && !forbiddenChars.includes(char)) {
        forbiddenChars.push(char);
      }
    }
  }
  
  return {
    isValid: !hasForbidden && forbiddenChars.length === 0,
    hasForbiddenChars: hasForbidden,
    forbiddenCharsFound: forbiddenChars,
    detectedScripts: forbiddenScripts,
  };
}

/**
 * Sanitizes text by removing forbidden characters
 * Returns the cleaned text
 */
export function sanitizeText(text: string): string {
  let result = '';
  
  for (const char of text) {
    const isLatin = LATIN_RANGE.test(char);
    const isArabic = ARABIC_RANGE.test(char);
    const isNumber = NUMBERS_PUNCTUATION.test(char);
    const isEmoji = EMOJIS.test(char);
    
    if (isLatin || isArabic || isNumber || isEmoji) {
      result += char;
    }
    // Skip forbidden characters
  }
  
  return result;
}

/**
 * Quick check if text appears to be primarily in a specific language
 */
export function detectPrimaryLanguage(text: string): 'arabic' | 'french' | 'mixed' {
  let arabicCount = 0;
  let latinCount = 0;
  
  for (const char of text) {
    if (ARABIC_RANGE.test(char)) arabicCount++;
    if (LATIN_RANGE.test(char) && !/\d/.test(char)) latinCount++;
  }
  
  const total = arabicCount + latinCount;
  if (total === 0) return 'french'; // Default
  
  const arabicRatio = arabicCount / total;
  
  if (arabicRatio > 0.7) return 'arabic';
  if (arabicRatio < 0.3) return 'french';
  return 'mixed';
}
