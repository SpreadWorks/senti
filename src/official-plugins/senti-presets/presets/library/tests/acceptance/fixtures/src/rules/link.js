const LINK_REGEX = /\[([^\]]*)\]\(([^)]*)\)/;

/**
 * Rule for matching and parsing inline links.
 */
export class LinkRule {
  /**
   * Match an inline link in text.
   * @param {string} text
   * @returns {{ index: number, length: number, raw: string } | null}
   */
  match(text) {
    const m = text.match(LINK_REGEX);
    if (!m) return null;
    return {
      index: m.index,
      length: m[0].length,
      raw: m[0],
      linkText: m[1],
      url: m[2],
    };
  }

  /**
   * Parse a link match into an AST node.
   * @param {object} matchResult
   * @returns {object}
   */
  parse(matchResult) {
    return {
      type: 'link',
      text: matchResult.linkText,
      url: matchResult.url,
    };
  }
}
