import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolvePresetTestName } from "../../helpers/preset-aliases.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");

const ACCEPTANCE_PRESET_NAMES = [
  "laravel", "symfony", "cakephp2",
  "sample-node-command", "library",
  "php", "node",
  "webapp", "cli", "base",
];

export function listAcceptancePresetNames() {
  return [...ACCEPTANCE_PRESET_NAMES];
}

export function getAcceptanceTarget(name) {
  const presetDirName = resolvePresetTestName(name);
  const testFile = path.join(ROOT, "src", "presets", presetDirName, "tests", "acceptance", "test.js");
  const fixtureDir = path.join(ROOT, "src", "presets", presetDirName, "tests", "acceptance", "fixtures");
  return { name, presetDirName, testFile, fixtureDir };
}

export function getAcceptanceFixtureDir(name) {
  return getAcceptanceTarget(name).fixtureDir;
}

export function getAcceptanceTestFile(name) {
  return getAcceptanceTarget(name).testFile;
}

export function listAcceptanceTargets() {
  return listAcceptancePresetNames().map(getAcceptanceTarget);
}

export function listExistingAcceptanceTargets() {
  return listAcceptanceTargets().filter((target) => fs.existsSync(target.testFile));
}
