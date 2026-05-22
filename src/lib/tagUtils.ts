/**
 * Splits a list of tags (such as games or skills) by comma, semicolon, or vertical pipe,
 * while safely preserving commas used as thousands separators in numbers (e.g. "Warhammer 40,000").
 */
export function splitTags(val: any): string[] {
  if (val === null || val === undefined) return [];
  const str = val.toString();
  
  // Temporary placeholder for thousands separator comma (e.g., in "40,000")
  // Looks for a comma preceded by a digit, and followed by exactly three digits and a non-digit (or end of string)
  const preserved = str.replace(/(?<=\d),(?=\d{3}(?:\b|\D|$))/g, '___THOUSANDS_COMMA___');
  
  // Now we can safely split by comma, semicolon, or vertical pipe
  const parts = preserved.split(/[,;|]+/).map((p: string) => {
    // Restore the preserved comma and trim spaces
    return p.replace(/___THOUSANDS_COMMA___/g, ',').trim();
  }).filter(Boolean);
  
  return parts;
}
