import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { checkDraftJson } from "../../../src/flow/lib/run-gate.js";

const DEV_TYPE_ENUM = ["feature", "bugfix", "refactor", "docs", "chore", "test", "other"];
const DIGEST = "a".repeat(64);

function question(overrides = {}) {
  return {
    state: "AnsweredQuestion",
    id: "q1",
    category: "goal-confirmation",
    question: "Is this draft contract correct?",
    revision: 0,
    provenance: { producer: "fixture", source: "test" },
    evidenceDigest: DIGEST,
    answer: "Yes, this contract is correct for the requested behavior.",
    why: "The repository evidence and requested outcome select this design.",
    considered: "The incompatible alternative was rejected after reviewing its public impact.",
    ...overrides,
  };
}

function ledger(questions = [question()], overrides = {}) {
  return {
    revision: 0,
    publication: "fixture-publication",
    evidenceDigest: DIGEST,
    questions,
    ...overrides,
  };
}

function buildValidDraft(overrides = {}) {
  const base = {
    devType: "feature",
    goal: "sample goal for testing",
    analysis: {
      problem: "test problem statement",
      proposedApproach: "test proposed approach",
      validation: "test validation result",
    },
    decisionMap: {
      knownFacts: ["known fact from source"],
      decisionPoints: ["decision point covered by the spec"],
      resolvedByProjectRules: ["project rule decides this"],
      requiresUserJudgment: [],
      deferredToSpec: ["detail can be finalized in spec"],
    },
    scopeVerification: { in: ["item A"], out: ["item B"] },
    impactOnExisting: ["existing feature X affected"],
    questionLedger: ledger(),
    openQuestions: [],
    approval: { approved: true, confirmedAt: "2026-04-25", notes: "" },
  };
  return { ...base, ...overrides };
}

function assertHasIssue(draft, predicate, label) {
  const issues = checkDraftJson(draft);
  assert.ok(issues.some(predicate), `expected ${label}, got: ${JSON.stringify(issues)}`);
}

describe("checkDraftJson — valid draft", () => {
  it("returns no issues for a fully populated draft", () => {
    assert.deepEqual(checkDraftJson(buildValidDraft()), []);
  });

  it("accepts an empty ledger when no user decision remains", () => {
    assert.deepEqual(checkDraftJson(buildValidDraft({ questionLedger: ledger([]) })), []);
  });

  for (const value of DEV_TYPE_ENUM) {
    it(`accepts devType "${value}"`, () => {
      assert.deepEqual(checkDraftJson(buildValidDraft({ devType: value })), []);
    });
  }
});

describe("checkDraftJson — decisionMap validation", () => {
  it("flags missing decisionMap object", () => {
    assertHasIssue(buildValidDraft({ decisionMap: undefined }), (issue) => /decisionMap/i.test(issue), "missing decisionMap");
  });

  it("flags non-array decisionMap fields", () => {
    assertHasIssue(buildValidDraft({ decisionMap: { knownFacts: "fact" } }), (issue) => /decisionMap\.knownFacts.*array/i.test(issue), "non-array decisionMap field");
  });

  it("flags empty strings in decisionMap arrays", () => {
    assertHasIssue(buildValidDraft({
      decisionMap: { knownFacts: [""], decisionPoints: [], resolvedByProjectRules: [], requiresUserJudgment: [], deferredToSpec: [] },
    }), (issue) => /decisionMap\.knownFacts\[0\].*non-empty string/i.test(issue), "empty decisionMap entry");
  });

  it("flags unknown decisionMap fields", () => {
    assertHasIssue(buildValidDraft({
      decisionMap: {
        knownFacts: [], decisionPoints: [], resolvedByProjectRules: [], requiresUserJudgment: [], deferredToSpec: [], retired: [],
      },
    }), (issue) => /decisionMap: unknown field/i.test(issue), "unknown decisionMap field");
  });
});

describe("checkDraftJson — analysis validation", () => {
  it("flags missing analysis object", () => {
    assertHasIssue(buildValidDraft({ analysis: undefined }), (issue) => /analysis/i.test(issue), "missing analysis");
  });

  for (const [field, analysis] of [
    ["problem", { proposedApproach: "x", validation: "y" }],
    ["proposedApproach", { problem: "x", validation: "y" }],
    ["validation", { problem: "x", proposedApproach: "y" }],
  ]) {
    it(`flags analysis missing ${field}`, () => {
      assertHasIssue(buildValidDraft({ analysis }), (issue) => issue.includes(field), `missing analysis.${field}`);
    });
  }

  it("flags empty analysis.problem", () => {
    assertHasIssue(buildValidDraft({ analysis: { problem: "", proposedApproach: "x", validation: "y" } }), (issue) => /problem/i.test(issue), "empty analysis.problem");
  });
});

describe("checkDraftJson — typed question ledger lifecycle", () => {
  it("rejects retired qa input rather than reading legacy pending or approved status", () => {
    assertHasIssue({ ...buildValidDraft(), qa: [{ status: "pending" }] }, (issue) => /schema changed/i.test(issue), "legacy qa rejection");
  });

  it("requires a ledger", () => {
    assertHasIssue(buildValidDraft({ questionLedger: undefined }), (issue) => /questionLedger/i.test(issue), "missing ledger");
  });

  it("rejects an invalid state tag and unknown state field", () => {
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ state: "pending" })]) }), (issue) => /invalid state/i.test(issue), "invalid state tag");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ leaked: "qa evidence" })]) }), (issue) => /unsupported field/i.test(issue), "unknown state field");
  });

  it("validates category enum, id/order, revisions, provenance, and digests", () => {
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ category: "other" })]) }), (issue) => /category/i.test(issue), "category");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ id: "question-1" })]) }), (issue) => /id must match/i.test(issue), "id");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question(), question({ id: "q1" })]) }), (issue) => /duplicate id/i.test(issue), "duplicate id");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ id: "q2" }), question({ id: "q1" })]) }), (issue) => /stable q<N> order/i.test(issue), "order");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ revision: -1 })]) }), (issue) => /revision/i.test(issue), "revision");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ provenance: {} })]) }), (issue) => /provenance/i.test(issue), "provenance");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ evidenceDigest: "evidence" })]) }), (issue) => /evidenceDigest/i.test(issue), "evidence digest");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question()], { evidenceDigest: "evidence" }) }), (issue) => /ledger evidenceDigest/i.test(issue), "ledger digest");
  });

  it("requires exact state-specific fields", () => {
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ state: "CandidateQuestion" })]) }), (issue) => /unsupported field/i.test(issue), "Candidate forbidden answer fields");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([{ ...question({ state: "ResolvedByExistingInformation" }), resolution: "Repository policy answers this question." }]) }), (issue) => /unsupported field/i.test(issue), "Resolved forbidden answer fields");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([{ ...question(), answer: undefined }]) }), (issue) => /answer.*non-empty|required/i.test(issue), "Answered answer");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([{ ...question(), why: "" }]) }), (issue) => /why/i.test(issue), "Answered why");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([{ ...question(), considered: 1 }]) }), (issue) => /considered.*string/i.test(issue), "Answered considered type");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([{ ...question({ state: "DiscardedQuestion" }), reason: "" }]) }), (issue) => /reason/i.test(issue), "Discarded reason");
  });

  it("accepts terminal exclusive states with their exact required fields", () => {
    const base = { id: "q1", category: "goal-confirmation", question: "Which contract applies?", revision: 0, provenance: { producer: "fixture" }, evidenceDigest: DIGEST };
    const values = [
      { state: "ResolvedByExistingInformation", ...base, resolution: "Repository policy resolves this question." },
      { state: "AnsweredQuestion", ...base, answer: "The public behavior remains stable.", why: "The request and source evidence require this behavior.", considered: "Changing the behavior was rejected because it would break callers." },
      { state: "DiscardedQuestion", ...base, reason: "This decision belongs to the specification stage." },
    ];
    values.forEach((value) => assert.deepEqual(checkDraftJson(buildValidDraft({ questionLedger: ledger([value]) })), []));
  });

  it("blocks CandidateQuestion and AwaitingUserAnswer at draft-gate", () => {
    for (const state of ["CandidateQuestion", "AwaitingUserAnswer"]) {
      const value = {
        state,
        id: "q1",
        category: "goal-confirmation",
        question: "Which contract applies?",
        revision: 0,
        provenance: { producer: "fixture" },
        evidenceDigest: DIGEST,
      };
      assertHasIssue(
        buildValidDraft({ questionLedger: ledger([value]) }),
        (issue) => new RegExp(`${state} blocks spec generation`).test(issue),
        `${state} blocks gate`,
      );
    }
  });

  it("rejects shallow answers and ambiguous wording", () => {
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ answer: "yes" })]) }), (issue) => /shallow/i.test(issue), "shallow answer");
    assertHasIssue(buildValidDraft({ questionLedger: ledger([question({ why: "適切に決める" })]) }), (issue) => /ambiguous/i.test(issue), "ambiguous wording");
  });

  it("rejects normalized duplicate non-discarded questions but permits discarded duplicates", () => {
    assertHasIssue(buildValidDraft({
      questionLedger: ledger([question(), question({ id: "q2", question: "  IS this draft contract correct?  " })]),
    }), (issue) => /duplicate question/i.test(issue), "normalized duplicate question");
    const discarded = {
      state: "DiscardedQuestion", id: "q2", category: "goal-confirmation", question: "IS this draft contract correct?", revision: 0,
      provenance: { producer: "fixture" }, evidenceDigest: DIGEST, reason: "The duplicate was intentionally discarded as out of scope.",
    };
    assert.deepEqual(checkDraftJson(buildValidDraft({ questionLedger: ledger([question(), discarded]) })), []);
  });
});

describe("checkDraftJson — devType and required fields", () => {
  for (const value of ["hotfix", "", undefined]) {
    it(`flags invalid devType ${String(value)}`, () => {
      assertHasIssue(buildValidDraft({ devType: value }), (issue) => /devType/i.test(issue), "invalid devType");
    });
  }

  it("flags missing or empty goal", () => {
    assertHasIssue(buildValidDraft({ goal: undefined }), (issue) => /goal/i.test(issue), "missing goal");
    assertHasIssue(buildValidDraft({ goal: "" }), (issue) => /goal/i.test(issue), "empty goal");
  });

  it("flags missing or unapproved approval", () => {
    assertHasIssue(buildValidDraft({ approval: undefined }), (issue) => /approval/i.test(issue), "missing approval");
    assertHasIssue(buildValidDraft({ approval: { approved: false } }), (issue) => /approval/i.test(issue), "unapproved draft");
  });
});

describe("checkDraftJson — returns all issues at once", () => {
  it("reports multiple issues for an empty object", () => {
    const issues = checkDraftJson({});
    assert.ok(issues.length >= 4, `expected multiple issues, got ${issues.length}: ${issues}`);
  });
});
