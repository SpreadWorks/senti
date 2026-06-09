/**
 * Rule for matching and parsing ATX-style headings.
 */
export class HeadingRule {
  /**
   * Check if a token is a heading.
   * @param {object} token
   * @returns {boolean}
   */
  match(token) {
    return token.type === 'heading';
  }

  /**
   * Parse a heading token into an AST node.
   * @param {object} token
   * @returns {object}
   */
  parse(token) {
    return {
      type: 'heading',
      level: token.level,
      children: [token.text],
    };
  }
}
