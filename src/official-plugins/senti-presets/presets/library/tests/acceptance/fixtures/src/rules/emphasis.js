const STRONG_REGEX = /\*\*(.+?)\*\*/;
const EM_REGEX = /\*(.+?)\*/;

/**
 * Rule for matching and parsing emphasis (bold and italic).
 */
export class EmphasisRule {
  /**
   * Match emphasis markers in text. Strong (**) takes precedence over em (*).
   * @param {string} text
   * @returns {{ index: number, length: number, raw: string, strong: boolean, content: string } | null}
   */
  match(text) {
    const strongMatch = text.match(STRONG_REGEX);
    const emMatch = text.match(EM_REGEX);

    if (strongMatch && (!emMatch || strongMatch.index <= emMatch.index)) {
      return {
        index: strongMatch.index,
        length: strongMatch[0].length,
        raw: strongMatch[0],
        strong: true,
        content: strongMatch[1],
      };
    }

    if (emMatch) {
      return {
        index: emMatch.index,
        length: emMatch[0].length,
        raw: emMatch[0],
        strong: false,
        content: emMatch[1],
      };
    }

    return null;
  }

  /**
   * Parse an emphasis match into an AST node.
   * @param {object} matchResult
   * @returns {object}
   */
  parse(matchResult) {
    return {
      type: matchResult.strong ? 'strong' : 'emphasis',
      text: matchResult.content,
    };
  }
}
