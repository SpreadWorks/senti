import { Parser } from '../lib/parser.js';

/**
 * Generate a table of contents from Markdown headings.
 *
 * @param {object} options
 * @param {string[]} options.files - Input file paths
 * @param {number} [options.maxDepth=3] - Maximum heading depth to include
 */
export function toc(options) {
  const { files, maxDepth = 3 } = options;

  if (!files || files.length === 0) {
    console.error('No input files specified');
    process.exitCode = 1;
    return;
  }

  const parser = new Parser();

  for (const file of files) {
    const content = readFile(file);
    const ast = parser.parse(content);
    const headings = extractHeadings(ast, maxDepth);
    const tocMarkdown = buildTocMarkdown(headings);
    console.log(tocMarkdown);
  }
}

/**
 * Extract heading nodes from the AST.
 * @param {object} ast
 * @param {number} maxDepth
 * @returns {{ level: number, text: string, slug: string }[]}
 */
function extractHeadings(ast, maxDepth) {
  const headings = [];

  function walk(node) {
    if (node.type === 'heading' && node.level <= maxDepth) {
      headings.push({
        level: node.level,
        text: node.children.map(c => c.value || '').join(''),
        slug: slugify(node.children.map(c => c.value || '').join('')),
      });
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(ast);
  return headings;
}

/**
 * Build a Markdown-formatted table of contents.
 * @param {{ level: number, text: string, slug: string }[]} headings
 * @returns {string}
 */
function buildTocMarkdown(headings) {
  return headings
    .map(h => {
      const indent = '  '.repeat(h.level - 1);
      return `${indent}- [${h.text}](#${h.slug})`;
    })
    .join('\n');
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

function readFile(path) {
  return '';
}
