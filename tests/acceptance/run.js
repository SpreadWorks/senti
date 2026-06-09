#!/usr/bin/env node
/**
 * tests/acceptance/run.js
 *
 * Acceptance test runner. Discovers and runs preset-specific test files.
 *
 * Usage:
 *   node tests/acceptance/run.js           — run all presets
 *   node tests/acceptance/run.js symfony   — run only symfony
 */

import { execFileSync } from "child_process";
import { getAcceptanceTestFile, listAcceptancePresetNames } from "./lib/targets.js";

const ALL_PRESETS = listAcceptancePresetNames();
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node tests/acceptance/run.js [preset ...]

Run acceptance tests for senti presets.

Arguments:
  preset    One or more preset names to test (default: all)

Available presets:
  ${ALL_PRESETS.join(", ")}

Examples:
  node tests/acceptance/run.js              Run all presets
  node tests/acceptance/run.js symfony      Run only symfony
  node tests/acceptance/run.js node laravel Run node and laravel`);
  process.exit(0);
}

const requested = args.filter((a) => !a.startsWith("-"));
const presets = requested.length > 0 ? requested : ALL_PRESETS;

for (const preset of presets) {
  if (!ALL_PRESETS.includes(preset)) {
    console.error(`Unknown preset: ${preset}`);
    console.error(`Available: ${ALL_PRESETS.join(", ")}`);
    process.exit(1);
  }
}

const testFiles = presets.map((preset) => getAcceptanceTestFile(preset));
console.log(`Running acceptance tests for: ${presets.join(", ")}`);

try {
  execFileSync("node", ["--test", ...testFiles], {
    stdio: "inherit",
    env: process.env,
  });
} catch (err) {
  process.exit(err.status || 1);
}
