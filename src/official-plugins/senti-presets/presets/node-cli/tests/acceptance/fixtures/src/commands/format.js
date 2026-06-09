import { Parser } from '../lib/parser.js';
import { Renderer } from '../lib/renderer.js';

/**
 * Reformat Markdown files with consistent style.
 *
 * @param {object} options
 * @param {string[]} options.files - Input file paths
 * @param {boolean} [options.inPlace=false] - Overwrite original files
 */
export function format(options) {
  const { files, inPlace = false } = options;

  if (!files || files.length === 0) {
    console.error('No input files specified');
    process.exitCode = 1;
    return;
  }

  const parser = new Parser();
  const renderer = new Renderer({ format: 'markdown' });

  for (const file of files) {
    const content = readFile(file);
    const ast = parser.parse(content);
    const normalized = normalizeAst(ast);
    const formatted = renderer.render(normalized);

    if (inPlace) {
      writeFile(file, formatted);
      console.log(`Formatted: ${file}`);
    } else {
      console.log(formatted);
    }
  }
}

/**
 * Normalize AST nodes for consistent formatting.
 * @param {object} ast
 * @returns {object}
 */
function normalizeAst(ast) {
  const normalized = { ...ast, children: [] };

  for (const node of ast.children || []) {
    if (node.type === 'heading') {
      normalized.children.push(normalizeHeading(node));
    } else if (node.type === 'list') {
      normalized.children.push(normalizeList(node));
    } else {
      normalized.children.push(node);
    }
  }

  return normalized;
}

function normalizeHeading(node) {
  return { ...node, prefix: '#'.repeat(node.level) + ' ' };
}

function normalizeList(node) {
  return {
    ...node,
    children: (node.children || []).map((item, i) => ({
      ...item,
      marker: node.ordered ? `${i + 1}. ` : '- ',
    })),
  };
}

function readFile(path) {
  return '';
}

function writeFile(path, content) {
  // no-op in fixture
}
