#!/usr/bin/env node
import { spawnSync } from "node:child_process";

export function createCiStages() {
  return [
    ["node", ["tests/run.js", "--scope", "unit"]],
    ["node", ["tests/run.js", "--scope", "e2e"]],
    ["node", ["--test", "tests/ci/stub-acceptance.test.js"]],
    ["node", ["--test", "tests/ci/cli-smoke.test.js"]],
  ];
}

export function runCiStages(stages, run = (command, args) => spawnSync(command, args, { stdio: "inherit" })) {
  for (const [command, args] of stages) {
    const result = run(command, args);
    if ((result.status ?? 1) !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1]?.endsWith("tests/ci.js")) process.exitCode = runCiStages(createCiStages());
