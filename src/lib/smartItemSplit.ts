/**
 * Smart item breakdown: if a user writes multiple tasks in one sentence
 * separated by "et", "+" or commas, split them into separate line items.
 */

const SPLIT_PATTERN = /\s+et\s+|\s*\+\s*|\s*,\s*/i;

// Common French construction task keywords to help detect multi-task input
const TASK_KEYWORDS = [
  'peinture', 'pose', 'installation', 'réparation', 'démontage',
  'montage', 'nettoyage', 'enduit', 'carrelage', 'plomberie',
  'électricité', 'parquet', 'faïence', 'ravalement', 'isolation',
  'cloison', 'plâtre', 'menuiserie', 'maçonnerie', 'étanchéité',
];

/**
 * Check if a text contains multiple tasks that should be split.
 * Returns the split parts, or null if no split is needed.
 */
export const detectMultipleTasks = (text: string): string[] | null => {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(SPLIT_PATTERN).map(p => p.trim()).filter(Boolean);
  
  // Only split if we get 2+ meaningful parts
  if (parts.length < 2) return null;
  
  // Each part should be at least 3 chars to be a valid task
  const validParts = parts.filter(p => p.length >= 3);
  if (validParts.length < 2) return null;

  return validParts;
};
