#!/usr/bin/env node
import { existsSync, globSync, readdirSync, statSync, writeSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { getPresetAliasNames, resolvePresetTestName } from "./helpers/preset-aliases.js";
import { buildSearchDirs } from "./helpers/test-runner-search-dirs.js";
import { formatLabelSummary, groupTestFilesByCategory } from "./helpers/test-runner-labels.js";
import { resolveTestFiles } from "./helpers/test-selection.js";
import { TestRunner } from "./helpers/test-runner.js";

const ROOT = resolve(import.meta.dirname, "..");

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
    globSync,
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
    const pass = /^\s*#\s*pass\s+(\d+)\s*$/m.exec((result.stdout || "") + (result.stderr || ""));
    if (category !== "other") counts[category] = pass ? Number(pass[1]) : 0;
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
