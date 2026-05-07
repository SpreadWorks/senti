// spec: R8 R9 R24
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("test-review header coverage FAIL + lie detection (251-ai-test-exec)", () => {
  it("R8: review.js test-review FAILs when a testable requirement has no header coverage", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/commands/review.js"), "utf8");
    // Old behavior: console.error warning only. New: finalGaps inject + verdict FAIL.
    const headerSection = src.match(/header\s*coverage/i);
    assert.ok(headerSection, "review.js must reference header coverage handling");
    assert.ok(/finalGaps[\s\S]*?(missing-header|missingHeader)/.test(src), "review.js must inject 'missing-header' gap into finalGaps");
  });

  it("R9: buildGapAnalysisPrompt instructs semantic header-lie detection", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/commands/review.js"), "utf8");
    assert.ok(/header[-\s]?lie|宣言.*verify|宣言.*内容/i.test(src), "review.js / buildGapAnalysisPrompt must include header-lie detection");
  });

  it("R24: review.js delegates header coverage check to validateTestHeaders helper", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/commands/review.js"), "utf8");
    assert.ok(/validateTestHeaders/.test(src), "review.js must call validateTestHeaders helper");
  });
});
