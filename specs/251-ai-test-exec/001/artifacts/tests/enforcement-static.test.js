// spec: R14
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("single-execution-point regression (251-ai-test-exec)", () => {
  it("R14: known non-test step files do not invoke node --test / npm test / jest / pytest / phpunit", () => {
    const targets = [
      "src/flow/lib/run-retro.js",
      "src/flow/lib/run-gate.js",
      "src/flow/commands/review.js",
    ];
    const forbidden = /\b(node\s+--test|npm\s+(?:run\s+)?test|jest\b|pytest\b|phpunit\b)/;
    for (const rel of targets) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
      assert.ok(!forbidden.test(src), `${rel} must not invoke a test runner directly (single-execution-point rule)`);
    }
  });
});
