export { Parser } from './parser.js';
export { Tokenizer } from './tokenizer.js';
export { Renderer } from './renderer.js';

/**
 * Convenience function to parse Markdown and return an AST.
 * @param {string} input - Raw Markdown string
 * @param {object} [options] - Parser options
 * @returns {object} AST
 */
export function parse(input, options = {}) {
  const parser = new (await import('./parser.js')).Parser(options);
  return parser.parse(input);
}

/**
 * Convenience function to parse and render Markdown in one step.
 * @param {string} input - Raw Markdown string
 * @param {object} [options] - Render options
 * @returns {string} Rendered output
 */
export function render(input, options = {}) {
  const parser = new (await import('./parser.js')).Parser(options);
  const renderer = new (await import('./renderer.js')).Renderer(options);
  const ast = parser.parse(input);
  return renderer.render(ast);
}
