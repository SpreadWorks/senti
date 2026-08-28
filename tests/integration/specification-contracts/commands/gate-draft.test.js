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
    decisionMap: {
      knownFacts: ["known fact"],
      decisionPoints: ["decision point"],
      resolvedByProjectRules: [],
      requiresUserJudgment: [],
      deferredToSpec: [],
    },
    scopeVerification: { in: ["feature X"], out: ["Y"] },
    impactOnExisting: ["影響なし"],
    questionLedger: {
      revision: 0,
      publication: "fixture",
      evidenceDigest: "a".repeat(64),
      questions: [{
      state: "AnsweredQuestion",
      id: "q1",
      category: "goal-confirmation",
      question: "質問",
      revision: 0,
      provenance: { producer: "fixture" },
      evidenceDigest: "a".repeat(64),
      answer: "回答は十分に具体的です",
      why: "この選択が要求された結果を満たします",
      considered: "",
    }],
    },
    openQuestions: [],
    ...overrides,
  };
}

describe("checkDraftJson", () => {
  it("returns no issues for a valid draft", () => {
    const issues = checkDraftJson(buildValidDraft());
    assert.deepEqual(issues, []);
  });

  it("detects missing Q&A array", () => {
    const issues = checkDraftJson(buildValidDraft({ questionLedger: undefined }));
    assert.ok(issues.some((i) => /questionLedger/i.test(i)), `expected ledger issue, got: ${issues}`);
  });

  it("rejects retired draft approval metadata", () => {
    const issues = checkDraftJson(buildValidDraft({ approval: { approved: false } }));
    assert.ok(issues.some((i) => /unknown field "approval"/i.test(i)), `expected retired approval issue, got: ${issues}`);
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
