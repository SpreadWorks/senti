/**
 * specs/170-fix-plan-ambiguous-input/tests/verify-spec.test.js
 *
 * Spec verification tests for #170:
 * - R7: plan.approach prompt removed from get-prompt.js
 * - R8: approach step ID removed from SKILL.md
 * - R1/R6: SKILL.md contains interpretation confirmation rules
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

describe("170: plan.approach prompt removed (R7)", () => {
  it("get-prompt.js does not contain plan.approach definition", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "src/flow/lib/get-prompt.js"),
      "utf8",
    );
    assert.ok(
      !content.includes('"plan.approach"'),
      "plan.approach should be removed from get-prompt.js",
    );
  });
});

describe("170: SKILL.md step IDs updated (R8)", () => {
  it("flow-plan SKILL.md does not list approach in step IDs", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "src/templates/skills/sdd-forge.flow-plan/SKILL.md"),
      "utf8",
    );
    const stepIdLine = content
      .split("\n")
      .find((l) => l.includes("Available step IDs"));
    assert.ok(stepIdLine, "Available step IDs line should exist");
    assert.ok(
      !stepIdLine.includes("`approach`"),
      "approach should not be in Available step IDs",
    );
  });
});

describe("170: SKILL.md contains interpretation confirmation (R1, R2, R3)", () => {
  let content;

  it("loads SKILL.md", () => {
    content = fs.readFileSync(
      path.join(ROOT, "src/templates/skills/sdd-forge.flow-plan/SKILL.md"),
      "utf8",
    );
    assert.ok(content.length > 0);
  });

  it("does not offer draft vs spec choice", () => {
    assert.ok(
      !content.includes("Choose approach") &&
        !content.includes("仕様書の作成方法を選択"),
      "Should not offer approach selection",
    );
  });

  it("contains input interpretation rules", () => {
    assert.ok(
      content.includes("#<number>") || content.includes("GitHub Issue"),
      "Should contain #<number> interpretation rule",
    );
  });

  it("mentions autoApprove skip for interpretation confirmation (R6)", () => {
    assert.ok(
      content.includes("autoApprove") && content.includes("skip"),
      "Should mention autoApprove skip behavior",
    );
  });
});
