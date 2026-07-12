import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const PRESETS_DIR = join(ROOT, "src", "presets");
const TEST_SUFFIX = ["tests", "acceptance", "test.js"];
const FIXTURE_SUFFIX = ["tests", "acceptance", "fixtures"];

export function discoverAcceptanceTargets({ root = ROOT, readdirSync: readDirs = readdirSync, existsSync: pathExists = existsSync, maxDirectories = 1000, maxPathChecks = 2000 } = {}) {
  const presetsDir = join(root, "src", "presets");
  let entries;
  try {
    entries = readDirs(presetsDir, { withFileTypes: true });
  } catch (error) {
    return discoveryError("READ_ERROR", error.message);
  }
  if (entries.length > maxDirectories) return discoveryError("DIRECTORY_LIMIT", `preset directory limit exceeded (${maxDirectories})`);

  const targets = [];
  let pathChecks = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (pathChecks + 2 > maxPathChecks) return discoveryError("PATH_LIMIT", `path check limit exceeded (${maxPathChecks})`);
    const presetDir = join(presetsDir, entry.name);
    const testFile = join(presetDir, ...TEST_SUFFIX);
    const fixtureDir = join(presetDir, ...FIXTURE_SUFFIX);
    pathChecks += 2;
    if (pathExists(testFile) && pathExists(fixtureDir)) targets.push({ name: entry.name, testFile, fixtureDir });
  }
  return { targets, error: null };
}

export function listAcceptanceTargets() {
  return discoverAcceptanceTargets().targets;
}

export function listAcceptancePresetNames() {
  return listAcceptanceTargets().map((target) => target.name);
}

export function getAcceptanceTarget(name) {
  return listAcceptanceTargets().find((target) => target.name === name) || null;
}

export function getAcceptanceFixtureDir(name) {
  const target = getAcceptanceTarget(name);
  if (!target) throw new Error(`unknown acceptance target: ${name}`);
  return target.fixtureDir;
}

export function getAcceptanceTestFile(name) {
  const target = getAcceptanceTarget(name);
  if (!target) throw new Error(`unknown acceptance target: ${name}`);
  return target.testFile;
}

export function listExistingAcceptanceTargets() {
  return listAcceptanceTargets();
}

function discoveryError(code, message) {
  return { targets: [], error: { code, message } };
}
