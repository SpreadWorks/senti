/**
 * tests/integration/flow/approval-prompt-no-transfer.test.js
 *
 * spec 219 R8: approval プロンプトテンプレートは requirements を手動転記する
 * コマンド手順 (`flow set summary`) を含まない。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { APPROVAL_WORKER_INSTRUCTIONS } from "../../support/infrastructure/approval-worker-contract.js";

describe("spec 219 R8: approval prompt does not instruct manual requirements transfer", () => {
  it("src/flow/prompts/plan/approval.md contains no `flow set summary` instruction", () => {
    const src = fs.readFileSync(path.resolve("src/flow/prompts/plan/approval.md"), "utf8");
    assert.doesNotMatch(
      src,
      /flow\s+set\s+summary/,
      "approval prompt must not include deprecated `flow set summary` step",
    );
  });

  it("preserves the pre-view approval worker instruction bytes", () => {
    const approvalPrompt = fs.readFileSync(path.resolve("src/flow/prompts/plan/approval.md"), "utf8");
    assert.equal(approvalPrompt, APPROVAL_WORKER_INSTRUCTIONS);
  });

  it("documents the guarded cataloged view in the Flow skill", () => {
    const skill = fs.readFileSync(path.resolve("src/skills/sennel.flow/SKILL.md"), "utf8");

    assert.match(skill, /sennel flow get artifact spec\.record --mode summary --expect-binding <binding>/);
    assert.match(skill, /sennel flow get artifact spec\.record --mode full --expect-binding <binding>/);
    assert.match(skill, /sennel flow get next-action --expect-binding <binding>/);
    assert.match(skill, /scene=approval/);
    assert.match(skill, /logicalKey=spec\.record/);
    assert.match(skill, /spec \+ inline tasks/);
    assert.match(skill, /cataloged `spec\.record`\s+artifact/);
    assert.match(skill, /non-regenerable evidence/);
  });
});
