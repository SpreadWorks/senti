import { Parser } from '../lib/parser.js';
import { Renderer } from '../lib/renderer.js';

/**
 * Parse Markdown files and convert to the specified output format.
 * Supports HTML and JSON output.
 *
 * @param {object} options
 * @param {string[]} options.files - Input file paths
 * @param {string} [options.format='html'] - Output format (html|json)
 * @param {string} [options.output] - Output file path
 */
export function parse(options) {
  const { files, format = 'html', output } = options;

  if (!files || files.length === 0) {
    console.error('No input files specified');
    process.exitCode = 1;
    return;
  }

  const parser = new Parser();
  const renderer = new Renderer({ format });

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const ast = parser.parse(content);

    let result;
    if (format === 'json') {
      result = renderer.toJSON(ast);
    } else {
      result = renderer.toHTML(ast);
    }

    if (output) {
      writeFileSync(output, result, 'utf-8');
    } else {
      console.log(result);
    }
  }
}

function readFileSync(path, encoding) {
  const { readFileSync: read } = await import('node:fs');
  return read(path, encoding);
}

function writeFileSync(path, data, encoding) {
  const { writeFileSync: write } = await import('node:fs');
  write(path, data, encoding);
}
