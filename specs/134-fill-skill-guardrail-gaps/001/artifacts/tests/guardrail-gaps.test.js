/**
 * specs/134-fill-skill-guardrail-gaps/tests/guardrail-gaps.test.js
 *
 * Verify:
 * - AC1: flow-plan SKILL.md spec step references get guardrail spec
 * - AC2: flow-plan SKILL.md test step references get guardrail test + run review --phase test
 * - AC3: flow-impl SKILL.md has gate impl re-validation after code review
 * - AC4: get guardrail accepts test phase without error
 *
 * Run: node --test specs/134-fill-skill-guardrail-gaps/tests/guardrail-gaps.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SKILLS = path.join(ROOT, "src/templates/skills");

describe("134: fill skill guardrail gaps", () => {

  describe("AC1: spec step references get guardrail spec", () => {
    it("flow-plan SKILL.md contains guardrail spec in spec step", () => {
      const content = fs.readFileSync(path.join(SKILLS, "sdd-forge.flow-plan/SKILL.md"), "utf8");
      // Find the "Fill spec" step and check it mentions guardrail spec
      const specStepMatch = content.match(/Fill spec[\s\S]*?(?=\n\d+\.\s)/);
      assert.ok(specStepMatch, "Fill spec step should exist");
      assert.ok(
        specStepMatch[0].includes("guardrail spec") || specStepMatch[0].includes("get guardrail spec"),
        "Fill spec step should reference guardrail spec"
      );
    });
  });

  describe("AC2: test step references guardrail test and review --phase test", () => {
    it("flow-plan SKILL.md test step contains get guardrail test", () => {
      const content = fs.readFileSync(path.join(SKILLS, "sdd-forge.flow-plan/SKILL.md"), "utf8");
      const testStepMatch = content.match(/Test phase[\s\S]*?(?=\n##\s)/);
      assert.ok(testStepMatch, "Test phase step should exist");
      assert.ok(
        testStepMatch[0].includes("guardrail test") || testStepMatch[0].includes("get guardrail test"),
        "Test step should reference guardrail test"
      );
    });

    it("flow-plan SKILL.md test step contains run review --phase test", () => {
      const content = fs.readFileSync(path.join(SKILLS, "sdd-forge.flow-plan/SKILL.md"), "utf8");
      const testStepMatch = content.match(/Test phase[\s\S]*?(?=\n##\s)/);
      assert.ok(testStepMatch, "Test phase step should exist");
      assert.ok(
        testStepMatch[0].includes("review --phase test"),
        "Test step should reference review --phase test"
      );
    });
  });

  describe("AC3: gate impl re-validation after code review", () => {
    it("flow-impl SKILL.md has gate impl re-validation step after review step", () => {
      const content = fs.readFileSync(path.join(SKILLS, "sdd-forge.flow-impl/SKILL.md"), "utf8");
      // There should be a gate impl step that comes AFTER the review step (re-validation)
      // Look for a pattern like "Re-run gate impl" or "gate impl (re-validation)" after review
      const reviewIdx = content.indexOf("Review implementation");
      assert.ok(reviewIdx >= 0, "Review implementation step should exist");
      const afterReview = content.slice(reviewIdx);
      assert.ok(
        /re-?run.*gate.*impl|gate.*impl.*re-?valid/is.test(afterReview),
        "gate impl re-validation should appear after the review step"
      );
    });
  });

  describe("AC4: get guardrail accepts test phase", () => {
    it("get-guardrail.js accepts test as valid phase", async () => {
      const mod = await import(path.join(ROOT, "src/flow/lib/get-guardrail.js"));
      const Command = mod.default;
      const cmd = new Command({ requiresFlow: false });
      // Should not throw for phase=test
      const result = cmd.execute({ root: ROOT, phase: "test" });
      assert.ok(result, "should return a result");
      // Result should have guardrails array (possibly empty)
      assert.ok("guardrails" in result || "markdown" in result || "count" in result,
        "result should contain guardrails data");
    });
  });
});
