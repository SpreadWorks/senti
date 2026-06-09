/**
 * Tokenizer that splits Markdown text into block-level tokens.
 */
export class Tokenizer {
  constructor() {
    this.patterns = {
      heading: /^(#{1,6})\s+(.+)$/,
      codeBlockOpen: /^```(\w*)$/,
      codeBlockClose: /^```$/,
      listItem: /^(\s*)([-*+]|\d+\.)\s+(.+)$/,
      horizontalRule: /^([-*_]){3,}\s*$/,
      blankLine: /^\s*$/,
    };
  }

  /**
   * Tokenize the full input string into an array of tokens.
   * @param {string} input
   * @returns {object[]}
   */
  tokenize(input) {
    const lines = input.split('\n');
    const tokens = [];
    let i = 0;

    while (i < lines.length) {
      const result = this.nextToken(lines, i);
      if (result.token) {
        tokens.push(result.token);
      }
      i = result.nextIndex;
    }

    return tokens;
  }

  /**
   * Read the next token starting at the given line index.
   * @param {string[]} lines
   * @param {number} index - Current line index
   * @returns {{ token: object|null, nextIndex: number }}
   */
  nextToken(lines, index) {
    const line = lines[index];

    if (this.patterns.blankLine.test(line)) {
      return { token: null, nextIndex: index + 1 };
    }

    const headingMatch = line.match(this.patterns.heading);
    if (headingMatch) {
      return {
        token: { type: 'heading', level: headingMatch[1].length, text: headingMatch[2] },
        nextIndex: index + 1,
      };
    }

    const codeMatch = line.match(this.patterns.codeBlockOpen);
    if (codeMatch) {
      return this.readCodeBlock(lines, index, codeMatch[1]);
    }

    const listMatch = line.match(this.patterns.listItem);
    if (listMatch) {
      return this.readList(lines, index);
    }

    return this.readParagraph(lines, index);
  }

  readCodeBlock(lines, startIndex, lang) {
    const codeLines = [];
    let i = startIndex + 1;
    while (i < lines.length && !this.patterns.codeBlockClose.test(lines[i])) {
      codeLines.push(lines[i]);
      i++;
    }
    return {
      token: { type: 'code_block', lang, code: codeLines.join('\n') },
      nextIndex: i + 1,
    };
  }

  readList(lines, startIndex) {
    const items = [];
    let i = startIndex;
    let ordered = false;
    while (i < lines.length) {
      const match = lines[i].match(this.patterns.listItem);
      if (!match) break;
      ordered = /\d+\./.test(match[2]);
      items.push(match[3]);
      i++;
    }
    return {
      token: { type: 'list', ordered, items },
      nextIndex: i,
    };
  }

  readParagraph(lines, startIndex) {
    const parts = [];
    let i = startIndex;
    while (i < lines.length && !this.patterns.blankLine.test(lines[i]) && !lines[i].match(this.patterns.heading)) {
      parts.push(lines[i]);
      i++;
    }
    return {
      token: { type: 'paragraph', text: parts.join(' ') },
      nextIndex: i,
    };
  }
}
