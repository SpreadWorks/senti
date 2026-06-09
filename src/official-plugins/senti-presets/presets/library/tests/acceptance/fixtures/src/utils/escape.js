const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const ENTITY_REGEX = /[&<>"']/g;

/**
 * Escape special HTML characters in a string.
 * @param {string} str - Input string
 * @returns {string} Escaped string safe for HTML insertion
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(ENTITY_REGEX, char => HTML_ENTITIES[char]);
}
