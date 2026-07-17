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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

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

function executeFiles(files) {
  const groups = groupTestFilesByCategory(files.map((file) => resolve(ROOT, file)));
  const counts = { unit: 0, integration: 0, acceptance: 0 };
  let exitCode = 0;
  for (const category of ["unit", "integration", "acceptance", "other"]) {
    if (groups[category].length === 0) continue;
    const result = spawnSync("node", ["--test", ...groups[category]], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (result.stdout) writeSync(1, result.stdout);
    if (result.stderr) writeSync(2, result.stderr);
    if (category !== "other") {
      counts[category] = parsePassCount((result.stdout || "") + (result.stderr || ""));
    }
    if ((result.status ?? 1) !== 0 && exitCode === 0) exitCode = result.status ?? 1;
  }
  writeSync(1, `\n${formatLabelSummary(counts)}\n`);
  return exitCode;
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

process.exitCode = main();
