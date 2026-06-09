/**
 * Renderer that converts an AST into HTML, JSON, or Markdown output.
 */
export class Renderer {
  constructor(options = {}) {
    this.format = options.format || 'html';
  }

  /**
   * Render an AST to the configured output format.
   * @param {object} ast
   * @returns {string}
   */
  render(ast) {
    switch (this.format) {
      case 'html':
        return this.toHTML(ast);
      case 'json':
        return this.toJSON(ast);
      case 'markdown':
        return this.toMarkdown(ast);
      default:
        throw new Error(`Unknown format: ${this.format}`);
    }
  }

  /**
   * Render AST to HTML string.
   * @param {object} ast
   * @returns {string}
   */
  toHTML(ast) {
    const parts = [];
    for (const node of ast.children || []) {
      parts.push(this.nodeToHTML(node));
    }
    return parts.join('\n');
  }

  /**
   * Render AST to JSON string.
   * @param {object} ast
   * @returns {string}
   */
  toJSON(ast) {
    return JSON.stringify(ast, null, 2);
  }

  /**
   * Render AST back to normalized Markdown.
   * @param {object} ast
   * @returns {string}
   */
  toMarkdown(ast) {
    const parts = [];
    for (const node of ast.children || []) {
      parts.push(this.nodeToMarkdown(node));
    }
    return parts.join('\n\n');
  }

  nodeToHTML(node) {
    switch (node.type) {
      case 'heading':
        return `<h${node.level}>${this.inlineToHTML(node.children)}</h${node.level}>`;
      case 'paragraph':
        return `<p>${this.inlineToHTML(node.children)}</p>`;
      case 'code_block':
        return `<pre><code class="language-${node.lang || ''}">${this.escapeHtml(node.value)}</code></pre>`;
      case 'list': {
        const tag = node.ordered ? 'ol' : 'ul';
        const items = (node.children || []).map(c => `<li>${this.inlineToHTML(c.children)}</li>`).join('');
        return `<${tag}>${items}</${tag}>`;
      }
      default:
        return '';
    }
  }

  nodeToMarkdown(node) {
    switch (node.type) {
      case 'heading':
        return `${'#'.repeat(node.level)} ${this.inlineToText(node.children)}`;
      case 'paragraph':
        return this.inlineToText(node.children);
      case 'code_block':
        return `\`\`\`${node.lang || ''}\n${node.value}\n\`\`\``;
      default:
        return '';
    }
  }

  inlineToHTML(children) {
    return (children || []).map(c => {
      if (c.type === 'text') return this.escapeHtml(c.value);
      if (c.type === 'link') return `<a href="${c.url}">${this.escapeHtml(c.text)}</a>`;
      return '';
    }).join('');
  }

  inlineToText(children) {
    return (children || []).map(c => c.value || c.text || '').join('');
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
