/**
 * tests/unit/flow/approval-prompt-no-transfer.test.js
 *
 * spec 219 R8: approval プロンプトテンプレートは requirements を手動転記する
 * コマンド手順 (`flow set summary`) を含まない。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("spec 219 R8: approval prompt does not instruct manual requirements transfer", () => {
  it("src/flow/prompts/plan/approval.md contains no `flow set summary` instruction", () => {
    const src = fs.readFileSync(path.resolve("src/flow/prompts/plan/approval.md"), "utf8");
    assert.doesNotMatch(
      src,
      /flow\s+set\s+summary/,
      "approval prompt must not include deprecated `flow set summary` step",
    );
  });

  it("documents the guarded cataloged view in the Flow skill without a persistent approval render", () => {
    const approvalPrompt = fs.readFileSync(path.resolve("src/flow/prompts/plan/approval.md"), "utf8");
    const skill = fs.readFileSync(path.resolve("src/skills/sennel.flow/SKILL.md"), "utf8");

    assert.doesNotMatch(approvalPrompt, /flow get artifact/i);
    assert.doesNotMatch(approvalPrompt, /rendered `spec\.md`/i);
    assert.match(approvalPrompt, /must not render or update a persistent `spec\.md` view/i);
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
