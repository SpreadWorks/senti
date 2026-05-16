/**
 * src/docs/lib/test-env-detection.js
 *
 * analysis.json からテスト環境の有無を自動判定する。
 */

import fs from "fs";
import path from "path";
import { hasMakeTestTarget, readMakefile } from "../../lib/makefile.js";
import { collectTestCommandSources, selectTestCommandSource } from "../../lib/test-command-sources.js";

const TEST_FRAMEWORKS = [
  // Node.js / JavaScript
  "jest", "mocha", "vitest", "ava", "tap", "jasmine",
  // PHP
  "phpunit/phpunit", "pestphp/pest",
];

const MAX_JSON_BYTES = 1024 * 1024;

/**
 * analysis.json のデータからテスト環境を検出する。
 *
 * @param {Object} analysis - analysis.json データ
 * @returns {{ hasTestEnv: boolean, frameworks: string[], testCommand: string|null }}
 */
export function detectTestEnvironment(analysis) {
  const frameworks = [];

  // entries から依存・スクリプト情報を集約
  const entries = analysis.package?.entries || [];
  const devDeps = {};
  const composerDevDeps = {};
  let scripts = null;
  let composerScripts = null;
  let makefileTest = null;
  const configuredTestCommand = analysis?.config?.test?.command || null;

  for (const entry of entries) {
    Object.assign(devDeps, entry.packageDeps?.devDependencies);
    Object.assign(composerDevDeps, entry.composerDeps?.requireDev);
    if (entry.packageScripts) scripts = entry.packageScripts;
    if (entry.composerScripts) composerScripts = entry.composerScripts;
    if (entry.makefileTest) makefileTest = entry.makefileTest;
  }

  // devDependencies からフレームワークを検出
  for (const fw of TEST_FRAMEWORKS) {
    if (devDeps[fw] || composerDevDeps[fw]) {
      frameworks.push(fw);
    }
  }

  const commandInfo = selectTestCommandSource(collectTestCommandSources({
    configuredTestCommand,
    scripts,
    composerScripts,
    makefileTest,
  }));
  const testCommand = commandInfo?.command || null;

  // Node.js 組み込みテスト（node --test）の検出
  if (testCommand && testCommand.includes("node") && testCommand.includes("--test")) {
    if (!frameworks.includes("node:test")) {
      frameworks.push("node:test");
    }
  }

  const hasTestEnv = frameworks.length > 0 || testCommand !== null;

  return { hasTestEnv, frameworks, testCommand };
}

function readBoundedJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_JSON_BYTES) {
    throw new Error(`${path.basename(filePath)} is too large to inspect: ${stat.size} bytes`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function detectTestCommandFromRoot(root, config = {}) {
  const pkg = readBoundedJsonIfExists(path.join(root, "package.json"));
  const composer = readBoundedJsonIfExists(path.join(root, "composer.json"));
  const makefilePath = path.join(root, "Makefile");
  const makefileTest = hasMakeTestTarget(readMakefile(makefilePath));
  return selectTestCommandSource(collectTestCommandSources({
    configuredTestCommand: config?.test?.command || null,
    scripts: pkg?.scripts || null,
    composerScripts: composer?.scripts || null,
    makefileTest,
  }));
}
