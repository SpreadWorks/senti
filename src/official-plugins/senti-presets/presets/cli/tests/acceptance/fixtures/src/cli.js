#!/usr/bin/env node

import { parse } from './commands/parse.js';
import { lint } from './commands/lint.js';
import { toc } from './commands/toc.js';
import { format } from './commands/format.js';
import { loadConfig } from './config.js';

const commands = { parse, lint, toc, format };

/**
 * Main CLI entry point. Dispatches subcommands based on argv.
 */
export function run(argv = process.argv.slice(2)) {
  const config = loadConfig();
  const [subcommand, ...args] = argv;

  if (!subcommand || subcommand === '--help') {
    printUsage();
    return;
  }

  const handler = commands[subcommand];
  if (!handler) {
    console.error(`Unknown command: ${subcommand}`);
    process.exitCode = 1;
    return;
  }

  const options = parseOptions(args, config);
  handler(options);
}

/**
 * Parse CLI flags into an options object.
 * @param {string[]} args
 * @param {object} config
 * @returns {object}
 */
function parseOptions(args, config) {
  const options = { ...config, files: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i];
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (!arg.startsWith('-')) {
      options.files.push(arg);
    }
  }
  return options;
}

function printUsage() {
  console.log('Usage: md-parser <command> [options] [files...]');
  console.log('');
  console.log('Commands:');
  console.log('  parse    Convert Markdown to HTML or JSON');
  console.log('  lint     Check Markdown syntax');
  console.log('  toc      Generate table of contents');
  console.log('  format   Reformat Markdown files');
}

run();
