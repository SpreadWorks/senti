import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkDraftText } from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// spec 209 REQ-2/REQ-3/REQ-6: draft.md 構造検証
//   - ## Scope Verification と ## Impact on Existing Features の存在
//   - 開発種別の enum 検証
//   - 既存検証（Q&A / 承認 / 目的）の regression チェック
// -----------------------------------------------------------------------------

const ENUM = ["feature", "bugfix", "refactor", "docs", "chore", "test", "other"];

function assertHasIssue(text, predicate, label) {
  const issues = checkDraftText(text);
  assert.ok(
    issues.some(predicate),
    `expected ${label}, got: ${JSON.stringify(issues)}`,
  );
}

function buildValidDraft(overrides = {}) {
  const defaults = {
    devType: "feature",
    goal: "sample goal",
    scope: true,
    impact: true,
    qa: true,
    approved: true,
  };
  const o = { ...defaults, ...overrides };
  const parts = ["# Draft: sample", ""];
  if (o.devType !== null) parts.push(`**開発種別:** ${o.devType}`);
  if (o.goal !== null) parts.push(`**目的:** ${o.goal}`);
  parts.push("");
  if (o.scope) parts.push("## Scope Verification", "- In scope: foo", "");
  if (o.impact) parts.push("## Impact on Existing Features", "- 影響なし", "");
  if (o.qa) parts.push("## Q&A", "- Q: a", "  - A: b", "");
  if (o.approved) parts.push("- [x] User approved this draft");
  return parts.join("\n");
}

describe("checkDraftText — valid draft (REQ-2/3/6)", () => {
  it("returns no issues for a fully populated draft", () => {
    const text = buildValidDraft();
    const issues = checkDraftText(text);
    assert.deepEqual(issues, []);
  });

  for (const v of ENUM) {
    it(`accepts enum value "${v}"`, () => {
      const text = buildValidDraft({ devType: v });
      const issues = checkDraftText(text);
      assert.deepEqual(issues, []);
    });
  }

  it("accepts **Development Type:** (English label)", () => {
    const text = buildValidDraft().replace("**開発種別:** feature", "**Development Type:** feature");
    const issues = checkDraftText(text);
    assert.deepEqual(issues, []);
  });
});

describe("checkDraftText — section requirements (REQ-2)", () => {
  it("flags missing ## Scope Verification", () => {
    assertHasIssue(
      buildValidDraft({ scope: false }),
      (i) => /missing section:\s*##\s*Scope Verification/i.test(i),
      "Scope Verification issue",
    );
  });

  it("flags missing ## Impact on Existing Features", () => {
    assertHasIssue(
      buildValidDraft({ impact: false }),
      (i) => /missing section:\s*##\s*Impact on Existing Features/i.test(i),
      "Impact issue",
    );
  });
});

describe("checkDraftText — enum validation (REQ-3)", () => {
  it("flags an out-of-enum development type value", () => {
    assertHasIssue(
      buildValidDraft({ devType: "hotfix" }),
      (i) =>
        /invalid development type/i.test(i) &&
        i.includes("hotfix") &&
        ENUM.every((v) => i.includes(v)),
      "invalid-dev-type issue listing all enum values",
    );
  });

  it("flags uppercase value as FAIL (case-sensitive)", () => {
    assertHasIssue(
      buildValidDraft({ devType: "Feature" }),
      (i) => /invalid development type/i.test(i),
      "FAIL on uppercase value",
    );
  });

  it("flags empty value as FAIL", () => {
    // Empty value is treated as either "missing development type" or invalid-enum
    const text = buildValidDraft().replace("**開発種別:** feature", "**開発種別:**");
    assertHasIssue(
      text,
      (i) => /development type|開発種別/i.test(i),
      "dev-type-related FAIL",
    );
  });
});

describe("checkDraftText — existing checks regression (REQ-6)", () => {
  it("still flags missing ## Q&A", () => {
    assertHasIssue(
      buildValidDraft({ qa: false }),
      (i) => /missing Q&A section/i.test(i),
      "Q&A issue",
    );
  });

  it("still flags missing approval checkbox", () => {
    assertHasIssue(
      buildValidDraft({ approved: false }),
      (i) => /draft approval is required/i.test(i),
      "approval issue",
    );
  });

  it("still flags missing 目的 field", () => {
    assertHasIssue(
      buildValidDraft({ goal: null }),
      (i) => /missing goal|目的/i.test(i),
      "goal issue",
    );
  });

  it("still flags missing 開発種別 label entirely", () => {
    assertHasIssue(
      buildValidDraft({ devType: null }),
      (i) => /missing development type|開発種別/i.test(i),
      "dev-type label issue",
    );
  });
});
