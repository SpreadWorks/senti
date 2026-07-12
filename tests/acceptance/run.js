#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { discoverAcceptanceTargets } from "./lib/targets.js";
import { runAcceptanceTargets } from "./lib/run-targets.js";

export function main({ args = process.argv.slice(2), runAcceptanceTargets: runTargets = runAcceptanceTargets } = {}) {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write("Usage: node tests/acceptance/run.js [preset ...]\n");
    return 0;
  }
  return runTargets({
    requested: args,
    discoverTargets: discoverAcceptanceTargets,
    executeTests: (files) => execFileSync("node", ["--test", ...files], { stdio: "inherit", env: process.env }),
    writeError: (message) => process.stderr.write(message),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
