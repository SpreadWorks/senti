#!/usr/bin/env node
/**
 * src/check.js
 *
 * Check dispatcher. Routes check subcommands via the unified dispatcher.
 */

import { EXIT_ERROR } from "./lib/constants.js";
import { container, initContainer } from "./lib/container.js";
import { checkCommands } from "./lib/command-registry.js";
import { dispatch } from "./lib/dispatcher.js";

initContainer();

const args = process.argv.slice(2);
const subCmd = args[0];
const rest = args.slice(1);

if (!subCmd || subCmd === "-h" || subCmd === "--help") {
  console.error("Usage: senti check <command>\n");
  console.error("Available commands:");
  for (const c of Object.keys(checkCommands)) console.error(`  ${c}`);
  console.error("\nRun: senti check <command> --help");
  process.exit(subCmd ? 0 : 1);
}

const entry = checkCommands[subCmd];
if (!entry) {
  console.error(`senti check: unknown command '${subCmd}'`);
  console.error("Run: senti check --help");
  process.exit(EXIT_ERROR);
}

await dispatch({ container, entry, argv: rest });
