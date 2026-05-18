// spec: R8
//
// Table-driven gate-draft validation tests plus production validator checks.
// The production section writes JSON artifacts to a temp spec dir and calls
// validateDraftReviewArtifactSet from src/flow/lib/run-gate.js directly.
//
// GAP coverage: GAP-6 (gate-draft validation cases TC-23..TC-28, TC-39),
// GAP-2 (TC-20: non-apply triage decisions resolve without repair items).

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { validateDraftReviewArtifactSet } from "../../../src/flow/lib/run-gate.js";
import { draftReviewRouteForKey } from "../../../src/flow/lib/draft-review-routes.js";
import { repairItem, reviewItem, triageItem } from "./helpers/artifacts.js";

// ---------------------------------------------------------------------------
// Artifact contract helper.
// ---------------------------------------------------------------------------

const VALID_CLASSIFICATIONS = new Set(["blocking", "advisory", "repair_target"]);
const VALID_DECISIONS = new Set([
  "apply",
  "invalid",
  "already_resolved",
  "downgraded_to_non_blocking",
  "requires_user_decision",
]);

const ALLOWED_DRAFT_FIELD_PATHS = new Set([
  "approval.approved",
  "approval.confirmedAt",
  "approval.notes",
  "qa",
  "decisionMap.knownFacts",
  "decisionMap.decisionPoints",
  "decisionMap.resolvedByProjectRules",
  "decisionMap.requiresUserJudgment",
  "decisionMap.deferredToSpec",
  "goal",
  "analysis.problem",
  "analysis.proposedApproach",
  "analysis.validation",
  "scopeVerification.in",
  "scopeVerification.out",
  "impactOnExisting",
  "openQuestions",
]);

/**
 * Returns { ok: false, code, message } on the first failure encountered,
 * or { ok: true } if all checks pass. Caller supplies the artifact set and
 * the draft.json snapshot.
 */
function gateDraft({ artifacts, draft }) {
  // 1. MISSING_ARTIFACT
  for (const key of ["questionsReview", "questionsTriage", "questionsRepair",
    "coverageReview", "coverageTriage", "coverageRepair"]) {
    if (!(key in artifacts)) {
      return { ok: false, code: "MISSING_ARTIFACT", message: `missing ${key}` };
    }
  }

  // 2. SCHEMA: required top-level fields
  const requiredReviewFields = [
    "version", "phase", "sourceDraft", "generatedAt",
    "verdict", "summary", "blockingFindings", "advisoryFindings", "repairTargets",
  ];
  for (const reviewKey of ["questionsReview", "coverageReview"]) {
    for (const f of requiredReviewFields) {
      if (!(f in artifacts[reviewKey])) {
        return {
          ok: false,
          code: "SCHEMA_MISSING_FIELD",
          message: `${reviewKey}.${f} is missing`,
        };
      }
    }
  }

  // 3. INVALID_CLASSIFICATION
  for (const reviewKey of ["questionsReview", "coverageReview"]) {
    const review = artifacts[reviewKey];
    for (const arr of ["blockingFindings", "advisoryFindings", "repairTargets"]) {
      const expected =
        arr === "blockingFindings" ? "blocking" :
        arr === "advisoryFindings" ? "advisory" : "repair_target";
      for (const item of review[arr] || []) {
        if (!VALID_CLASSIFICATIONS.has(item.classification)) {
          return {
            ok: false,
            code: "INVALID_CLASSIFICATION",
            message: `${reviewKey}.${arr}[].classification ${item.classification} is invalid`,
          };
        }
        if (item.classification !== expected) {
          return {
            ok: false,
            code: "INVALID_CLASSIFICATION",
            message: `${reviewKey}.${arr}[] classification ${item.classification} mismatches container ${arr}`,
          };
        }
      }
    }
  }

  // 4. LINK_MISMATCH: triage.sourceReview must reference the matching review
  for (const [triageKey, reviewKey] of [
    ["questionsTriage", "questionsReview"],
    ["coverageTriage", "coverageReview"],
  ]) {
    const triage = artifacts[triageKey];
    const review = artifacts[reviewKey];
    if (triage.sourceReview !== review._artifactPath) {
      return {
        ok: false,
        code: "LINK_MISMATCH",
        message: `${triageKey}.sourceReview ${triage.sourceReview} does not match ${reviewKey} at ${review._artifactPath}`,
      };
    }
  }
  // 4b. repair.sourceTriage must reference the matching triage
  for (const [repairKey, triageKey] of [
    ["questionsRepair", "questionsTriage"],
    ["coverageRepair", "coverageTriage"],
  ]) {
    const repair = artifacts[repairKey];
    const triage = artifacts[triageKey];
    if (repair.sourceTriage !== triage._artifactPath) {
      return {
        ok: false,
        code: "LINK_MISMATCH",
        message: `${repairKey}.sourceTriage ${repair.sourceTriage} does not match ${triageKey} at ${triage._artifactPath}`,
      };
    }
  }

  // 5. INVALID_DECISION
  for (const triageKey of ["questionsTriage", "coverageTriage"]) {
    for (const item of artifacts[triageKey].items) {
      if (!VALID_DECISIONS.has(item.decision)) {
        return {
          ok: false,
          code: "INVALID_DECISION",
          message: `${triageKey}.items[].decision ${item.decision} is not allowed`,
        };
      }
    }
  }

  // 6. ITEM_COUNT_MISMATCH:
  //    - triage items must correspond exactly to review blocking findings here
  //    - repair items must equal the count of triage apply items
  for (const [reviewKey, triageKey] of [
    ["questionsReview", "questionsTriage"],
    ["coverageReview", "coverageTriage"],
  ]) {
    const blocking = artifacts[reviewKey].blockingFindings.length;
    const blockingTitles = new Set(
      artifacts[reviewKey].blockingFindings.map((b) => b.title),
    );
    const triageTitles = new Set(artifacts[triageKey].items.map((i) => i.title));
    for (const t of blockingTitles) {
      if (!triageTitles.has(t)) {
        return {
          ok: false,
          code: "ITEM_COUNT_MISMATCH",
          message: `${triageKey} missing item for blocking finding ${t}`,
        };
      }
    }
    for (const t of triageTitles) {
      if (!blockingTitles.has(t)) {
        return {
          ok: false,
          code: "ITEM_COUNT_MISMATCH",
          message: `${triageKey} has item not present in source review: ${t}`,
        };
      }
    }
    if (blocking > 0 && artifacts[triageKey].items.length === 0) {
      return {
        ok: false,
        code: "ITEM_COUNT_MISMATCH",
        message: `${triageKey} has zero items for ${blocking} blocking findings`,
      };
    }
  }
  for (const [triageKey, repairKey] of [
    ["questionsTriage", "questionsRepair"],
    ["coverageTriage", "coverageRepair"],
  ]) {
    const applyTitles = new Set(
      artifacts[triageKey].items
        .filter((i) => i.decision === "apply")
        .map((i) => i.title),
    );
    const repairTitles = new Set(
      artifacts[repairKey].items.map((i) => i.title),
    );
    if (applyTitles.size !== repairTitles.size) {
      return {
        ok: false,
        code: "ITEM_COUNT_MISMATCH",
        message: `${repairKey} has ${repairTitles.size} items but ${triageKey} has ${applyTitles.size} apply items`,
      };
    }
    for (const t of applyTitles) {
      if (!repairTitles.has(t)) {
        return {
          ok: false,
          code: "ITEM_COUNT_MISMATCH",
          message: `${repairKey} missing item for apply triage ${t}`,
        };
      }
    }
  }

  // 7. UNRESOLVED_DECISION
  for (const triageKey of ["questionsTriage", "coverageTriage"]) {
    for (const item of artifacts[triageKey].items) {
      if (item.decision === "requires_user_decision") {
        return {
          ok: false,
          code: "UNRESOLVED_DECISION",
          message: `${triageKey} has requires_user_decision item: ${item.title}`,
        };
      }
    }
  }

  // 8. UNKNOWN_FIELD_PATH
  for (const repairKey of ["questionsRepair", "coverageRepair"]) {
    for (const item of artifacts[repairKey].items) {
      for (const p of item.changedFieldPaths || []) {
        if (!ALLOWED_DRAFT_FIELD_PATHS.has(p)) {
          return {
            ok: false,
            code: "UNKNOWN_FIELD_PATH",
            message: `${repairKey}.items[].changedFieldPaths references unknown ${p}`,
          };
        }
      }
    }
  }

  // 9. MISSING_APPROVAL: coverage repair must have produced approval=true
  //    unless requires_user_decision exists (already handled above).
  if (draft.approval?.approved !== true) {
    return {
      ok: false,
      code: "MISSING_APPROVAL",
      message: "draft.approval.approved is not true after coverage repair",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Fixture builders.
// ---------------------------------------------------------------------------

function buildArtifacts(overrides = {}) {
  const questionsReviewPath = "specs/<id>/draft-review-questions.json";
  const coverageReviewPath = "specs/<id>/draft-review-coverage.json";
  const questionsTriagePath = "specs/<id>/draft-questions-triage.json";
  const coverageTriagePath = "specs/<id>/draft-coverage-triage.json";

  const base = {
    questionsReview: {
      _artifactPath: questionsReviewPath,
      version: 1,
      phase: "review-draft-questions",
      sourceDraft: "specs/<id>/draft.json",
      generatedAt: "2026-05-16T00:00:00.000Z",
      verdict: "FAIL",
      summary: "one blocking",
      blockingFindings: [reviewItem("Q1", "blocking")],
      advisoryFindings: [],
      repairTargets: [],
    },
    questionsTriage: {
      _artifactPath: questionsTriagePath,
      version: 1,
      phase: "draft-questions-triage",
      sourceReview: questionsReviewPath,
      generatedAt: "2026-05-16T00:01:00.000Z",
      summary: "triaged",
      items: [triageItem("Q1", "apply")],
    },
    questionsRepair: {
      _artifactPath: "specs/<id>/draft-questions-repair.json",
      version: 1,
      phase: "draft-questions-repair",
      sourceTriage: questionsTriagePath,
      generatedAt: "2026-05-16T00:02:00.000Z",
      summary: "repaired",
      items: [repairItem("Q1", ["qa"])],
    },
    coverageReview: {
      _artifactPath: coverageReviewPath,
      version: 1,
      phase: "review-draft-coverage",
      sourceDraft: "specs/<id>/draft.json",
      generatedAt: "2026-05-16T00:03:00.000Z",
      verdict: "ADVISORY",
      summary: "advisory only",
      blockingFindings: [],
      advisoryFindings: [reviewItem("C1", "advisory")],
      repairTargets: [],
    },
    coverageTriage: {
      _artifactPath: coverageTriagePath,
      version: 1,
      phase: "draft-coverage-triage",
      sourceReview: coverageReviewPath,
      generatedAt: "2026-05-16T00:04:00.000Z",
      summary: "triaged",
      items: [],
    },
    coverageRepair: {
      _artifactPath: "specs/<id>/draft-coverage-repair.json",
      version: 1,
      phase: "draft-coverage-repair",
      sourceTriage: coverageTriagePath,
      generatedAt: "2026-05-16T00:05:00.000Z",
      summary: "repaired",
      items: [],
    },
    ...overrides,
  };
  return base;
}

function buildDraft(overrides = {}) {
  return {
    approval: { approved: true, confirmedAt: "2026-05-16T00:06:00.000Z" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Table-driven cases.
// ---------------------------------------------------------------------------

describe("R8 gate-draft validation (TC-23..TC-28, TC-39)", () => {
  it("R8: passes for a well-formed artifact set with approved draft", () => {
    const result = gateDraft({ artifacts: buildArtifacts(), draft: buildDraft() });
    assert.deepEqual(result, { ok: true });
  });

  it("TC-23 / TC-27: MISSING_ARTIFACT when draft-coverage-repair.json is absent", () => {
    const artifacts = buildArtifacts();
    delete artifacts.coverageRepair;
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "MISSING_ARTIFACT");
    assert.match(result.message, /coverageRepair/);
  });

  it("TC-23: SCHEMA_MISSING_FIELD when review verdict is missing", () => {
    const artifacts = buildArtifacts();
    delete artifacts.questionsReview.verdict;
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "SCHEMA_MISSING_FIELD");
    assert.match(result.message, /verdict/);
  });

  it("TC-7 / TC-26: INVALID_CLASSIFICATION when review has classification 'warning'", () => {
    const artifacts = buildArtifacts({
      questionsReview: {
        ...buildArtifacts().questionsReview,
        blockingFindings: [reviewItem("Q1", "warning")],
      },
    });
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "INVALID_CLASSIFICATION");
  });

  it("TC-24: LINK_MISMATCH when triage.sourceReview points to wrong review", () => {
    const artifacts = buildArtifacts();
    artifacts.questionsTriage.sourceReview = "specs/<id>/nonexistent.json";
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "LINK_MISMATCH");
  });

  it("TC-24: LINK_MISMATCH when repair.sourceTriage points to wrong triage", () => {
    const artifacts = buildArtifacts();
    artifacts.questionsRepair.sourceTriage = "specs/<id>/nonexistent.json";
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "LINK_MISMATCH");
  });

  it("TC-25: ITEM_COUNT_MISMATCH when triage is missing item for a blocking finding", () => {
    const artifacts = buildArtifacts();
    artifacts.questionsReview.blockingFindings.push(reviewItem("Q2", "blocking"));
    // triage only covers Q1
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "ITEM_COUNT_MISMATCH");
  });

  it("TC-25: ITEM_COUNT_MISMATCH when triage contains an item not in source review", () => {
    const artifacts = buildArtifacts();
    artifacts.questionsTriage.items.push(triageItem("Q-extra", "invalid"));
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "ITEM_COUNT_MISMATCH");
  });

  it("TC-25: ITEM_COUNT_MISMATCH when repair count differs from triage apply count", () => {
    const artifacts = buildArtifacts();
    artifacts.questionsTriage.items.push(triageItem("Q2", "apply"));
    // repair still only has Q1
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "ITEM_COUNT_MISMATCH");
  });

  it("TC-26: INVALID_DECISION when triage uses 'defer'", () => {
    const artifacts = buildArtifacts();
    artifacts.questionsTriage.items = [triageItem("Q1", "defer")];
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "INVALID_DECISION");
  });

  it("TC-22: UNRESOLVED_DECISION when triage has requires_user_decision", () => {
    const artifacts = buildArtifacts();
    artifacts.questionsTriage.items = [triageItem("Q1", "requires_user_decision")];
    // For this case the matching repair item count check is also satisfied:
    // requires_user_decision is not an apply item, so repair stays empty.
    artifacts.questionsRepair.items = [];
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "UNRESOLVED_DECISION");
  });

  it("TC-43: UNKNOWN_FIELD_PATH when repair references approval.unknownField", () => {
    const artifacts = buildArtifacts();
    artifacts.questionsRepair.items = [repairItem("Q1", ["approval.unknownField"])];
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.equal(result.ok, false);
    assert.equal(result.code, "UNKNOWN_FIELD_PATH");
  });

  it("TC-28: MISSING_APPROVAL when draft.approval.approved !== true after coverage repair", () => {
    const result = gateDraft({
      artifacts: buildArtifacts(),
      draft: buildDraft({ approval: { approved: false } }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "MISSING_APPROVAL");
  });

  it("TC-39: each failure case yields a distinct, identifiable error code", () => {
    const seen = new Set();
    const cases = [
      // missing artifact
      () => {
        const a = buildArtifacts();
        delete a.coverageRepair;
        return gateDraft({ artifacts: a, draft: buildDraft() });
      },
      // bad classification
      () => {
        const a = buildArtifacts();
        a.questionsReview.blockingFindings = [reviewItem("Q1", "warning")];
        return gateDraft({ artifacts: a, draft: buildDraft() });
      },
      // mismatched sourceReview
      () => {
        const a = buildArtifacts();
        a.questionsTriage.sourceReview = "wrong.json";
        return gateDraft({ artifacts: a, draft: buildDraft() });
      },
      // item count mismatch
      () => {
        const a = buildArtifacts();
        a.questionsReview.blockingFindings.push(reviewItem("Q2", "blocking"));
        return gateDraft({ artifacts: a, draft: buildDraft() });
      },
      // disallowed decision
      () => {
        const a = buildArtifacts();
        a.questionsTriage.items = [triageItem("Q1", "defer")];
        return gateDraft({ artifacts: a, draft: buildDraft() });
      },
      // unresolved requires_user_decision
      () => {
        const a = buildArtifacts();
        a.questionsTriage.items = [triageItem("Q1", "requires_user_decision")];
        a.questionsRepair.items = [];
        return gateDraft({ artifacts: a, draft: buildDraft() });
      },
      // missing approval
      () =>
        gateDraft({
          artifacts: buildArtifacts(),
          draft: buildDraft({ approval: { approved: false } }),
        }),
    ];
    for (const fn of cases) {
      const result = fn();
      assert.equal(result.ok, false);
      assert.ok(result.code, "every failure case must include a code");
      seen.add(result.code);
    }
    assert.equal(
      seen.size,
      cases.length,
      `expected ${cases.length} distinct error codes, got ${seen.size}: ${[...seen].join(",")}`,
    );
  });
});

// ---------------------------------------------------------------------------
// GAP-2 / TC-20: triage decisions invalid / already_resolved /
// downgraded_to_non_blocking resolve cleanly without repair items.
//
// Locks in the contract that only `apply` triage items consume repair slots.
// gate-draft must NOT raise ITEM_COUNT_MISMATCH or any other missing-repair
// error when every triage decision is non-apply, non-user-decision, and the
// repair items array is empty.
// ---------------------------------------------------------------------------

describe("R7/R8 non-apply triage decisions resolve without repair (GAP-2, TC-20)", () => {
  function buildTriageOnlyArtifacts(decisions) {
    const artifacts = buildArtifacts();
    // Three blocking findings on questions, each mapped to a different
    // non-apply, non-user-decision triage decision.
    artifacts.questionsReview.blockingFindings = [
      reviewItem("Q1", "blocking"),
      reviewItem("Q2", "blocking"),
      reviewItem("Q3", "blocking"),
    ];
    artifacts.questionsTriage.items = [
      triageItem("Q1", decisions[0]),
      triageItem("Q2", decisions[1]),
      triageItem("Q3", decisions[2]),
    ];
    // No `apply` items → repair items array MUST be empty.
    artifacts.questionsRepair.items = [];
    return artifacts;
  }

  it("TC-20: invalid / already_resolved / downgraded_to_non_blocking all resolve with empty repair", () => {
    const artifacts = buildTriageOnlyArtifacts([
      "invalid",
      "already_resolved",
      "downgraded_to_non_blocking",
    ]);
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.deepEqual(
      result,
      { ok: true },
      `gate-draft must pass for non-apply triage decisions with empty repair items; got: ${JSON.stringify(result)}`,
    );
  });

  for (const decision of [
    "invalid",
    "already_resolved",
    "downgraded_to_non_blocking",
  ]) {
    it(`TC-20: triage with all '${decision}' items passes with empty repair`, () => {
      const artifacts = buildArtifacts();
      artifacts.questionsReview.blockingFindings = [
        reviewItem("Q1", "blocking"),
        reviewItem("Q2", "blocking"),
      ];
      artifacts.questionsTriage.items = [
        triageItem("Q1", decision),
        triageItem("Q2", decision),
      ];
      artifacts.questionsRepair.items = [];
      const result = gateDraft({ artifacts, draft: buildDraft() });
      assert.deepEqual(
        result,
        { ok: true },
        `'${decision}' must not require a repair entry; got: ${JSON.stringify(result)}`,
      );
    });
  }

  it("TC-20: mixed apply + non-apply produces exactly one repair item (no missing-repair error for non-apply items)", () => {
    const artifacts = buildArtifacts();
    artifacts.questionsReview.blockingFindings = [
      reviewItem("Q1", "blocking"),
      reviewItem("Q2", "blocking"),
      reviewItem("Q3", "blocking"),
      reviewItem("Q4", "blocking"),
    ];
    artifacts.questionsTriage.items = [
      triageItem("Q1", "apply"),
      triageItem("Q2", "invalid"),
      triageItem("Q3", "already_resolved"),
      triageItem("Q4", "downgraded_to_non_blocking"),
    ];
    // Only the `apply` item gets a repair entry.
    artifacts.questionsRepair.items = [repairItem("Q1", ["qa"])];
    const result = gateDraft({ artifacts, draft: buildDraft() });
    assert.deepEqual(
      result,
      { ok: true },
      `non-apply triage decisions must not consume repair slots; got: ${JSON.stringify(result)}`,
    );
  });
});

describe("R8 production gate-draft artifact correspondence", () => {
  function writeJson(dir, filename, value) {
    fs.writeFileSync(path.join(dir, filename), JSON.stringify(value, null, 2));
  }

  function writeProductionArtifactSet(tmp, route, overrides = {}) {
    writeJson(tmp, route.reviewArtifact, {
      version: 1,
      phase: route.reviewStepId,
      sourceDraft: "draft.json",
      generatedAt: "2026-05-16T00:00:00.000Z",
      verdict: "FAIL",
      summary: "one blocking",
      blockingFindings: [reviewItem("Q1", "blocking")],
      advisoryFindings: [],
      repairTargets: [],
      ...overrides.review,
    });
    writeJson(tmp, route.triageArtifact, {
      version: 1,
      phase: route.triageStepId,
      sourceReview: route.reviewArtifact,
      summary: "triaged",
      items: [triageItem("Q1", "invalid")],
      ...overrides.triage,
    });
    writeJson(tmp, route.repairArtifact, {
      version: 1,
      phase: route.repairStepId,
      sourceTriage: route.triageArtifact,
      summary: "no apply repairs",
      items: [],
      ...overrides.repair,
    });
  }

  it("rejects triage items that do not correspond to blocking findings or repair targets", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "draft-gate-prod-"));
    try {
      const route = draftReviewRouteForKey("questions");
      writeProductionArtifactSet(tmp, route, {
        triage: {
          summary: "contains extra item",
          items: [
            triageItem("Q1", "invalid"),
            triageItem("Q-extra", "invalid"),
          ],
        },
      });

      const result = validateDraftReviewArtifactSet(tmp, route);
      assert.ok(
        result.issues.some((issue) => /must match a blocking finding or repair target/.test(issue)),
        `expected production validator to reject the extra triage item; got ${JSON.stringify(result.issues)}`,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects collapsed duplicate source findings with too few triage items", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "draft-gate-prod-"));
    try {
      const route = draftReviewRouteForKey("questions");
      writeProductionArtifactSet(tmp, route, {
        review: {
          blockingFindings: [
            reviewItem("Q1", "blocking"),
            reviewItem("Q1", "blocking"),
          ],
        },
        triage: {
          items: [triageItem("Q1", "invalid")],
        },
      });

      const result = validateDraftReviewArtifactSet(tmp, route);
      assert.ok(
        result.issues.some((issue) => /missing item for Q1/.test(issue)),
        `expected production validator to reject collapsed duplicate source findings; got ${JSON.stringify(result.issues)}`,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects non-string changedFieldPaths entries", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "draft-gate-prod-"));
    try {
      const route = draftReviewRouteForKey("questions");
      writeProductionArtifactSet(tmp, route, {
        triage: {
          items: [triageItem("Q1", "apply")],
        },
        repair: {
          items: [
            {
              ...repairItem("Q1", ["qa"]),
              changedFieldPaths: ["qa", 12],
            },
          ],
        },
      });

      const result = validateDraftReviewArtifactSet(tmp, route);
      assert.ok(
        result.issues.some((issue) => /changedFieldPaths\[1\]/.test(issue)),
        `expected production validator to reject non-string changedFieldPaths entries; got ${JSON.stringify(result.issues)}`,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("rejects duplicate repair items that replace a missing apply triage item", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "draft-gate-prod-"));
    try {
      const route = draftReviewRouteForKey("questions");
      writeProductionArtifactSet(tmp, route, {
        review: {
          blockingFindings: [
            reviewItem("Q1", "blocking"),
            reviewItem("Q2", "blocking"),
          ],
        },
        triage: {
          items: [
            triageItem("Q1", "apply"),
            triageItem("Q2", "apply"),
          ],
        },
        repair: {
          items: [
            repairItem("Q1", ["qa"]),
            repairItem("Q1", ["qa"]),
          ],
        },
      });

      const result = validateDraftReviewArtifactSet(tmp, route);
      assert.ok(
        result.issues.some((issue) => /missing item for apply triage Q2/.test(issue)),
        `expected production validator to reject duplicate repair replacing Q2; got ${JSON.stringify(result.issues)}`,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
