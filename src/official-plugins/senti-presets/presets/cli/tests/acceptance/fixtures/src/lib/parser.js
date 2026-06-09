import { Tokenizer } from './tokenizer.js';
import { matchHeading } from './rules/heading.js';
import { matchList } from './rules/list.js';
import { matchCodeBlock } from './rules/code-block.js';
import { matchLink } from './rules/link.js';

/**
 * Markdown parser that converts raw text into an AST.
 */
export class Parser {
  constructor(options = {}) {
    this.options = options;
    this.tokenizer = new Tokenizer();
    this.blockRules = [matchHeading, matchCodeBlock, matchList];
    this.inlineRules = [matchLink];
  }

  /**
   * Parse a Markdown string into an AST.
   * @param {string} input - Raw Markdown text
   * @returns {object} Abstract syntax tree
   */
  parse(input) {
    const tokens = this.tokenize(input);
    const root = { type: 'root', children: [] };

    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      const node = this.parseToken(token);
      if (node) {
        root.children.push(node);
      }
      i++;
    }

    return root;
  }

  /**
   * Tokenize input text into a flat token array.
   * @param {string} input
   * @returns {object[]}
   */
  tokenize(input) {
    return this.tokenizer.tokenize(input);
  }

  /**
   * Convert a single token to an AST node.
   * @param {object} token
   * @returns {object|null}
   */
  parseToken(token) {
    switch (token.type) {
      case 'heading':
        return { type: 'heading', level: token.level, children: this.parseInline(token.text) };
      case 'paragraph':
        return { type: 'paragraph', children: this.parseInline(token.text) };
      case 'code_block':
        return { type: 'code_block', lang: token.lang, value: token.code };
      case 'list':
        return { type: 'list', ordered: token.ordered, children: token.items.map(item => ({ type: 'list_item', children: this.parseInline(item) })) };
      default:
        return null;
    }
  }

  /**
   * Parse inline elements (links, emphasis, code spans).
   * @param {string} text
   * @returns {object[]}
   */
  parseInline(text) {
    if (!text) return [];
    const children = [];
    let remaining = text;

    while (remaining.length > 0) {
      let matched = false;
      for (const rule of this.inlineRules) {
        const result = rule(remaining);
        if (result) {
          if (result.index > 0) {
            children.push({ type: 'text', value: remaining.slice(0, result.index) });
          }
          children.push(result.node);
          remaining = remaining.slice(result.index + result.length);
          matched = true;
          break;
        }
      }
      if (!matched) {
        children.push({ type: 'text', value: remaining });
        break;
      }
    }

    return children;
  }
}
