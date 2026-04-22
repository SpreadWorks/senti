#!/usr/bin/env node
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { writeSync } from "node:fs";
import { getPresetAliasNames, resolvePresetTestName } from "./helpers/preset-aliases.js";
import { groupTestFilesByCategory, formatLabelSummary } from "./helpers/test-runner-labels.js";
import { buildSearchDirs, validateFlags } from "./helpers/test-runner-search-dirs.js";

const ROOT = resolve(import.meta.dirname, "..");
const PRESETS_DIR = join(ROOT, "src", "presets");

function findTestFiles(dirs) {
  const files = [];
  for (const dir of dirs) {
    walk(dir, files);
  }
  return files;
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith(".test.js")) out.push(full);
  }
}

function getRealPresetNames() {
  return readdirSync(PRESETS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

function getPresetNames() {
  return [...new Set([...getRealPresetNames(), ...getPresetAliasNames()])];
}

const args = process.argv.slice(2);
const presetIdx = args.indexOf("--preset");
const scopeIdx = args.indexOf("--scope");
const agent = args.includes("--agent");
const all = args.includes("--all");

let preset = null;
if (presetIdx !== -1) {
  preset = args[presetIdx + 1];
  if (!preset) {
    console.error("Error: --preset requires a value");
    process.exit(1);
  }
  const valid = getPresetNames();
  if (!valid.includes(preset)) {
    console.error(`Error: unknown preset "${preset}". Available: ${valid.join(", ")}`);
    process.exit(1);
  }
}

let scope = null;
if (scopeIdx !== -1) {
  scope = args[scopeIdx + 1];
  if (!scope || !["unit", "e2e"].includes(scope)) {
    console.error("Error: --scope must be 'unit' or 'e2e'");
    process.exit(1);
  }
}

const validation = validateFlags({ agent, all, preset, scope });
if (validation.error) {
  console.error(`Error: ${validation.error}`);
  process.exit(1);
}

const searchDirs = buildSearchDirs(
  { root: ROOT },
  {
    preset,
    scope,
    agent,
    all,
    presetDirName: preset ? resolvePresetTestName(preset) : null,
    realPresetNames: getRealPresetNames(),
  },
);

const testFiles = findTestFiles(searchDirs);
if (testFiles.length === 0) {
  console.error("No test files found");
  process.exit(1);
}

function runNodeTests(files) {
  const res = spawnSync("node", ["--test", ...files], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const stdout = res.stdout || "";
  const stderr = res.stderr || "";
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  const m = /^\s*#\s*pass\s+(\d+)\s*$/m.exec(stdout + stderr);
  return {
    status: res.status ?? 1,
    passCount: m ? Number(m[1]) : 0,
  };
}

const groups = groupTestFilesByCategory(testFiles);
const counts = { unit: 0, integration: 0, acceptance: 0 };
let overallExit = 0;

for (const type of ["unit", "integration", "acceptance"]) {
  const files = groups[type];
  if (files.length === 0) continue;
  const { status, passCount } = runNodeTests(files);
  counts[type] = passCount;
  if (status !== 0 && overallExit === 0) overallExit = status;
}

if (groups.other.length > 0) {
  const { status } = runNodeTests(groups.other);
  if (status !== 0 && overallExit === 0) overallExit = status;
}

writeSync(1, "\n" + formatLabelSummary(counts) + "\n");

process.exit(overallExit);
