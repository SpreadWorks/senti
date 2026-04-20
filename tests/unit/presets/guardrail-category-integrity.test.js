import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  VALID_GUARDRAIL_CATEGORIES,
  VALID_GUARDRAIL_PHASES,
} from "../../../src/lib/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = path.resolve(__dirname, "../../../src/presets");

// Presets are a flat `src/presets/<name>/guardrail.json` layout. Depth of 2 is
// enough to find every file; the cap prevents accidental unbounded recursion
// if the directory layout ever nests (Bounded Resource Usage guardrail).
const MAX_SCAN_DEPTH = 3;

function findGuardrailFiles(dir, depth = 0) {
  if (depth > MAX_SCAN_DEPTH) return [];
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...findGuardrailFiles(full, depth + 1));
    } else if (entry.isFile() && entry.name === "guardrail.json") {
      result.push(full);
    }
  }
  return result;
}

// -----------------------------------------------------------------------------
// REQ-9/10: 全 preset guardrail の phase と category が新語彙集合に含まれる
// -----------------------------------------------------------------------------

describe("preset guardrail phase/category integrity (REQ-9/10)", () => {
  const files = findGuardrailFiles(PRESETS_DIR);

  it("finds at least one preset guardrail.json", () => {
    assert.ok(files.length > 0, "expected to find preset guardrail.json files");
  });

  for (const file of files) {
    const rel = path.relative(PRESETS_DIR, file);
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const entries = data.guardrails || [];

    describe(`preset/${rel}`, () => {
      it("every entry has a category from the enum", () => {
        for (const g of entries) {
          assert.ok(g.meta, `${g.id}: meta missing`);
          assert.ok(
            VALID_GUARDRAIL_CATEGORIES.includes(g.meta.category),
            `${g.id}: category "${g.meta.category}" not in ${VALID_GUARDRAIL_CATEGORIES.join("|")}`,
          );
        }
      });

      it("every phase value is in the new vocabulary", () => {
        for (const g of entries) {
          const phases = g.meta.phase || [];
          for (const p of phases) {
            assert.ok(
              VALID_GUARDRAIL_PHASES.includes(p),
              `${g.id}: phase "${p}" not in new vocabulary`,
            );
          }
        }
      });

      it("no entry carries legacy phase names", () => {
        for (const g of entries) {
          const phases = g.meta.phase || [];
          for (const p of phases) {
            assert.ok(
              !["pre", "post", "impl"].includes(p),
              `${g.id}: legacy phase "${p}" must be migrated`,
            );
          }
        }
      });
    });
  }
});
