import { Parser } from '../lib/parser.js';

/**
 * Lint Markdown files for syntax issues and style violations.
 *
 * @param {object} options
 * @param {string[]} options.files - Input file paths
 * @param {boolean} [options.strict=false] - Enable strict mode
 */
export function lint(options) {
  const { files, strict = false } = options;

  if (!files || files.length === 0) {
    console.error('No input files specified');
    process.exitCode = 1;
    return;
  }

  const parser = new Parser();
  const rules = loadLintRules(strict);
  let totalWarnings = 0;
  let totalErrors = 0;

  for (const file of files) {
    const diagnostics = lintFile(parser, rules, file);
    for (const d of diagnostics) {
      const prefix = d.severity === 'error' ? 'ERROR' : 'WARN';
      console.log(`${file}:${d.line}:${d.column} ${prefix} ${d.message} [${d.rule}]`);
      if (d.severity === 'error') totalErrors++;
      else totalWarnings++;
    }
  }

  console.log(`\n${totalErrors} errors, ${totalWarnings} warnings`);
  if (totalErrors > 0) process.exitCode = 1;
}

/**
 * Lint a single file and return diagnostics.
 * @param {Parser} parser
 * @param {object[]} rules
 * @param {string} filePath
 * @returns {object[]}
 */
function lintFile(parser, rules, filePath) {
  const diagnostics = [];
  const content = readFile(filePath);
  const ast = parser.parse(content);
  const lines = content.split('\n');

  for (const rule of rules) {
    const results = rule.check(ast, lines);
    diagnostics.push(...results);
  }

  return diagnostics.sort((a, b) => a.line - b.line || a.column - b.column);
}

function loadLintRules(strict) {
  const rules = [
    { name: 'no-trailing-spaces', check: checkTrailingSpaces },
    { name: 'heading-increment', check: checkHeadingIncrement },
    { name: 'no-empty-links', check: checkEmptyLinks },
  ];
  if (strict) {
    rules.push({ name: 'consistent-list-marker', check: checkListMarker });
  }
  return rules;
}

function checkTrailingSpaces(ast, lines) {
  const issues = [];
  lines.forEach((line, i) => {
    if (line !== line.trimEnd()) {
      issues.push({ line: i + 1, column: line.trimEnd().length + 1, severity: 'warn', message: 'Trailing spaces', rule: 'no-trailing-spaces' });
    }
  });
  return issues;
}

function checkHeadingIncrement(ast) {
  return [];
}

function checkEmptyLinks(ast) {
  return [];
}

function checkListMarker(ast, lines) {
  return [];
}

function readFile(path) {
  return '';
}
