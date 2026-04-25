import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkDraftJson } from "../../../src/flow/lib/run-gate.js";

// spec 229: draft.md → draft.json 移行。checkDraftText → checkDraftJson に置換。
// 旧テストの検証項目を JSON 版に移行。

const ENUM = ["feature", "bugfix", "refactor", "docs", "chore", "test", "other"];

function buildValidDraft(overrides = {}) {
  return {
    devType: "feature",
    goal: "sample goal",
    analysis: {
      problem: "test problem",
      proposedApproach: "test approach",
      validation: "test validation",
    },
    scopeVerification: { in: ["foo"], out: [] },
    impactOnExisting: ["影響なし"],
    qa: [{ question: "a", answer: "b" }],
    openQuestions: [],
    approval: { approved: true, confirmedAt: "2026-04-25", notes: "" },
    ...overrides,
  };
}

function assertHasIssue(draft, predicate, label) {
  const issues = checkDraftJson(draft);
  assert.ok(
    issues.some(predicate),
    `expected ${label}, got: ${JSON.stringify(issues)}`,
  );
}

describe("checkDraftJson — valid draft (REQ-2/3/6 migration)", () => {
  it("returns no issues for a fully populated draft", () => {
    const issues = checkDraftJson(buildValidDraft());
    assert.deepEqual(issues, []);
  });

  for (const v of ENUM) {
    it(`accepts enum value "${v}"`, () => {
      const issues = checkDraftJson(buildValidDraft({ devType: v }));
      assert.deepEqual(issues, []);
    });
  }
});

describe("checkDraftJson — analysis validation (spec 229 R3)", () => {
  it("flags missing analysis", () => {
    assertHasIssue(
      buildValidDraft({ analysis: undefined }),
      (i) => /analysis/i.test(i),
      "missing analysis",
    );
  });

  it("flags empty analysis.problem", () => {
    assertHasIssue(
      buildValidDraft({ analysis: { problem: "", proposedApproach: "x", validation: "y" } }),
      (i) => /problem/i.test(i),
      "empty analysis.problem",
    );
  });
});

describe("checkDraftJson — enum validation (REQ-3 migration)", () => {
  it("flags an out-of-enum devType value", () => {
    assertHasIssue(
      buildValidDraft({ devType: "hotfix" }),
      (i) => /devType|development type/i.test(i) && i.includes("hotfix"),
      "invalid-devType issue",
    );
  });

  it("flags empty devType as FAIL", () => {
    assertHasIssue(
      buildValidDraft({ devType: "" }),
      (i) => /devType|development type/i.test(i),
      "empty devType FAIL",
    );
  });
});

describe("checkDraftJson — existing checks regression (REQ-6 migration)", () => {
  it("still flags missing qa", () => {
    assertHasIssue(
      buildValidDraft({ qa: undefined }),
      (i) => /qa/i.test(i),
      "qa issue",
    );
  });

  it("still flags missing approval", () => {
    assertHasIssue(
      buildValidDraft({ approval: { approved: false } }),
      (i) => /approval/i.test(i),
      "approval issue",
    );
  });

  it("still flags missing goal", () => {
    assertHasIssue(
      buildValidDraft({ goal: undefined }),
      (i) => /goal/i.test(i),
      "goal issue",
    );
  });

  it("still flags missing devType entirely", () => {
    assertHasIssue(
      buildValidDraft({ devType: undefined }),
      (i) => /devType|development type/i.test(i),
      "devType issue",
    );
  });
});
