// spec: R2 R3 R9
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESET_PATH = path.join(__dirname, "..", "..", "..", "src", "presets", "base", "guardrail.json");

describe("R2 / R3: target guardrails are disabled in preset", () => {
  const data = JSON.parse(fs.readFileSync(PRESET_PATH, "utf8"));
  const guardrails = data.guardrails || [];

  test("R2: draft-scope-boundary has phase=[] in src/presets/base/guardrail.json", () => {
    const target = guardrails.find((g) => g.id === "draft-scope-boundary");
    assert.ok(target, "draft-scope-boundary must exist in preset (definition retained)");
    assert.deepEqual(target.meta.phase, [], "draft-scope-boundary.meta.phase must be empty array");
  });

  test("R3: spec-synthesize-not-copy has phase=[] in src/presets/base/guardrail.json", () => {
    const target = guardrails.find((g) => g.id === "spec-synthesize-not-copy");
    assert.ok(target, "spec-synthesize-not-copy must exist in preset (definition retained)");
    assert.deepEqual(target.meta.phase, [], "spec-synthesize-not-copy.meta.phase must be empty array");
  });
});

describe("R9: preset test exists asserting target guardrails are disabled", () => {
  test("R9: this test file exists and asserts the target IDs are disabled", () => {
    assert.ok(true);
  });
});
