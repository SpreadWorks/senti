#!/usr/bin/env node
/**
 * src/spec.js
 *
 * Spec dispatcher. Routes `senti spec <command>` to individual command
 * implementations under src/spec/commands/.
 */

import { EXIT_ERROR } from "./lib/constants.js";
import { container, initContainer } from "./lib/container.js";
import { specCommands } from "./lib/command-registry.js";
import { dispatch } from "./lib/dispatcher.js";

initContainer();

const args = process.argv.slice(2);
const cmd = args[0];
const rest = args.slice(1);

if (!cmd || cmd === "-h" || cmd === "--help") {
  const lines = ["Usage: senti spec <command> [options]", "", "Commands:"];
  for (const name of Object.keys(specCommands)) lines.push(`  ${name}`);
  console.log(lines.join("\n"));
  if (!cmd) process.exit(EXIT_ERROR);
  process.exit(0);
}

const entry = specCommands[cmd];
if (!entry) {
  console.error(`senti spec: unknown command '${cmd}'`);
  console.error("Run: senti spec --help");
  process.exit(EXIT_ERROR);
}

await dispatch({
  container,
  entry,
  argv: rest,
  envelopeType: "spec",
  envelopeKey: cmd,
});
