/**
 * Rule for matching and parsing ordered and unordered lists.
 */
export class ListRule {
  /**
   * Check if a token is a list.
   * @param {object} token
   * @returns {boolean}
   */
  match(token) {
    return token.type === 'list';
  }

  /**
   * Parse a list token into an AST node.
   * @param {object} token
   * @returns {object}
   */
  parse(token) {
    return {
      type: 'list',
      ordered: token.ordered,
      children: (token.items || []).map(item => ({
        type: 'list_item',
        children: [item],
      })),
    };
  }
}
