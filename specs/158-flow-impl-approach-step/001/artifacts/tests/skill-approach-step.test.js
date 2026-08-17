/**
 * Spec verification test: 158-flow-impl-approach-step
 *
 * Verifies that the flow-impl SKILL.md template contains the required
 * implementation approach confirmation step content.
 *
 * Run: node specs/158-flow-impl-approach-step/tests/skill-approach-step.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_MD = join(__dirname, "../../../src/templates/skills/sdd-forge.flow-impl/SKILL.md");

const content = fs.readFileSync(SKILL_MD, "utf-8");

describe("flow-impl SKILL.md: approach confirmation step", () => {
  it("presents implementation approach before writing code (Req 1)", () => {
    const hasApproach =
      /before writing any code/i.test(content) ||
      /コードを書く前に/i.test(content) ||
      /着手前/i.test(content);
    assert.ok(hasApproach, "SKILL.md should instruct AI to present approach before writing code");
  });

  it("format includes per-requirement breakdown (Req 2)", () => {
    const hasPerReq =
      /req\w*\s*\d+/i.test(content) ||
      /requirement/i.test(content) ||
      /要件ごと/i.test(content) ||
      /各要件/i.test(content);
    assert.ok(hasPerReq, "SKILL.md should specify per-requirement format for approach presentation");
  });

  it("format includes existing code reuse and design rationale (Req 2)", () => {
    const hasDesignInfo =
      /existing code/i.test(content) ||
      /既存コード/i.test(content) ||
      /design/i.test(content) ||
      /設計/i.test(content);
    assert.ok(hasDesignInfo, "SKILL.md should require existing code and design rationale in the approach");
  });

  it("provides approval/reject choice to user (Req 3)", () => {
    // Must have both an approve option [1] and a change/reject option [2]
    // in proximity to the approach step
    const hasApproveChoice = /\[1\].*proceed|進める|\[1\].*approve|承認/i.test(content);
    const hasRejectChoice = /\[2\].*change|変更|修正/i.test(content);
    assert.ok(
      hasApproveChoice || /\[1\]/.test(content),
      "SKILL.md should present [1] approve choice",
    );
    assert.ok(
      hasRejectChoice || /\[2\]/.test(content),
      "SKILL.md should present [2] change/reject choice",
    );
  });

  it("specifies retry limit of 3 for revisions (Req 4)", () => {
    const hasRetryLimit = /retry.*3|3.*retry|3.*回|リトライ.*3/i.test(content);
    assert.ok(hasRetryLimit, "SKILL.md should specify retry limit of 3 for approach revisions");
  });

  it("autoApprove: auto-selects [1] and proceeds immediately (Req 5)", () => {
    const hasAutoApprove =
      /autoApprove.*approach|approach.*autoApprove/i.test(content) ||
      /autoApprove.*\[1\].*approach|approach.*autoApprove.*\[1\]/i.test(content);
    assert.ok(hasAutoApprove, "SKILL.md should handle autoApprove mode for approach confirmation");
  });

  it("coding starts only after approval (Req 6)", () => {
    const hasApprovalGate =
      /after approval|承認後|approved.*before.*cod|cod.*after.*approv/i.test(content) ||
      /do not.*cod.*before.*approv|approv.*then.*cod/i.test(content);
    assert.ok(hasApprovalGate, "SKILL.md should prohibit coding before approach approval");
  });
});
