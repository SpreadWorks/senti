// spec: R3 R4 R48
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("test-result-review step (251-ai-test-exec)", () => {
  it("R3: run-test-result-review.js exists and writes test-result-review.json + .md", () => {
    const p = path.join(REPO_ROOT, "src/flow/lib/run-test-result-review.js");
    assert.ok(fs.existsSync(p), "run-test-result-review.js must exist");
    const src = fs.readFileSync(p, "utf8");
    assert.ok(/test-result-review\.json/.test(src), "must reference test-result-review.json");
    assert.ok(/test-result-review\.md/.test(src), "must reference test-result-review.md");
  });

  it("R4: test-result-review verifies summary completeness (req IDs, duplicates, unknowns)", () => {
    const promptPath = path.join(REPO_ROOT, "src/flow/prompts/impl/test-result-review.md");
    assert.ok(fs.existsSync(promptPath), "test-result-review.md prompt must exist");
    const src = fs.readFileSync(promptPath, "utf8");
    assert.ok(/完備|completeness|要件 ID|missing|duplicate|unknown/i.test(src), "prompt must instruct summary completeness verification");
  });

  it("R48: verdict enum is lowercase ('pass' | 'fail') in artifact schemas", () => {
    const schemaPath = path.join(REPO_ROOT, "src/flow/schemas/test-result-review.schema.json");
    assert.ok(fs.existsSync(schemaPath), "test-result-review.schema.json must exist");
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const verdictEnum = schema?.properties?.verdict?.enum;
    assert.deepEqual(verdictEnum, ["pass", "fail"], `verdict enum must be ['pass', 'fail'] lowercase, got ${JSON.stringify(verdictEnum)}`);
  });
});
