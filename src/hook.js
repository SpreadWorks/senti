#!/usr/bin/env node
/**
 * src/hook.js
 *
 * Hook dispatcher. Routes `sdd-forge hook <command>` to hook management
 * commands.
 */

import { EXIT_ERROR } from "./lib/constants.js";
import { container, initContainer } from "./lib/container.js";
import { hookCommands } from "./lib/command-registry.js";
import { dispatch } from "./lib/dispatcher.js";

initContainer();

const args = process.argv.slice(2);
const subCmd = args[0];
const rest = args.slice(1);

if (!subCmd || subCmd === "-h" || subCmd === "--help") {
  console.error("Usage: sdd-forge hook <command>\n");
  console.error("Available commands:");
  for (const c of Object.keys(hookCommands)) console.error(`  ${c}`);
  console.error("\nRun: sdd-forge hook <command> --help");
  process.exit(subCmd ? 0 : EXIT_ERROR);
}

const entry = hookCommands[subCmd];
if (!entry) {
  console.error(`sdd-forge hook: unknown command '${subCmd}'`);
  console.error("Run: sdd-forge hook --help");
  process.exit(EXIT_ERROR);
}

await dispatch({
  container,
  entry,
  argv: rest,
  envelopeType: "hook",
  envelopeKey: subCmd,
});
