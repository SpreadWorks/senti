/**
 * tests/unit/flow/instructions-coverage.test.js
 *
 * Coverage check between src/flow/definition.js instructionsKey values and the
 * src/flow/prompts/<phase>/<step>.md file tree (spec 203 / cac6/T6, updated
 * for spec 236 which replaced context-rules.json with definition.js).
 *
 * Asserts:
 * - Every instructionsKey in the definition maps to an existing file at
 *   src/flow/prompts/<phase>/<step>.md.
 * - Every *.md file under src/flow/prompts/ is referenced by at least one
 *   instructionsKey (no orphan files).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FLOW_DEFINITION, TASK_DEFINITION } from "../../../src/flow/definition.js";

const PKG_DIR = path.resolve(fileURLToPath(import.meta.url), "../../../../src");
const PROMPTS_DIR = path.join(PKG_DIR, "flow", "prompts");

/**
 * Collect instructionsKey values from leaf nodes that require AI prompts.
 * Branch nodes (children != null) and automated steps (no outputSchemaRef)
 * are excluded — they have instructionsKey for metadata but no prompt file.
 */
function collectInstructionKeys(definition) {
  const keys = [];
  function walk(nodes) {
    for (const node of nodes) {
      if (node.children) {
        walk(node.children);
      } else if (node.instructionsKey && node.outputSchemaRef) {
        keys.push(node.instructionsKey);
      }
    }
  }
  walk(definition);
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
  const stepName = parts.pop();
  return path.join(PROMPTS_DIR, ...parts, `${stepName}.md`);
}

describe("instructions-coverage (definition ↔ prompt files)", () => {
  it("every instructionsKey in the definition has a matching prompt file", () => {
    const flowKeys = collectInstructionKeys(FLOW_DEFINITION);
    const taskKeys = collectInstructionKeys(TASK_DEFINITION);
    const keys = [...flowKeys, ...taskKeys];

    assert.ok(keys.length > 0, "definition has at least one instructionsKey");

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

  it("every prompt file under src/flow/prompts/ is referenced by some instructionsKey", () => {
    const flowKeys = collectInstructionKeys(FLOW_DEFINITION);
    const taskKeys = collectInstructionKeys(TASK_DEFINITION);
    const registeredKeys = new Set([...flowKeys, ...taskKeys]);
    const files = collectPromptFiles(PROMPTS_DIR);

    const orphans = files.filter((f) => !registeredKeys.has(f.key));
    assert.deepEqual(orphans.map((o) => path.relative(PKG_DIR, o.path)), [],
      "orphan prompt files exist (file present but no instructionsKey references it)");
  });

  it("every instructionsKey maps to an existing prompt file", () => {
    const flowKeys = collectInstructionKeys(FLOW_DEFINITION);
    const taskKeys = collectInstructionKeys(TASK_DEFINITION);
    const keys = [...flowKeys, ...taskKeys];
    const files = collectPromptFiles(PROMPTS_DIR);
    const fileKeys = new Set(files.map((f) => f.key));

    const missing = keys.filter((k) => !fileKeys.has(k));
    assert.deepEqual(missing, [],
      "instructionsKeys reference non-existent prompt files");
  });
});
