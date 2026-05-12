import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkDraftJson } from "../../../src/flow/lib/run-gate.js";

// spec 229: draft.md → draft.json 移行に伴う gate-draft JSON 検証
// R1: draft.json skeleton, R2: evidence チェック, R3: analysis チェック

const DEV_TYPE_ENUM = ["feature", "bugfix", "refactor", "docs", "chore", "test", "other"];

function buildValidDraft(overrides = {}) {
  const base = {
    devType: "feature",
    goal: "sample goal for testing",
    analysis: {
      problem: "test problem statement",
      proposedApproach: "test proposed approach",
      validation: "test validation result",
    },
    scopeVerification: {
      in: ["item A"],
      out: ["item B"],
    },
    impactOnExisting: ["existing feature X affected"],
    qa: [
      {
        id: "q1",
        status: "answered",
        category: "goal-confirmation",
        question: "Is this correct?",
        answer: "Yes, this is correct.",
        evidence: "verified by code inspection",
        why: "design decision rationale",
        droppedReason: "",
      },
    ],
    openQuestions: [],
    approval: {
      approved: true,
      confirmedAt: "2026-04-25",
      notes: "",
    },
  };
  return { ...base, ...overrides };
}

function assertHasIssue(draft, predicate, label) {
  const issues = checkDraftJson(draft);
  assert.ok(
    issues.some(predicate),
    `expected ${label}, got: ${JSON.stringify(issues)}`,
  );
}

describe("checkDraftJson — valid draft", () => {
  it("returns no issues for a fully populated draft", () => {
    const issues = checkDraftJson(buildValidDraft());
    assert.deepEqual(issues, []);
  });

  for (const v of DEV_TYPE_ENUM) {
    it(`accepts devType "${v}"`, () => {
      const issues = checkDraftJson(buildValidDraft({ devType: v }));
      assert.deepEqual(issues, []);
    });
  }
});

describe("checkDraftJson — analysis validation (R3)", () => {
  it("flags missing analysis object", () => {
    assertHasIssue(
      buildValidDraft({ analysis: undefined }),
      (i) => /analysis/i.test(i),
      "missing analysis",
    );
  });

  it("flags analysis missing problem field", () => {
    assertHasIssue(
      buildValidDraft({ analysis: { proposedApproach: "x", validation: "y" } }),
      (i) => /problem/i.test(i),
      "missing analysis.problem",
    );
  });

  it("flags analysis missing proposedApproach field", () => {
    assertHasIssue(
      buildValidDraft({ analysis: { problem: "x", validation: "y" } }),
      (i) => /proposedApproach/i.test(i),
      "missing analysis.proposedApproach",
    );
  });

  it("flags analysis missing validation field", () => {
    assertHasIssue(
      buildValidDraft({ analysis: { problem: "x", proposedApproach: "y" } }),
      (i) => /validation/i.test(i),
      "missing analysis.validation",
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

describe("checkDraftJson — qa status validation", () => {
  it("flags empty evidence on answered Q&A", () => {
    assertHasIssue(
      buildValidDraft({
        qa: [{
          id: "q1",
          status: "answered",
          category: "goal-confirmation",
          question: "Design choice?",
          answer: "Option A",
          evidence: "",
          why: "because of X",
          droppedReason: "",
        }],
      }),
      (i) => /evidence/i.test(i),
      "empty evidence on answered Q&A",
    );
  });

  it("flags pending Q&A as blocking spec generation", () => {
    assertHasIssue(buildValidDraft({
      qa: [{
        id: "q1",
        status: "pending",
        category: "goal-confirmation",
        question: "Proceed?",
        answer: "",
        evidence: "",
        why: "",
        droppedReason: "",
      }],
    }),
    (i) => /blocks spec generation/i.test(i),
    "pending Q&A blocks spec generation");
  });

  it("flags legacy Q&A entries without id/status", () => {
    const issues = checkDraftJson(buildValidDraft({
      qa: [{
        question: "OK?",
        answer: "Yes",
      }],
    }));
    assert.ok(issues.some((issue) => /schema changed|id\/status/.test(issue)));
  });

  it("allows dropped Q&A with droppedReason only", () => {
    const issues = checkDraftJson(buildValidDraft({
      qa: [{
        id: "q1",
        status: "dropped",
        category: "risk-migration-policy",
        question: "Should this be considered?",
        answer: "",
        evidence: "",
        why: "",
        droppedReason: "Out of scope after user confirmation",
      }],
    }));
    assert.deepEqual(issues, []);
  });
});

describe("checkDraftJson — devType validation", () => {
  it("flags invalid devType", () => {
    assertHasIssue(
      buildValidDraft({ devType: "hotfix" }),
      (i) => /devType|development type/i.test(i),
      "invalid devType",
    );
  });

  it("flags empty devType", () => {
    assertHasIssue(
      buildValidDraft({ devType: "" }),
      (i) => /devType|development type/i.test(i),
      "empty devType",
    );
  });

  it("flags missing devType", () => {
    assertHasIssue(
      buildValidDraft({ devType: undefined }),
      (i) => /devType|development type/i.test(i),
      "missing devType",
    );
  });
});

describe("checkDraftJson — required fields", () => {
  it("flags missing goal", () => {
    assertHasIssue(
      buildValidDraft({ goal: undefined }),
      (i) => /goal|目的/i.test(i),
      "missing goal",
    );
  });

  it("flags empty goal", () => {
    assertHasIssue(
      buildValidDraft({ goal: "" }),
      (i) => /goal|目的/i.test(i),
      "empty goal",
    );
  });

  it("flags missing approval", () => {
    assertHasIssue(
      buildValidDraft({ approval: undefined }),
      (i) => /approval/i.test(i),
      "missing approval",
    );
  });

  it("flags unapproved draft", () => {
    assertHasIssue(
      buildValidDraft({ approval: { approved: false } }),
      (i) => /approval/i.test(i),
      "unapproved draft",
    );
  });

  it("flags missing qa array", () => {
    assertHasIssue(
      buildValidDraft({ qa: undefined }),
      (i) => /qa|q&a/i.test(i),
      "missing qa",
    );
  });
});

describe("checkDraftJson — returns all issues at once", () => {
  it("reports multiple issues for empty object", () => {
    const issues = checkDraftJson({});
    assert.ok(issues.length >= 3, `expected multiple issues, got ${issues.length}: ${issues}`);
  });
});
