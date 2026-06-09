import { escapeHtml } from './utils/escape.js';

/**
 * Renderer that converts a Markdown AST into various output formats.
 */
export class Renderer {
  constructor(options = {}) {
    this.format = options.format || 'html';
    this.indent = options.indent || 2;
  }

  /**
   * Render an AST to the configured format.
   * @param {object} ast
   * @returns {string}
   */
  render(ast) {
    switch (this.format) {
      case 'html': return this.toHTML(ast);
      case 'json': return this.toJSON(ast);
      default: throw new Error(`Unsupported format: ${this.format}`);
    }
  }

  /**
   * Render AST to an HTML string.
   * @param {object} ast
   * @returns {string}
   */
  toHTML(ast) {
    return (ast.children || []).map(node => this.nodeToHTML(node)).join('\n');
  }

  /**
   * Serialize AST to a JSON string.
   * @param {object} ast
   * @returns {string}
   */
  toJSON(ast) {
    return JSON.stringify(ast, null, this.indent);
  }

  nodeToHTML(node) {
    switch (node.type) {
      case 'heading':
        return `<h${node.level}>${this.childrenToHTML(node)}</h${node.level}>`;
      case 'paragraph':
        return `<p>${this.childrenToHTML(node)}</p>`;
      case 'code_block':
        return `<pre><code class="language-${node.lang || ''}">${escapeHtml(node.code || node.value || '')}</code></pre>`;
      case 'list': {
        const tag = node.ordered ? 'ol' : 'ul';
        const items = (node.items || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
        return `<${tag}>${items}</${tag}>`;
      }
      case 'table':
        return this.tableToHTML(node);
      case 'inline':
        return this.inlineToHTML(node);
      case 'text':
        return escapeHtml(node.value || '');
      default:
        return '';
    }
  }

  childrenToHTML(node) {
    return (node.children || []).map(c => this.nodeToHTML(c)).join('');
  }

  inlineToHTML(node) {
    return (node.children || []).map(c => {
      if (c.type === 'text') return escapeHtml(c.value);
      if (c.type === 'link') return `<a href="${escapeHtml(c.url)}">${escapeHtml(c.text)}</a>`;
      if (c.type === 'emphasis') return `<em>${escapeHtml(c.text)}</em>`;
      if (c.type === 'strong') return `<strong>${escapeHtml(c.text)}</strong>`;
      return '';
    }).join('');
  }

  tableToHTML(node) {
    const rows = node.rows || [];
    if (rows.length === 0) return '';
    const header = rows[0].map(c => `<th>${escapeHtml(c)}</th>`).join('');
    const body = rows.slice(2).map(row =>
      `<tr>${row.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
    ).join('');
    return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  }
}
