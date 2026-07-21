#!/usr/bin/env node
import { existsSync, readdirSync, statSync, writeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getPresetAliasNames, resolvePresetTestName } from "./helpers/preset-aliases.js";
import { globFilesSync } from "./helpers/test-file-glob.js";
import { buildSearchDirs } from "./helpers/test-runner-search-dirs.js";
import {
  formatLabelSummary,
  groupTestFilesByCategory,
  parsePassCount,
} from "./helpers/test-runner-labels.js";
import { resolveTestFiles } from "./helpers/test-selection.js";
import { TestRunner } from "./helpers/test-runner.js";
import {
  processResultFromSpawnSync,
} from "../src/flow/lib/test-regression.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = fileURLToPath(import.meta.url);

function getRealPresetNames() {
  return [];
}

function getPresetNames() {
  return [...new Set([...getRealPresetNames(), ...getPresetAliasNames()])];
}

function resolveFiles(selection) {
  const searchDirs = buildSearchDirs(
    { root: ROOT },
    {
      preset: selection.preset,
      scope: selection.scope,
      agent: selection.mode === "agent",
      all: selection.mode === "all",
      presetDirName: selection.preset ? resolvePresetTestName(selection.preset) : null,
      realPresetNames: getRealPresetNames(),
    },
  );
  return resolveTestFiles(selection, {
    root: ROOT,
    existsSync,
    statSync,
    readdirSync,
    globSync: globFilesSync,
    searchDirs,
  });
}

function formatExecutionSummary(counts, incompleteCategories) {
  if (incompleteCategories.size === 0) return formatLabelSummary(counts);
  return ["unit", "integration", "acceptance"]
    .map((category) => incompleteCategories.has(category) ? `${category}: not completed` : `${category}: ${counts[category]}`)
    .join("\n");
}

export function executeFiles(files, { spawn = spawnSync, write = writeSync, root = ROOT } = {}) {
  const groups = groupTestFilesByCategory(files.map((file) => resolve(root, file)));
  const counts = { unit: 0, integration: 0, acceptance: 0 };
  const incompleteCategories = new Set();
  let sawFailure = false;
  let firstNumericFailure = null;
  for (const category of ["unit", "integration", "acceptance", "other"]) {
    if (groups[category].length === 0) continue;
    const command = ["node", "--test", ...groups[category]];
    const result = spawn(command[0], command.slice(1), {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const execution = processResultFromSpawnSync(command, result);
    if (execution.stdout) write(1, execution.stdout);
    if (execution.stderr) write(2, execution.stderr);
    if (execution.completed && category !== "other") {
      counts[category] = parsePassCount(execution.stdout + execution.stderr);
    } else if (!execution.completed && category !== "other") {
      incompleteCategories.add(category);
    }
    if (execution.kind !== "passed") {
      sawFailure = true;
      if (firstNumericFailure === null && Number.isInteger(execution.exitCode) && execution.exitCode !== 0) {
        firstNumericFailure = execution.exitCode;
      }
      write(2, `\n[senti] test suite process result\n${execution.diagnosticLines().join("\n")}\n`);
    }
  }
  write(1, `\n${formatExecutionSummary(counts, incompleteCategories)}\n`);
  return firstNumericFailure ?? (sawFailure ? 1 : 0);
}

export function main(args = process.argv.slice(2)) {
  const runner = new TestRunner({
    presetNames: getPresetNames(),
    resolveFiles,
    executeFiles,
  });
  const result = runner.run(args);
  if (result.stdout) writeSync(1, result.stdout);
  if (result.stderr) writeSync(2, result.stderr);
  return result.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  process.exitCode = main();
}
