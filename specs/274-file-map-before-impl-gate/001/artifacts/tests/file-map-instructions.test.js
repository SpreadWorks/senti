// spec: R1 R2 R3 R4 R5
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { getStepInstructions } from "../../../src/flow/lib/get-step-instructions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function assertFileMapGuidance(content, label) {
  assert.match(
    content,
    /file-map\.json[\s\S]{0,240}(before|前).*impl-gate|impl-gate[\s\S]{0,240}(before|前).*file-map\.json/,
    `${label} must say file-map.json is prepared before flow-level impl-gate`,
  );
  assert.match(
    content,
    /sdd-forge flow set files <reqId> <path\.\.\.>/,
    `${label} must include the exact flow set files command example`,
  );
  assert.match(
    content,
    /reqId[\s\S]{0,160}(requirement|要件)/,
    `${label} must explain reqId as a requirement id`,
  );
  assert.match(
    content,
    /(repo-relative|リポジトリ相対)[\s\S]{0,160}(path|パス)/,
    `${label} must explain path as repo-relative`,
  );
  assert.match(
    content,
    /(every|すべて)[\s\S]{0,120}(testable requirement|testable requirement|テスト可能な requirement|テスト可能な要件)/,
    `${label} must require entries for every testable requirement`,
  );
}

test("R1: implement instruction says file-map.json is prepared before flow-level impl-gate", () => {
  const content = getStepInstructions("impl.implement");

  assert.match(
    content,
    /file-map\.json[\s\S]{0,240}(before|前).*impl-gate|impl-gate[\s\S]{0,240}(before|前).*file-map\.json/,
  );
});

test("R2: implement instruction includes command example and argument semantics", () => {
  const content = getStepInstructions("impl.implement");

  assert.match(content, /sdd-forge flow set files <reqId> <path\.\.\.>/);
  assert.match(content, /reqId[\s\S]{0,160}(requirement|要件)/);
  assert.match(content, /(repo-relative|リポジトリ相対)[\s\S]{0,160}(path|パス)/);
});

test("R3: implement instruction requires file-map entries for every testable requirement", () => {
  const content = getStepInstructions("impl.implement");

  assert.match(
    content,
    /(every|すべて)[\s\S]{0,120}(testable requirement|testable requirement|テスト可能な requirement|テスト可能な要件)/,
  );
  assert.match(content, /(at least one|1 件以上)[\s\S]{0,160}(file-map entry|file-map)/);
});

test("R4: flow-level implementation instructions expose complete file-map guidance", () => {
  assertFileMapGuidance(getStepInstructions("impl.implement"), "impl.implement");
  assertFileMapGuidance(getStepInstructions("impl.impl-gate"), "impl.impl-gate");
});

test("R5: file-map command and validation contracts remain in existing modules", () => {
  const setFiles = fs.readFileSync(path.join(ROOT, "src/flow/lib/set-files.js"), "utf8");
  const reqMap = fs.readFileSync(path.join(ROOT, "src/flow/lib/req-map.js"), "utf8");
  const testArtifacts = fs.readFileSync(path.join(ROOT, "src/flow/lib/test-artifacts.js"), "utf8");

  assert.match(setFiles, /usage: flow set files <reqId> <path\.\.\.>/);
  assert.match(reqMap, /const FILE_MAP_NAME = "file-map\.json"/);
  assert.match(testArtifacts, /file-map\.json missing requirement entries/);
});
