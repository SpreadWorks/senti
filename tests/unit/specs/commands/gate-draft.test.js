import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkDraftText } from "../../../../src/flow/lib/run-gate.js";

describe("checkDraftText", () => {
  const validDraft = [
    "# Draft: feature-name",
    "",
    "**Issue**: #1",
    "**開発種別:** feature",
    "**目的:** テスト用の機能を追加する",
    "",
    "## Scope Verification",
    "- In scope: feature X",
    "- Out of scope: Y",
    "",
    "## Impact on Existing Features",
    "- 影響なし",
    "",
    "## Q&A サマリー",
    "",
    "### Q1: 質問",
    "- **決定**: 回答",
    "",
    "---",
    "",
    "- [x] User approved this draft",
  ].join("\n");

  it("returns no issues for a valid draft", () => {
    const issues = checkDraftText(validDraft);
    assert.deepEqual(issues, []);
  });

  it("detects missing Q&A section", () => {
    const text = [
      "# Draft: feature-name",
      "**開発種別**: 機能追加",
      "**目的**: テスト用",
      "- [x] User approved this draft",
    ].join("\n");
    const issues = checkDraftText(text);
    assert.ok(issues.some((i) => /q&a/i.test(i)), `expected Q&A issue, got: ${issues}`);
  });

  it("detects missing user approval", () => {
    const text = [
      "# Draft: feature-name",
      "**開発種別**: 機能追加",
      "**目的**: テスト用",
      "## Q&A サマリー",
      "### Q1: 質問",
      "- [ ] User approved this draft",
    ].join("\n");
    const issues = checkDraftText(text);
    assert.ok(issues.some((i) => /approv/i.test(i)), `expected approval issue, got: ${issues}`);
  });

  it("detects missing development type", () => {
    const text = [
      "# Draft: feature-name",
      "**目的**: テスト用",
      "## Q&A サマリー",
      "### Q1: 質問",
      "- [x] User approved this draft",
    ].join("\n");
    const issues = checkDraftText(text);
    assert.ok(issues.some((i) => /type|種別/i.test(i)), `expected dev type issue, got: ${issues}`);
  });

  it("detects missing goal", () => {
    const text = [
      "# Draft: feature-name",
      "**開発種別**: バグ修正",
      "## Q&A サマリー",
      "### Q1: 質問",
      "- [x] User approved this draft",
    ].join("\n");
    const issues = checkDraftText(text);
    assert.ok(issues.some((i) => /goal|目的/i.test(i)), `expected goal issue, got: ${issues}`);
  });

  it("returns all issues at once", () => {
    const text = "# Draft: empty\n";
    const issues = checkDraftText(text);
    assert.ok(issues.length >= 3, `expected multiple issues, got ${issues.length}: ${issues}`);
  });

  it("accepts Japanese approval checkbox", () => {
    const text = [
      "# Draft: feature-name",
      "**開発種別**: 機能追加",
      "**目的**: テスト用",
      "## Q&A サマリー",
      "### Q1: 質問",
      "- [x] ユーザーがこの draft を承認した",
    ].join("\n");
    const issues = checkDraftText(text);
    assert.ok(!issues.some((i) => /approv/i.test(i)), `should accept Japanese approval: ${issues}`);
  });
});
