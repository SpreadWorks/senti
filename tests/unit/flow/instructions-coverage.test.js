/**
 * tests/unit/flow/instructions-coverage.test.js
 *
 * Coverage check between src/flow/schemas/context-rules.json and the
 * src/flow/prompts/<phase>/<step>.md file tree (spec 203 / cac6/T6).
 *
 * Asserts:
 * - Every instructions_key registered in context-rules.json maps to an
 *   existing file at src/flow/prompts/<phase>/<step>.md.
 * - Every *.md file under src/flow/prompts/ is referenced by at least one
 *   instructions_key (no orphan files).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG_DIR = path.resolve(fileURLToPath(import.meta.url), "../../../../src");
const RULES_PATH = path.join(PKG_DIR, "flow", "schemas", "context-rules.json");
const PROMPTS_DIR = path.join(PKG_DIR, "flow", "prompts");

function loadRules() {
  return JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
}

function collectInstructionKeys(rules) {
  const keys = [];
  for (const scope of Object.keys(rules)) {
    for (const stepId of Object.keys(rules[scope])) {
      const key = rules[scope][stepId].instructions_key;
      if (typeof key === "string") keys.push(key);
    }
  }
  return keys;
}

function collectPromptFiles(dir) {
  const files = [];
  function walk(current, relParts) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, [...relParts, entry.name]);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        const stepName = entry.name.replace(/\.md$/, "");
        files.push({ key: `${relParts.join(".")}.${stepName}`, path: full });
      }
    }
  }
  walk(dir, []);
  return files;
}

function keyToFilePath(key) {
  const parts = key.split(".");
  // Last segment = step file name; everything before = phase directories.
  const stepName = parts.pop();
  return path.join(PROMPTS_DIR, ...parts, `${stepName}.md`);
}

describe("instructions-coverage (registry ↔ prompt files)", () => {
  it("every instructions_key in context-rules.json has a matching prompt file", () => {
    const rules = loadRules();
    const keys = collectInstructionKeys(rules);

    assert.ok(keys.length > 0, "registry has at least one instructions_key");

    const missing = [];
    for (const key of keys) {
      const filePath = keyToFilePath(key);
      if (!fs.existsSync(filePath)) {
        missing.push({ key, expectedPath: path.relative(PKG_DIR, filePath) });
      }
    }

    assert.deepEqual(missing, [],
      `missing prompt files for keys:\n${missing.map((m) => `  ${m.key} -> ${m.expectedPath}`).join("\n")}`);
  });

  it("every prompt file under src/flow/prompts/ is referenced by some instructions_key", () => {
    const rules = loadRules();
    const registeredKeys = new Set(collectInstructionKeys(rules));
    const files = collectPromptFiles(PROMPTS_DIR);

    const orphans = files.filter((f) => !registeredKeys.has(f.key));
    assert.deepEqual(orphans.map((o) => path.relative(PKG_DIR, o.path)), [],
      "orphan prompt files exist (file present but no instructions_key references it)");
  });

  it("registry contains 19 instructions_key entries (spec 226: task-scope reduced to 5 steps)", () => {
    const rules = loadRules();
    const keys = collectInstructionKeys(rules);
    assert.equal(keys.length, 19, "expected 19 instructions_keys (14 flow + 5 task)");
  });
});
