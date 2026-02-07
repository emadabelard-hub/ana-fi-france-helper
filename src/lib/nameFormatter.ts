/**
 * Utility functions for formatting names in French professional format
 */

/**
 * Formats a full name as: Prénom (capitalized) + NOM (uppercase)
 * Example: "mohamed ahmed" → "Mohamed AHMED"
 * Example: "jean-pierre MARTIN" → "Jean-Pierre MARTIN"
 */
export function formatFullName(fullName: string): string {
  if (!fullName || !fullName.trim()) return '';
  
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 1) {
    // Single name - treat as first name
    return capitalizeFirstLetter(parts[0]);
  }
  
  // Last part is the family name (uppercase), rest are first names (capitalized)
  const lastName = parts[parts.length - 1].toUpperCase();
  const firstNames = parts.slice(0, -1).map(capitalizeFirstLetter).join(' ');
  
  return `${firstNames} ${lastName}`;
}

/**
 * Capitalize first letter of each word, handling hyphenated names
 * Example: "jean-pierre" → "Jean-Pierre"
 */
function capitalizeFirstLetter(name: string): string {
  return name
    .toLowerCase()
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');
}

/**
 * Extract initials from a full name (first letter of first name + first letter of last name)
 */
export function getInitials(fullName: string): string {
  if (!fullName || !fullName.trim()) return '?';
  
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  // First letter of first name + first letter of last name
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
