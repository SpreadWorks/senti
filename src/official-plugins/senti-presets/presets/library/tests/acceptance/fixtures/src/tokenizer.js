/**
 * Tokenizer that breaks Markdown input into a stream of block-level tokens.
 */
export class Tokenizer {
  constructor() {
    this.pos = 0;
    this.input = '';
    this.lines = [];
  }

  /**
   * Tokenize a full Markdown document.
   * @param {string} input
   * @returns {object[]}
   */
  tokenize(input) {
    this.input = input;
    this.lines = input.split('\n');
    this.pos = 0;
    const tokens = [];

    while (this.pos < this.lines.length) {
      const token = this.scan();
      if (token) tokens.push(token);
    }

    return tokens;
  }

  /**
   * Scan for the next block-level token at the current position.
   * @returns {object|null}
   */
  scan() {
    while (this.pos < this.lines.length && this.lines[this.pos].trim() === '') {
      this.advance();
    }

    if (this.pos >= this.lines.length) return null;

    const line = this.lines[this.pos];

    if (/^#{1,6}\s/.test(line)) {
      return this.scanHeading();
    }
    if (/^```/.test(line)) {
      return this.scanCodeBlock();
    }
    if (/^\|/.test(line)) {
      return this.scanTable();
    }
    if (/^(\s*)([-*+]|\d+\.)\s/.test(line)) {
      return this.scanList();
    }

    return this.scanParagraph();
  }

  /**
   * Advance the position cursor by one line.
   */
  advance() {
    this.pos++;
  }

  scanHeading() {
    const line = this.lines[this.pos];
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    this.advance();
    return { type: 'heading', level: match[1].length, text: match[2] };
  }

  scanCodeBlock() {
    const openLine = this.lines[this.pos];
    const lang = openLine.replace(/^```/, '').trim();
    this.advance();
    const codeLines = [];
    while (this.pos < this.lines.length && !/^```$/.test(this.lines[this.pos])) {
      codeLines.push(this.lines[this.pos]);
      this.advance();
    }
    if (this.pos < this.lines.length) this.advance();
    return { type: 'code_block', lang, code: codeLines.join('\n') };
  }

  scanTable() {
    const rows = [];
    while (this.pos < this.lines.length && /^\|/.test(this.lines[this.pos])) {
      const cells = this.lines[this.pos].split('|').filter(c => c.trim()).map(c => c.trim());
      rows.push(cells);
      this.advance();
    }
    return { type: 'table', rows };
  }

  scanList() {
    const items = [];
    let ordered = false;
    while (this.pos < this.lines.length) {
      const match = this.lines[this.pos].match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
      if (!match) break;
      ordered = /\d+\./.test(match[2]);
      items.push(match[3]);
      this.advance();
    }
    return { type: 'list', ordered, items };
  }

  scanParagraph() {
    const parts = [];
    while (this.pos < this.lines.length && this.lines[this.pos].trim() !== '' && !/^#{1,6}\s/.test(this.lines[this.pos])) {
      parts.push(this.lines[this.pos]);
      this.advance();
    }
    return { type: 'paragraph', text: parts.join(' ') };
  }
}
