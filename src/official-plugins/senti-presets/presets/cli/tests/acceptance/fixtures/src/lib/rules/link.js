const LINK_PATTERN = /\[([^\]]*)\]\(([^)]*)\)/;

/**
 * Match an inline link in a text string.
 * @param {string} text
 * @returns {{ node: object, index: number, length: number } | null}
 */
export function matchLink(text) {
  const match = text.match(LINK_PATTERN);
  if (!match) return null;

  return {
    node: {
      type: 'link',
      text: match[1],
      url: match[2],
    },
    index: match.index,
    length: match[0].length,
  };
}
