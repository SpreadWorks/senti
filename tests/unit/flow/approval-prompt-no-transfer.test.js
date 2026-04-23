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
});
