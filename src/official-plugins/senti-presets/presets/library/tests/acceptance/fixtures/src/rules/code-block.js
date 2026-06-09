/**
 * Rule for matching and parsing fenced code blocks.
 */
export class CodeBlockRule {
  /**
   * Check if a token is a code block.
   * @param {object} token
   * @returns {boolean}
   */
  match(token) {
    return token.type === 'code_block';
  }

  /**
   * Parse a code block token into an AST node.
   * @param {object} token
   * @returns {object}
   */
  parse(token) {
    return {
      type: 'code_block',
      lang: token.lang || null,
      value: token.code,
    };
  }
}
