import { Tokenizer } from './tokenizer.js';
import { HeadingRule } from './rules/heading.js';
import { ListRule } from './rules/list.js';
import { CodeBlockRule } from './rules/code-block.js';
import { LinkRule } from './rules/link.js';
import { TableRule } from './rules/table.js';
import { EmphasisRule } from './rules/emphasis.js';

/**
 * Full-featured Markdown parser supporting CommonMark syntax.
 */
export class Parser {
  constructor(options = {}) {
    this.options = options;
    this.tokenizer = new Tokenizer();
    this.blockRules = [
      new HeadingRule(),
      new CodeBlockRule(),
      new ListRule(),
      new TableRule(),
    ];
    this.inlineRules = [
      new LinkRule(),
      new EmphasisRule(),
    ];
  }

  /**
   * Parse a complete Markdown document into an AST.
   * @param {string} input
   * @returns {object}
   */
  parse(input) {
    const tokens = this.tokenizer.tokenize(input);
    const root = { type: 'document', children: [] };

    for (const token of tokens) {
      const node = this.parseBlock(token);
      if (node) root.children.push(node);
    }

    return root;
  }

  /**
   * Parse a block-level token into an AST node.
   * @param {object} token
   * @returns {object|null}
   */
  parseBlock(token) {
    for (const rule of this.blockRules) {
      if (rule.match(token)) {
        const node = rule.parse(token);
        if (node.children) {
          node.children = node.children.map(child =>
            typeof child === 'string' ? this.parseInline(child) : child
          );
        }
        return node;
      }
    }

    if (token.type === 'paragraph') {
      return {
        type: 'paragraph',
        children: [this.parseInline(token.text)],
      };
    }

    return null;
  }

  /**
   * Parse inline elements within a text string.
   * @param {string} text
   * @returns {object}
   */
  parseInline(text) {
    if (typeof text !== 'string') return text;

    const children = [];
    let remaining = text;

    while (remaining.length > 0) {
      let earliest = null;
      let earliestRule = null;

      for (const rule of this.inlineRules) {
        const result = rule.match(remaining);
        if (result && (!earliest || result.index < earliest.index)) {
          earliest = result;
          earliestRule = rule;
        }
      }

      if (!earliest) {
        children.push({ type: 'text', value: remaining });
        break;
      }

      if (earliest.index > 0) {
        children.push({ type: 'text', value: remaining.slice(0, earliest.index) });
      }

      children.push(earliestRule.parse(earliest));
      remaining = remaining.slice(earliest.index + earliest.length);
    }

    return { type: 'inline', children };
  }
}
