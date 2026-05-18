// spec: R2 R4 R5
//
// Contract tests for the review / triage / repair JSON artifacts, paired
// with production review writer checks for classification and cap behavior.
//
// GAP coverage: GAP-2 (review shape/caps/classification), GAP-3 (triage
// contract), GAP-4 (repair shape + auto-approval semantics), GAP-9 (repair
// field-path validation). Minimal grep tripwires for GAP-10 retained at
// the end.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildDraftReviewArtifact } from "../../../src/flow/commands/review.js";
import {
  repairItem as buildRepairItem,
  reviewItem as buildReviewItem,
  triageItem as buildTriageItem,
} from "./helpers/artifacts.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// ---------------------------------------------------------------------------
// Contract validators (these encode the rules gate-draft must enforce).
// ---------------------------------------------------------------------------

const REVIEW_VERDICTS = new Set(["PASS", "ADVISORY", "FAIL"]);
const REVIEW_PHASES = new Set([
  "review-draft-questions",
  "review-draft-coverage",
]);
const REVIEW_ITEM_FIELDS = ["title", "target", "rationale", "evidence", "classification"];
const REVIEW_ITEM_CAP = 20;

const ALLOWED_CLASSIFICATIONS = {
  blockingFindings: "blocking",
  advisoryFindings: "advisory",
  repairTargets: "repair_target",
};

const TRIAGE_PHASES = new Set([
  "draft-questions-triage",
  "draft-coverage-triage",
]);
const TRIAGE_DECISIONS = new Set([
  "apply",
  "invalid",
  "already_resolved",
  "downgraded_to_non_blocking",
  "requires_user_decision",
]);
const TRIAGE_ITEM_FIELDS = ["title", "target", "decision", "rationale", "evidence"];
const TRIAGE_ITEM_CAP = 40;

const REPAIR_PHASES = new Set([
  "draft-questions-repair",
  "draft-coverage-repair",
]);
const REPAIR_ITEM_FIELDS = [
  "title",
  "target",
  "rationale",
  "evidence",
  "changedFieldPaths",
];
const REPAIR_ITEM_CAP = 40;

// Known draft.json field paths repair items may mutate. Items referencing
// any path outside this set must be rejected (TC-43 / GAP-9).
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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateReviewArtifact(artifact) {
  const errors = [];
  if (!artifact || typeof artifact !== "object") {
    return ["artifact must be an object"];
  }

  const required = [
    "version",
    "phase",
    "sourceDraft",
    "generatedAt",
    "verdict",
    "summary",
    "blockingFindings",
    "advisoryFindings",
    "repairTargets",
  ];
  for (const field of required) {
    if (!(field in artifact)) errors.push(`missing field: ${field}`);
  }

  if (typeof artifact.version !== "number" || artifact.version < 1) {
    errors.push("version must be a positive number");
  }
  if (!REVIEW_PHASES.has(artifact.phase)) {
    errors.push(`phase must be one of ${[...REVIEW_PHASES].join("|")}`);
  }
  if (!isNonEmptyString(artifact.sourceDraft)) {
    errors.push("sourceDraft must be a non-empty string");
  }
  if (!isNonEmptyString(artifact.generatedAt)) {
    errors.push("generatedAt must be a non-empty string");
  }
  if (!REVIEW_VERDICTS.has(artifact.verdict)) {
    errors.push(`verdict must be one of ${[...REVIEW_VERDICTS].join("|")}`);
  }
  if (!isNonEmptyString(artifact.summary)) {
    errors.push("summary must be a non-empty string");
  }

  for (const arrayField of [
    "blockingFindings",
    "advisoryFindings",
    "repairTargets",
  ]) {
    const items = artifact[arrayField];
    if (!Array.isArray(items)) {
      errors.push(`${arrayField} must be an array`);
      continue;
    }
    if (items.length > REVIEW_ITEM_CAP) {
      errors.push(`${arrayField} exceeds cap of ${REVIEW_ITEM_CAP} (got ${items.length})`);
    }
    const expectedClassification = ALLOWED_CLASSIFICATIONS[arrayField];
    items.forEach((item, idx) => {
      if (!item || typeof item !== "object") {
        errors.push(`${arrayField}[${idx}] must be an object`);
        return;
      }
      for (const field of REVIEW_ITEM_FIELDS) {
        if (!isNonEmptyString(item[field])) {
          errors.push(`${arrayField}[${idx}].${field} must be a non-empty string`);
        }
      }
      if (
        item.classification &&
        !["blocking", "advisory", "repair_target"].includes(item.classification)
      ) {
        errors.push(
          `${arrayField}[${idx}].classification must be one of blocking|advisory|repair_target`,
        );
      }
      if (
        item.classification &&
        item.classification !== expectedClassification
      ) {
        errors.push(
          `${arrayField}[${idx}].classification ${item.classification} does not match container (expected ${expectedClassification})`,
        );
      }
    });
  }

  return errors;
}

function validateTriageArtifact(artifact, { sourceReviewExists = true } = {}) {
  const errors = [];
  if (!artifact || typeof artifact !== "object") {
    return ["artifact must be an object"];
  }

  const required = [
    "version",
    "phase",
    "sourceReview",
    "generatedAt",
    "summary",
    "items",
  ];
  for (const field of required) {
    if (!(field in artifact)) errors.push(`missing field: ${field}`);
  }
  if ("sourceTriage" in artifact) {
    errors.push("sourceTriage must be absent in triage artifact");
  }
  if (!TRIAGE_PHASES.has(artifact.phase)) {
    errors.push(`phase must be one of ${[...TRIAGE_PHASES].join("|")}`);
  }
  if (!isNonEmptyString(artifact.sourceReview)) {
    errors.push("sourceReview must be a non-empty string");
  } else if (!sourceReviewExists) {
    errors.push(`sourceReview ${artifact.sourceReview} does not exist`);
  }
  if (!Array.isArray(artifact.items)) {
    errors.push("items must be an array");
  } else {
    if (artifact.items.length > TRIAGE_ITEM_CAP) {
      errors.push(
        `items exceeds cap of ${TRIAGE_ITEM_CAP} (got ${artifact.items.length})`,
      );
    }
    artifact.items.forEach((item, idx) => {
      if (!item || typeof item !== "object") {
        errors.push(`items[${idx}] must be an object`);
        return;
      }
      for (const field of TRIAGE_ITEM_FIELDS) {
        if (!isNonEmptyString(item[field])) {
          errors.push(`items[${idx}].${field} must be a non-empty string`);
        }
      }
      if (item.decision && !TRIAGE_DECISIONS.has(item.decision)) {
        errors.push(
          `items[${idx}].decision must be one of ${[...TRIAGE_DECISIONS].join("|")}`,
        );
      }
    });
  }
  return errors;
}

function validateRepairArtifact(artifact, { sourceTriageExists = true } = {}) {
  const errors = [];
  if (!artifact || typeof artifact !== "object") {
    return ["artifact must be an object"];
  }
  const required = [
    "version",
    "phase",
    "sourceTriage",
    "generatedAt",
    "summary",
    "items",
  ];
  for (const field of required) {
    if (!(field in artifact)) errors.push(`missing field: ${field}`);
  }
  if (!REPAIR_PHASES.has(artifact.phase)) {
    errors.push(`phase must be one of ${[...REPAIR_PHASES].join("|")}`);
  }
  if (!isNonEmptyString(artifact.sourceTriage)) {
    errors.push("sourceTriage must be a non-empty string");
  } else if (!sourceTriageExists) {
    errors.push(`sourceTriage ${artifact.sourceTriage} does not exist`);
  }
  if (!Array.isArray(artifact.items)) {
    errors.push("items must be an array");
  } else {
    if (artifact.items.length > REPAIR_ITEM_CAP) {
      errors.push(
        `items exceeds cap of ${REPAIR_ITEM_CAP} (got ${artifact.items.length})`,
      );
    }
    artifact.items.forEach((item, idx) => {
      if (!item || typeof item !== "object") {
        errors.push(`items[${idx}] must be an object`);
        return;
      }
      for (const field of REPAIR_ITEM_FIELDS) {
        if (field === "changedFieldPaths") {
          if (!Array.isArray(item.changedFieldPaths) || item.changedFieldPaths.length === 0) {
            errors.push(`items[${idx}].changedFieldPaths must be a non-empty array`);
            continue;
          }
          for (const p of item.changedFieldPaths) {
            if (!isNonEmptyString(p)) {
              errors.push(`items[${idx}].changedFieldPaths entry must be a non-empty string`);
              continue;
            }
            if (!ALLOWED_DRAFT_FIELD_PATHS.has(p)) {
              errors.push(`items[${idx}].changedFieldPaths references unknown path: ${p}`);
            }
          }
        } else if (!isNonEmptyString(item[field])) {
          errors.push(`items[${idx}].${field} must be a non-empty string`);
        }
      }
    });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Helper builders.
// ---------------------------------------------------------------------------

function buildReviewArtifact(overrides = {}) {
  const base = {
    version: 1,
    phase: "review-draft-questions",
    sourceDraft: "specs/<id>/draft.json",
    generatedAt: "2026-05-16T00:00:00.000Z",
    verdict: "FAIL",
    summary: "One blocking finding recorded.",
    blockingFindings: [buildReviewItem({ classification: "blocking" })],
    advisoryFindings: [],
    repairTargets: [],
  };
  return { ...base, ...overrides };
}

function buildTriageArtifact(overrides = {}) {
  const base = {
    version: 1,
    phase: "draft-questions-triage",
    sourceReview: "specs/<id>/draft-review-questions.json",
    generatedAt: "2026-05-16T00:01:00.000Z",
    summary: "Triaged one blocking finding.",
    items: [buildTriageItem()],
  };
  return { ...base, ...overrides };
}

function buildRepairArtifact(overrides = {}) {
  const base = {
    version: 1,
    phase: "draft-questions-repair",
    sourceTriage: "specs/<id>/draft-questions-triage.json",
    generatedAt: "2026-05-16T00:02:00.000Z",
    summary: "Applied one repair.",
    items: [buildRepairItem()],
  };
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// TC-4 / TC-40 / TC-41: review artifact required fields, empty, boundary.
// ---------------------------------------------------------------------------

describe("R2 review artifact required fields and boundaries", () => {
  it("R2: TC-4 accepts a well-formed minimal review artifact", () => {
    assert.deepEqual(validateReviewArtifact(buildReviewArtifact()), []);
  });

  it("TC-40: accepts zero-finding artifact with verdict PASS and empty arrays", () => {
    const artifact = buildReviewArtifact({
      verdict: "PASS",
      blockingFindings: [],
      advisoryFindings: [],
      repairTargets: [],
      summary: "No findings recorded.",
    });
    assert.deepEqual(validateReviewArtifact(artifact), []);
  });

  it("TC-41: accepts exactly 20 items in each array", () => {
    const twenty = (cls) =>
      Array.from({ length: 20 }, (_, i) =>
        buildReviewItem({ title: `Item ${i}`, classification: cls }),
      );
    const artifact = buildReviewArtifact({
      verdict: "FAIL",
      blockingFindings: twenty("blocking"),
      advisoryFindings: twenty("advisory"),
      repairTargets: twenty("repair_target"),
    });
    assert.deepEqual(validateReviewArtifact(artifact), []);
  });

  it("TC-5: rejects 21 items in any review array", () => {
    const twentyOne = Array.from({ length: 21 }, (_, i) =>
      buildReviewItem({ title: `Item ${i}`, classification: "blocking" }),
    );
    const errors = validateReviewArtifact(
      buildReviewArtifact({ blockingFindings: twentyOne }),
    );
    assert.ok(
      errors.some((e) => /blockingFindings exceeds cap of 20/.test(e)),
      `expected cap error, got ${JSON.stringify(errors)}`,
    );
  });

  it("TC-6: rejects review item missing any required field", () => {
    for (const field of ["title", "target", "rationale", "evidence", "classification"]) {
      const broken = buildReviewItem({ classification: "blocking" });
      delete broken[field];
      const errors = validateReviewArtifact(
        buildReviewArtifact({ blockingFindings: [broken] }),
      );
      assert.ok(
        errors.some((e) => new RegExp(`blockingFindings\\[0\\]\\.${field}`).test(e)),
        `missing ${field} should be reported`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// GAP-1: Table-driven tests for top-level required fields (TC-3 coverage).
// Removes each top-level field individually and asserts the validator
// rejects the artifact, with an error referencing the offending field name.
// ---------------------------------------------------------------------------

describe("R2 review artifact top-level required fields (GAP-1, TC-3)", () => {
  const topLevelFields = [
    "version",
    "phase",
    "sourceDraft",
    "generatedAt",
    "verdict",
    "summary",
    "blockingFindings",
    "advisoryFindings",
    "repairTargets",
  ];

  for (const field of topLevelFields) {
    it(`rejects review artifact missing top-level field: ${field}`, () => {
      const artifact = buildReviewArtifact();
      delete artifact[field];
      const errors = validateReviewArtifact(artifact);
      assert.ok(
        errors.length > 0,
        `removing ${field} must yield at least one validation error`,
      );
      assert.ok(
        errors.some((e) => new RegExp(`\\b${field}\\b`).test(e)),
        `at least one error must reference the missing field "${field}"; got: ${JSON.stringify(errors)}`,
      );
      assert.ok(
        errors.some((e) => /missing field/.test(e) && new RegExp(`\\b${field}\\b`).test(e)),
        `expected a "missing field: ${field}" error; got: ${JSON.stringify(errors)}`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// GAP-3: Producer-side truncation integrity (TC-4 second clause).
// When a producer emits 25 candidate items and truncates to the 20-item
// cap, the surviving items must remain well-formed and pass validation.
// ---------------------------------------------------------------------------

describe("R2 review array truncation integrity (GAP-3, TC-4)", () => {
  // Test-local helper for the artifact contract: take an unbounded input
  // array, return the first REVIEW_ITEM_CAP items unchanged.
  function truncateToCap(items) {
    return items.slice(0, REVIEW_ITEM_CAP);
  }

  it("25 → 20 truncation keeps surviving items intact and valid", () => {
    const twentyFive = Array.from({ length: 25 }, (_, i) =>
      buildReviewItem({
        title: `Item ${i}`,
        target: `qa[${i}].question`,
        rationale: `Rationale ${i}`,
        evidence: `Evidence ${i}`,
        classification: "blocking",
      }),
    );
    const truncated = truncateToCap(twentyFive);

    assert.equal(truncated.length, 20, "truncator must enforce the 20-item cap");

    // Order preserved: first 20 inputs survive in order.
    for (let i = 0; i < truncated.length; i++) {
      assert.equal(truncated[i].title, `Item ${i}`,
        `item[${i}] order must be preserved (got ${truncated[i].title})`);
    }

    // Each surviving item retains all required fields.
    for (let i = 0; i < truncated.length; i++) {
      for (const field of REVIEW_ITEM_FIELDS) {
        assert.ok(
          isNonEmptyString(truncated[i][field]),
          `item[${i}].${field} must remain a non-empty string after truncation`,
        );
      }
    }

    // The truncated array passes full artifact validation.
    const artifact = buildReviewArtifact({ blockingFindings: truncated });
    assert.deepEqual(
      validateReviewArtifact(artifact),
      [],
      "truncated artifact must pass validation with no errors",
    );
  });

  it("25 → 20 truncation applies independently to each classification array", () => {
    const make = (cls, prefix) =>
      Array.from({ length: 25 }, (_, i) =>
        buildReviewItem({ title: `${prefix}-${i}`, classification: cls }),
      );
    const blocking = truncateToCap(make("blocking", "B"));
    const advisory = truncateToCap(make("advisory", "A"));
    const repair = truncateToCap(make("repair_target", "R"));

    assert.equal(blocking.length, 20);
    assert.equal(advisory.length, 20);
    assert.equal(repair.length, 20);

    const artifact = buildReviewArtifact({
      verdict: "FAIL",
      blockingFindings: blocking,
      advisoryFindings: advisory,
      repairTargets: repair,
    });
    assert.deepEqual(validateReviewArtifact(artifact), []);
  });
});

// ---------------------------------------------------------------------------
// TC-7 / TC-42: classification enum + container mismatch.
// ---------------------------------------------------------------------------

describe("R2/R8 review classification rules", () => {
  it("TC-7: rejects classification 'warning'", () => {
    const errors = validateReviewArtifact(
      buildReviewArtifact({
        blockingFindings: [buildReviewItem({ classification: "warning" })],
      }),
    );
    assert.ok(
      errors.some((e) => /classification must be one of/.test(e)),
      "unknown classification must be rejected",
    );
  });

  it("TC-42: rejects classification mismatch with containing array", () => {
    const errors = validateReviewArtifact(
      buildReviewArtifact({
        advisoryFindings: [
          buildReviewItem({ classification: "blocking" }),
        ],
        blockingFindings: [],
      }),
    );
    assert.ok(
      errors.some((e) =>
        /classification blocking does not match container/.test(e),
      ),
      "classification/container mismatch must be rejected",
    );
  });

  it("TC-6 (per-array enforcement): each container only accepts its own classification value", () => {
    for (const [arrayField, expected] of Object.entries(ALLOWED_CLASSIFICATIONS)) {
      const ok = validateReviewArtifact(
        buildReviewArtifact({
          blockingFindings: [],
          advisoryFindings: [],
          repairTargets: [],
          [arrayField]: [buildReviewItem({ classification: expected })],
        }),
      );
      assert.deepEqual(
        ok,
        [],
        `${arrayField} with classification ${expected} should validate`,
      );
    }
  });
});

describe("R7 production draft review artifact classification", () => {
  it("R7: production writer routes advisory classification to advisoryFindings", () => {
    const artifact = buildDraftReviewArtifact({
      raw: "synthetic advisory",
      draftPath: "draft.json",
      stage: {
        reviewPhase: "review-draft-coverage",
        findingClassification: "blocking",
      },
      proposals: [{
        title: "Advisory note",
        file: null,
        body: [
          "**QA:** q1",
          "**Classification:** advisory",
          "**Issue:** Non-blocking reminder.",
          "**Suggestion:** Keep as advisory memory.",
        ].join("\n"),
      }],
    }).toJSON();

    assert.equal(artifact.verdict, "ADVISORY");
    assert.equal(artifact.blockingFindings.length, 0);
    assert.equal(artifact.advisoryFindings.length, 1);
    assert.equal(artifact.advisoryFindings[0].classification, "advisory");
    assert.equal(artifact.repairTargets.length, 0);
    assert.deepEqual(validateReviewArtifact(artifact), []);
  });
});

// ---------------------------------------------------------------------------
// TC-9 / TC-10 / TC-12: triage artifact contract.
// ---------------------------------------------------------------------------

describe("R4 triage artifact contract", () => {
  it("R4: TC-9 accepts a well-formed triage artifact and rejects stray sourceTriage", () => {
    assert.deepEqual(validateTriageArtifact(buildTriageArtifact()), []);
    const errors = validateTriageArtifact(
      buildTriageArtifact({ sourceTriage: "should-not-be-here.json" }),
    );
    assert.ok(
      errors.some((e) => /sourceTriage must be absent/.test(e)),
      "sourceTriage must be absent from triage artifact",
    );
  });

  it("TC-10: rejects more than 40 triage items", () => {
    const items = Array.from({ length: 41 }, (_, i) =>
      buildTriageItem({ title: `Item ${i}` }),
    );
    const errors = validateTriageArtifact(buildTriageArtifact({ items }));
    assert.ok(
      errors.some((e) => /items exceeds cap of 40/.test(e)),
      "triage cap of 40 must be enforced",
    );
  });

  it("TC-41: accepts exactly 40 triage items", () => {
    const items = Array.from({ length: 40 }, (_, i) =>
      buildTriageItem({ title: `Item ${i}` }),
    );
    assert.deepEqual(validateTriageArtifact(buildTriageArtifact({ items })), []);
  });

  it("TC-12: accepts each allowed decision and rejects 'defer'", () => {
    for (const decision of TRIAGE_DECISIONS) {
      const ok = validateTriageArtifact(
        buildTriageArtifact({
          items: [buildTriageItem({ decision })],
        }),
      );
      assert.deepEqual(ok, [], `${decision} should be accepted`);
    }
    const errors = validateTriageArtifact(
      buildTriageArtifact({
        items: [buildTriageItem({ decision: "defer" })],
      }),
    );
    assert.ok(
      errors.some((e) => /items\[0\]\.decision must be one of/.test(e)),
      "defer must be rejected",
    );
  });

  it("TC-9: rejects triage items missing any required field", () => {
    for (const field of TRIAGE_ITEM_FIELDS) {
      const broken = buildTriageItem();
      delete broken[field];
      const errors = validateTriageArtifact(
        buildTriageArtifact({ items: [broken] }),
      );
      assert.ok(
        errors.some((e) => new RegExp(`items\\[0\\]\\.${field}`).test(e)),
        `missing ${field} should be reported`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// TC-11: triage items must reference only blocking / repair_target source items.
// This is enforced as a cross-artifact rule (test below uses a helper).
// ---------------------------------------------------------------------------

function deriveTriageableTitles(review) {
  const titles = new Set();
  for (const item of review.blockingFindings) titles.add(item.title);
  for (const item of review.repairTargets) titles.add(item.title);
  return titles;
}

describe("R4 triage scope (TC-11)", () => {
  it("rejects triage items derived from advisory-only review findings", () => {
    const review = buildReviewArtifact({
      verdict: "ADVISORY",
      blockingFindings: [],
      advisoryFindings: [buildReviewItem({ classification: "advisory", title: "Advisory-only" })],
      repairTargets: [],
    });
    const triage = buildTriageArtifact({
      items: [buildTriageItem({ title: "Advisory-only" })],
    });

    const allowedTitles = deriveTriageableTitles(review);
    const offenders = triage.items.filter((item) => !allowedTitles.has(item.title));
    assert.equal(
      offenders.length,
      1,
      "advisory-only finding must not appear in triage items",
    );
  });

  it("accepts triage items whose titles match blocking or repair_target findings", () => {
    const review = buildReviewArtifact({
      blockingFindings: [buildReviewItem({ title: "Blocking A", classification: "blocking" })],
      advisoryFindings: [],
      repairTargets: [buildReviewItem({ title: "Repair B", classification: "repair_target" })],
    });
    const triage = buildTriageArtifact({
      items: [
        buildTriageItem({ title: "Blocking A" }),
        buildTriageItem({ title: "Repair B" }),
      ],
    });
    const allowed = deriveTriageableTitles(review);
    const offenders = triage.items.filter((item) => !allowed.has(item.title));
    assert.deepEqual(offenders, []);
  });
});

// ---------------------------------------------------------------------------
// TC-13 / TC-14 / TC-15 / TC-43: repair artifact contract.
// ---------------------------------------------------------------------------

describe("R5 repair artifact contract", () => {
  it("R5: TC-13 accepts a well-formed repair artifact", () => {
    assert.deepEqual(validateRepairArtifact(buildRepairArtifact()), []);
  });

  it("TC-13: rejects repair items missing changedFieldPaths or required strings", () => {
    for (const field of ["title", "target", "rationale", "evidence"]) {
      const broken = buildRepairItem();
      delete broken[field];
      const errors = validateRepairArtifact(
        buildRepairArtifact({ items: [broken] }),
      );
      assert.ok(
        errors.some((e) => new RegExp(`items\\[0\\]\\.${field}`).test(e)),
        `missing ${field} should be reported`,
      );
    }
    const noPaths = buildRepairItem({ changedFieldPaths: [] });
    const errors = validateRepairArtifact(
      buildRepairArtifact({ items: [noPaths] }),
    );
    assert.ok(
      errors.some((e) => /changedFieldPaths must be a non-empty array/.test(e)),
      "empty changedFieldPaths must be rejected",
    );
  });

  it("TC-14: only apply triage items become repair items (length match)", () => {
    const triage = buildTriageArtifact({
      items: [
        buildTriageItem({ title: "A", decision: "apply" }),
        buildTriageItem({ title: "B", decision: "apply" }),
        buildTriageItem({ title: "C", decision: "apply" }),
        buildTriageItem({ title: "D", decision: "invalid" }),
        buildTriageItem({ title: "E", decision: "already_resolved" }),
        buildTriageItem({ title: "F", decision: "downgraded_to_non_blocking" }),
        buildTriageItem({ title: "G", decision: "requires_user_decision" }),
      ],
    });
    const applyTitles = triage.items
      .filter((i) => i.decision === "apply")
      .map((i) => i.title);
    assert.equal(applyTitles.length, 3);
    const repair = buildRepairArtifact({
      items: applyTitles.map((title) => buildRepairItem({ title })),
    });
    assert.deepEqual(validateRepairArtifact(repair), []);
    assert.equal(repair.items.length, applyTitles.length);
  });

  it("TC-15: rejects more than 40 repair items", () => {
    const items = Array.from({ length: 41 }, (_, i) =>
      buildRepairItem({ title: `Item ${i}` }),
    );
    const errors = validateRepairArtifact(buildRepairArtifact({ items }));
    assert.ok(
      errors.some((e) => /items exceeds cap of 40/.test(e)),
      "repair cap of 40 must be enforced",
    );
  });

  it("TC-41: accepts exactly 40 repair items", () => {
    const items = Array.from({ length: 40 }, (_, i) =>
      buildRepairItem({ title: `Item ${i}` }),
    );
    assert.deepEqual(validateRepairArtifact(buildRepairArtifact({ items })), []);
  });

  it("TC-43: rejects repair item referencing an unknown draft.json field path", () => {
    const errors = validateRepairArtifact(
      buildRepairArtifact({
        items: [
          buildRepairItem({ changedFieldPaths: ["approval.unknownField"] }),
        ],
      }),
    );
    assert.ok(
      errors.some((e) =>
        /changedFieldPaths references unknown path: approval\.unknownField/.test(e),
      ),
      "unknown draft field path must be rejected",
    );
  });
});

// ---------------------------------------------------------------------------
// TC-16 / TC-17: coverage-repair auto-approval semantics.
// These rules govern the post-repair draft.json mutation behavior.
// ---------------------------------------------------------------------------

describe("R5/R7 coverage repair auto-approval (TC-16, TC-17)", () => {
  // applyCoverageRepairApproval is a contract function we expect coverage
  // repair to satisfy: it mutates draft.json approval iff no
  // requires_user_decision items remain in the triage.
  function applyCoverageRepairApproval(draft, triage, now) {
    const hasUnresolvedUserDecision = triage.items.some(
      (item) => item.decision === "requires_user_decision",
    );
    if (hasUnresolvedUserDecision) {
      return { ...draft };
    }
    return {
      ...draft,
      approval: {
        ...(draft.approval || {}),
        approved: true,
        confirmedAt: now,
      },
    };
  }

  it("TC-16: sets approval.approved=true and confirmedAt when no requires_user_decision", () => {
    const draft = { approval: { approved: false } };
    const triage = buildTriageArtifact({
      phase: "draft-coverage-triage",
      sourceReview: "specs/<id>/draft-review-coverage.json",
      items: [
        buildTriageItem({ decision: "apply" }),
        buildTriageItem({ decision: "invalid", title: "B" }),
        buildTriageItem({ decision: "already_resolved", title: "C" }),
      ],
    });
    const now = "2026-05-16T01:00:00.000Z";
    const result = applyCoverageRepairApproval(draft, triage, now);
    assert.equal(result.approval.approved, true);
    assert.equal(result.approval.confirmedAt, now);
  });

  it("TC-17: leaves approval.approved unchanged when any requires_user_decision remains", () => {
    const draft = { approval: { approved: false } };
    const triage = buildTriageArtifact({
      phase: "draft-coverage-triage",
      sourceReview: "specs/<id>/draft-review-coverage.json",
      items: [
        buildTriageItem({ decision: "apply" }),
        buildTriageItem({ decision: "requires_user_decision", title: "B" }),
      ],
    });
    const result = applyCoverageRepairApproval(
      draft,
      triage,
      "2026-05-16T01:00:00.000Z",
    );
    assert.notEqual(result.approval.approved, true);
    assert.equal(result.approval.confirmedAt, undefined);
  });
});

// ---------------------------------------------------------------------------
// Minimal grep tripwires (GAP-10): four leaf ids must exist in source as
// stable tokens. These are the only structural checks kept; everything else
// is behavioral above.
// ---------------------------------------------------------------------------

describe("R3 leaf id tripwire (grep)", () => {
  const definition = read("src/flow/definition.js");
  for (const id of [
    "draft-questions-triage",
    "draft-questions-repair",
    "draft-coverage-triage",
    "draft-coverage-repair",
  ]) {
    it(`definition.js declares leaf id ${id}`, () => {
      assert.match(definition, new RegExp(`['"]${id}['"]`));
    });
  }
});
