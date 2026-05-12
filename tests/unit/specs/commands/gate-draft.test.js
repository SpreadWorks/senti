import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkDraftJson } from "../../../../src/flow/lib/run-gate.js";

// Migrated from checkDraftText to checkDraftJson (spec 229)

function buildValidDraft(overrides = {}) {
  return {
    devType: "feature",
    goal: "テスト用の機能を追加する",
    analysis: {
      problem: "test problem",
      proposedApproach: "test approach",
      validation: "test validation",
    },
    scopeVerification: { in: ["feature X"], out: ["Y"] },
    impactOnExisting: ["影響なし"],
    qa: [{
      id: "q1",
      status: "answered",
      category: "goal-confirmation",
      question: "質問",
      answer: "回答は十分に具体的です",
      evidence: "確認済み",
      why: "理由",
      droppedReason: "",
    }],
    openQuestions: [],
    approval: { approved: true, confirmedAt: "2026-04-25", notes: "" },
    ...overrides,
  };
}

describe("checkDraftJson", () => {
  it("returns no issues for a valid draft", () => {
    const issues = checkDraftJson(buildValidDraft());
    assert.deepEqual(issues, []);
  });

  it("detects missing Q&A array", () => {
    const issues = checkDraftJson(buildValidDraft({ qa: undefined }));
    assert.ok(issues.some((i) => /qa/i.test(i)), `expected Q&A issue, got: ${issues}`);
  });

  it("detects missing user approval", () => {
    const issues = checkDraftJson(buildValidDraft({ approval: { approved: false } }));
    assert.ok(issues.some((i) => /approv/i.test(i)), `expected approval issue, got: ${issues}`);
  });

  it("detects missing development type", () => {
    const issues = checkDraftJson(buildValidDraft({ devType: undefined }));
    assert.ok(issues.some((i) => /devType|type/i.test(i)), `expected dev type issue, got: ${issues}`);
  });

  it("detects missing goal", () => {
    const issues = checkDraftJson(buildValidDraft({ goal: undefined }));
    assert.ok(issues.some((i) => /goal/i.test(i)), `expected goal issue, got: ${issues}`);
  });

  it("returns all issues at once", () => {
    const issues = checkDraftJson({});
    assert.ok(issues.length >= 3, `expected multiple issues, got ${issues.length}: ${issues}`);
  });

  it("detects invalid devType enum value", () => {
    const issues = checkDraftJson(buildValidDraft({ devType: "hotfix" }));
    assert.ok(issues.some((i) => /devType|development type/i.test(i)), `expected devType issue, got: ${issues}`);
  });
});
