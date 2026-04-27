#!/usr/bin/env node
import { readdirSync, existsSync, statSync, globSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { writeSync } from "node:fs";
import { getPresetAliasNames, resolvePresetTestName } from "./helpers/preset-aliases.js";
import { groupTestFilesByCategory, formatLabelSummary } from "./helpers/test-runner-labels.js";
import { buildSearchDirs, validateFlags } from "./helpers/test-runner-search-dirs.js";

const ROOT = resolve(import.meta.dirname, "..");
const PRESETS_DIR = join(ROOT, "src", "presets");
const MAX_COLLECTED = 10000;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

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

function collectFromFileSpec({ fileArgs, patternArgs, positionalArgs }) {
  const collected = [];

  for (const f of fileArgs) {
    const abs = resolve(f);
    if (!existsSync(abs)) fail(`file not found: ${f}`);
    collected.push(abs);
  }

  for (const pat of patternArgs) {
    const rawMatches = globSync(pat);
    if (rawMatches.length > MAX_COLLECTED) {
      fail(`pattern "${pat}" matched ${rawMatches.length} files (limit: ${MAX_COLLECTED})`);
    }
    const matches = rawMatches.filter((m) => m.endsWith(".test.js"));
    if (matches.length === 0) fail(`no files matched pattern: ${pat}`);
    for (const m of matches) {
      if (collected.length >= MAX_COLLECTED) fail(`too many files collected (limit: ${MAX_COLLECTED})`);
      collected.push(resolve(m));
    }
  }

  for (const p of positionalArgs) {
    const abs = resolve(p);
    if (!existsSync(abs)) fail(`path not found: ${p}`);
    if (statSync(abs).isDirectory()) {
      const dirFiles = [];
      walk(abs, dirFiles);
      for (const df of dirFiles) {
        if (collected.length >= MAX_COLLECTED) fail(`too many files collected (limit: ${MAX_COLLECTED})`);
        collected.push(df);
      }
    } else {
      collected.push(abs);
    }
  }

  return [...new Set(collected)];
}

function collectFromSearchDirs({ preset, scope, agent, all }) {
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
  return findTestFiles(searchDirs);
}

const args = process.argv.slice(2);
const presetIdx = args.indexOf("--preset");
const scopeIdx = args.indexOf("--scope");
const agent = args.includes("--agent");
const all = args.includes("--all");

const fileArgs = [];
const patternArgs = [];
const positionalArgs = [];

{
  const knownFlags = new Set(["--preset", "--scope", "--agent", "--all", "--file", "--pattern"]);
  const valueFlags = new Set(["--preset", "--scope", "--file", "--pattern"]);
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--file") {
      const val = args[i + 1];
      if (!val || val.startsWith("--")) fail("--file requires a value");
      fileArgs.push(val);
      i += 2;
    } else if (arg === "--pattern") {
      const val = args[i + 1];
      if (!val || val.startsWith("--")) fail("--pattern requires a value");
      patternArgs.push(val);
      i += 2;
    } else if (knownFlags.has(arg)) {
      i += valueFlags.has(arg) ? 2 : 1;
    } else if (!arg.startsWith("--")) {
      positionalArgs.push(arg);
      i += 1;
    } else {
      i += 1;
    }
  }
}

const hasFile = fileArgs.length > 0;
const hasPattern = patternArgs.length > 0;
const hasPositional = positionalArgs.length > 0;
const fileSpecMode = hasFile || hasPattern || hasPositional;

let preset = null;
if (presetIdx !== -1) {
  preset = args[presetIdx + 1];
  if (!preset) fail("--preset requires a value");
  const valid = getPresetNames();
  if (!valid.includes(preset)) {
    fail(`unknown preset "${preset}". Available: ${valid.join(", ")}`);
  }
}

let scope = null;
if (scopeIdx !== -1) {
  scope = args[scopeIdx + 1];
  if (!scope || !["unit", "e2e"].includes(scope)) fail("--scope must be 'unit' or 'e2e'");
}

const validation = validateFlags({ agent, all, preset, scope, hasFile, hasPattern, hasPositional });
if (validation.error) fail(validation.error);

const testFiles = fileSpecMode
  ? collectFromFileSpec({ fileArgs, patternArgs, positionalArgs })
  : collectFromSearchDirs({ preset, scope, agent, all });

if (testFiles.length === 0) fail("No test files found");

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
