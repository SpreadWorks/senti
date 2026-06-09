/**
 * Normalize whitespace in a string by collapsing consecutive
 * spaces, tabs, and newlines into single spaces.
 * @param {string} str
 * @returns {string}
 */
export function normalizeWhitespace(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/\s+/g, ' ').trim();
}
