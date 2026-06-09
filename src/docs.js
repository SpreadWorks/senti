#!/usr/bin/env node
/**
 * src/docs.js
 *
 * Docs dispatcher. Routes docs-related subcommands (including `build`)
 * to the unified dispatcher via `docsCommands` in the command registry.
 */

import { container, initContainer } from "./lib/container.js";
import { docsCommands } from "./lib/command-registry.js";
import { dispatch } from "./lib/dispatcher.js";
import { EXIT_ERROR } from "./lib/constants.js";

initContainer();

const args = process.argv.slice(2);
const subCmd = args[0];
const rest = args.slice(1);

if (!subCmd || subCmd === "-h" || subCmd === "--help") {
  console.error("Usage: senti docs <command>\n");
  console.error("Available commands:");
  for (const c of Object.keys(docsCommands)) console.error(`  ${c}`);
  console.error("\nRun: senti docs <command> --help");
  process.exit(subCmd ? 0 : 1);
}

const entry = docsCommands[subCmd];
if (!entry) {
  console.error(`senti docs: unknown command '${subCmd}'`);
  console.error("Run: senti help");
  process.exit(EXIT_ERROR);
}

await dispatch({ container, entry, argv: rest });
