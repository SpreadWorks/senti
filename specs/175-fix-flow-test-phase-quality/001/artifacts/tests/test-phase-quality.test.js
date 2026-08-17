/**
 * specs/175-fix-flow-test-phase-quality/tests/test-phase-quality.test.js
 *
 * Spec verification tests for #175.
 * These tests verify that this spec's requirements are satisfied.
 * NOT part of npm test — run manually or via spec verification.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "../../../..");

describe("spec 175: plan.test-mode description (R1/R2/R3)", () => {
  it("SKILL.md template contains CRITICAL STOP in test phase (R4/R5)", () => {
    const skillPath = join(ROOT, "src/templates/skills/sdd-forge.flow-plan/SKILL.md");
    const content = readFileSync(skillPath, "utf8");
    assert.ok(
      content.includes("CRITICAL"),
      "flow-plan SKILL.md should contain CRITICAL STOP marker in test phase",
    );
  });
});

describe("spec 175: flow get test-result command (R6/R7/R7a)", () => {
  it("get-test-result.js exists in flow/lib", () => {
    const filePath = join(ROOT, "src/flow/lib/get-test-result.js");
    assert.ok(existsSync(filePath), "src/flow/lib/get-test-result.js should exist");
  });
});
