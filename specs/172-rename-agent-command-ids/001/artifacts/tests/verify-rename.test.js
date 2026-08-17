import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, "..", "..", "..", "src");

const OLD_IDS = [
  "context.search",
  "spec.gate",
  "flow.review.spec",
  "flow.review.draft",
  "flow.review.final",
  "flow.review.test",
  "flow.retro",
];

const NEW_ID_MAP = {
  "flow.context.search": "flow/lib/get-context.js",
  "flow.spec.gate": "flow/lib/run-gate.js",
  "flow.spec.review": "flow/commands/review.js",
  "flow.impl.review.draft": "flow/commands/review.js",
  "flow.impl.review.final": "flow/commands/review.js",
  "flow.test.review": "flow/commands/review.js",
  "flow.finalize.retro": "flow/lib/run-retro.js",
};

const TARGET_FILES = [
  "flow/lib/get-context.js",
  "flow/lib/run-gate.js",
  "flow/commands/review.js",
  "flow/lib/run-retro.js",
];

function readSrc(relPath) {
  return readFileSync(join(srcRoot, relPath), "utf8");
}

describe("rename-agent-command-ids", () => {
  it("old command IDs are not used in target files", () => {
    for (const relPath of TARGET_FILES) {
      const content = readSrc(relPath);
      for (const oldId of OLD_IDS) {
        const patterns = [`"${oldId}"`, `'${oldId}'`];
        for (const pat of patterns) {
          assert.ok(
            !content.includes(pat),
            `Old command ID ${pat} still found in src/${relPath}`
          );
        }
      }
    }
  });

  it("new command IDs are present in the correct files", () => {
    for (const [newId, relPath] of Object.entries(NEW_ID_MAP)) {
      const content = readSrc(relPath);
      assert.ok(
        content.includes(`"${newId}"`) || content.includes(`'${newId}'`),
        `New command ID "${newId}" not found in src/${relPath}`
      );
    }
  });

  it("config.example.json uses new command IDs", () => {
    const content = readSrc("templates/config.example.json");
    for (const oldId of OLD_IDS) {
      assert.ok(
        !content.includes(`"${oldId}"`),
        `Old command ID "${oldId}" still found in config.example.json`
      );
    }
    for (const newId of Object.keys(NEW_ID_MAP)) {
      assert.ok(
        content.includes(`"${newId}"`),
        `New command ID "${newId}" not found in config.example.json`
      );
    }
  });
});
