import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkSpecJson } from "../../../src/flow/lib/run-gate.js";
import {
  validateSpecRepairDocument,
  validateSpecTriageDocument,
} from "../../../src/flow/lib/spec-review-artifacts.js";
import { checkSpecGateReadiness } from "../../../src/flow/lib/spec-gate-readiness.js";

function makeValidSpec() {
  return {
    goal: "Some goal",
    requirements: [{ id: "REQ-1", desc: "Something", priority: "must" }],
    acceptance_criteria: ["Criterion 1"],
    tasks: [{ id: "T-1", parent: null, test_strategy: "Run focused unit tests." }],
  };
}

describe("checkSpecJson — empty-field sanity checks (spec 228)", () => {
  it("REQ-1: reports issue when goal is empty string", () => {
    const spec = { ...makeValidSpec(), goal: "" };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /goal/.test(i) && /empty/.test(i)));
  });

  it("REQ-1: reports issue when goal is whitespace-only", () => {
    const spec = { ...makeValidSpec(), goal: "   " };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /goal/.test(i) && /empty/.test(i)));
  });

  it("REQ-2: reports issue when requirements is empty array", () => {
    const spec = { ...makeValidSpec(), requirements: [] };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /requirements/.test(i) && /empty/.test(i)));
  });

  it("REQ-3: reports issue when acceptance_criteria is empty array", () => {
    const spec = { ...makeValidSpec(), acceptance_criteria: [] };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /acceptance_criteria/.test(i) && /empty/.test(i)));
  });

  it("REQ-4: returns no sanity issues when all fields are non-empty", () => {
    const spec = makeValidSpec();
    const issues = checkSpecJson(spec);
    const sanityIssues = issues.filter(
      (i) => /goal/.test(i) || /requirements.*empty/.test(i) || /acceptance_criteria.*empty/.test(i),
    );
    assert.equal(sanityIssues.length, 0);
  });

  it("reports multiple issues when all three fields are empty", () => {
    const spec = {
      ...makeValidSpec(),
      goal: "",
      requirements: [],
      acceptance_criteria: [],
    };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /goal/.test(i)));
    assert.ok(issues.some((i) => /requirements/.test(i)));
    assert.ok(issues.some((i) => /acceptance_criteria/.test(i)));
  });

  it("reports missing requirement priority only when requirements count is greater than three", () => {
    const spec = {
      ...makeValidSpec(),
      requirements: [
        { id: "R1", desc: "one", priority: "must" },
        { id: "R2", desc: "two" },
        { id: "R3", desc: "three", priority: null },
        { id: "R4", desc: "four", priority: "should" },
      ],
    };

    assert.deepEqual(
      checkSpecJson(spec).filter((issue) => issue.includes(".priority")),
      [
        "requirements[1].priority: missing priority for requirement R2 (required when requirements length is greater than 3)",
        "requirements[2].priority: missing priority for requirement R3 (required when requirements length is greater than 3)",
      ],
    );

    const shortSpec = {
      ...makeValidSpec(),
      requirements: [
        { id: "R1", desc: "one" },
        { id: "R2", desc: "two" },
        { id: "R3", desc: "three" },
      ],
    };
    assert.deepEqual(
      checkSpecJson(shortSpec).filter((issue) => issue.includes(".priority")),
      [],
    );
  });

  it("reports missing, null, and blank task test strategies", () => {
    const spec = {
      ...makeValidSpec(),
      tasks: [
        { id: "T-1", parent: null },
        { id: "T-2", parent: null, test_strategy: null },
        { id: "T-3", parent: null, test_strategy: "   " },
        { id: "T-4", parent: null, test_strategy: "Run focused unit tests." },
      ],
    };

    assert.deepEqual(
      checkSpecJson(spec).filter((issue) => issue.includes(".test_strategy")),
      [
        "tasks[0].test_strategy: missing test strategy for task T-1",
        "tasks[1].test_strategy: missing test strategy for task T-2",
        "tasks[2].test_strategy: missing test strategy for task T-3",
      ],
    );
  });

  it("returns deterministic priority issues before task strategy issues", () => {
    const spec = {
      ...makeValidSpec(),
      requirements: [
        { id: "R1", desc: "one", priority: "must" },
        { id: "R2", desc: "two" },
        { id: "R3", desc: "three", priority: "should" },
        { id: "R4", desc: "four", priority: "nice-to-have" },
      ],
      tasks: [{ id: "T-1", parent: null }],
    };

    assert.deepEqual(checkSpecJson(spec), [
      "requirements[1].priority: missing priority for requirement R2 (required when requirements length is greater than 3)",
      "tasks[0].test_strategy: missing test strategy for task T-1",
    ]);
  });
});

describe("shared spec gate readiness identity checks", () => {
  it("reports duplicate requirement/task ids and invalid task parent graphs", () => {
    const spec = makeValidSpec();
    spec.requirements = [{ id: "R1", desc: "First." }, { id: "R1", desc: "Duplicate." }];
    spec.tasks = [
      { id: "T1", parent: "T2", test_strategy: "Run." },
      { id: "T2", parent: "T1", test_strategy: "Run." },
      { id: "T2", parent: "MISSING", test_strategy: "Run." },
    ];
    const issues = checkSpecGateReadiness(spec);
    assert.ok(issues.some((issue) => issue.includes("requirements[1].id: duplicate")));
    assert.ok(issues.some((issue) => issue.includes("tasks[2].id: duplicate")));
    assert.ok(issues.some((issue) => issue.includes("unknown parent MISSING")));
    assert.ok(issues.some((issue) => issue.includes("parent cycle")));
  });
});

describe("spec review repair document contracts", () => {
  const failReview = {
    verdict: "REJECTED",
    blockingFindings: [
      {
        findingId: "spec-review-blocking-1",
        title: "Missing implementation target",
        target: "R1",
        issue: "Spec omits the existing helper touched by this behavior.",
        requiredChange: "Name the helper.",
        whyBlocking: "Implementation may skip required code.",
      },
    ],
    nonBlockingImprovements: [],
  };

  function triageArtifact(items) {
    return {
      version: 1,
      phase: "spec-triage",
      sourceReview: "spec-review.json",
      summary: "Triaged blocking review findings.",
      items,
    };
  }

  function applyTriageItem(overrides = {}) {
    return {
      findingId: "spec-review-blocking-1",
      title: "Missing implementation target",
      target: "R1",
      decision: "apply",
      rationale: "The finding is still blocking and can be fixed in spec requirements.",
      evidence: "spec.json requirements[0].desc does not name the helper yet.",
      allowedTargets: [{
        target: { entity: "requirement", id: "R1", field: "desc" },
        operationKinds: ["replace-entity-field"],
      }],
      requiredTargets: [{ entity: "requirement", id: "R1", field: "desc" }],
      ...overrides,
    };
  }

  function repairArtifact(operations) {
    return {
      version: 1,
      baseRevision: `sha256:${"b".repeat(64)}`,
      scopeExpansions: [],
      operations,
    };
  }

  function repairOperation(overrides = {}) {
    return {
      findingId: "spec-review-blocking-1",
      kind: "replace-entity-field",
      target: { entity: "requirement", id: "R1", field: "desc" },
      expectedDigest: "a".repeat(64),
      replacement: "The referenced helper is an implementation target.",
      reason: "The referenced helper is in scope and now appears in requirements.",
      ...overrides,
    };
  }

  it("accepts triage decisions plus repair entries for apply items", () => {
    assert.doesNotThrow(() => validateSpecRepairDocument({
      review: failReview,
      triage: triageArtifact([applyTriageItem()]),
      repair: repairArtifact([repairOperation()]),
    }));
  });

  it("accepts triage-only drops with an empty repair artifact", () => {
    const { allowedTargets, requiredTargets, ...nonApply } = applyTriageItem({
      decision: "downgraded_to_non_blocking",
      rationale: "The finding is helpful context but does not block implementation.",
      evidence: "The current requirement already has a testable acceptance path.",
    });
    assert.doesNotThrow(() => validateSpecRepairDocument({
      review: failReview,
      triage: triageArtifact([nonApply]),
      repair: repairArtifact([]),
    }));
  });

  it("rejects triage entries without evidence", () => {
    assert.throws(() => validateSpecTriageDocument({
      review: failReview,
      triage: triageArtifact([{
        title: "Missing implementation target",
        target: "R1",
        decision: "apply",
        rationale: "Apply this finding.",
      }]),
    }), /spec-triage: items\[0\]\.evidence must be non-empty/);
  });

  it("rejects unknown triage decisions", () => {
    assert.throws(() => validateSpecTriageDocument({
      review: failReview,
      triage: triageArtifact([applyTriageItem({ decision: "unsupported" })]),
    }), /spec-triage: items\[0\]\.decision must be one of/);
  });

  it("rejects legacy full-spec repair payloads", () => {
    assert.throws(() => validateSpecRepairDocument({
      review: failReview,
      triage: triageArtifact([applyTriageItem()]),
      repair: { version: 2, baseRevision: `sha256:${"b".repeat(64)}`, operations: [], scopeExpansions: [] },
    }), /invalid schema|version must be 1/);
  });

  it("retains an operation without a reason for command-owned discard audit", () => {
    assert.doesNotThrow(() => validateSpecRepairDocument({
      review: failReview,
      triage: triageArtifact([applyTriageItem()]),
      repair: repairArtifact([repairOperation({ reason: "" })]),
    }));
  });

  it("keeps unauthorized operation decisions for command-owned audit", () => {
    assert.doesNotThrow(() => validateSpecRepairDocument({
      review: failReview,
      triage: triageArtifact([applyTriageItem()]),
      repair: repairArtifact([repairOperation({
        decision: "unsupported",
      })]),
    }));
  });

  it("rejects deferred repair decisions because review findings cannot be delegated to gate", () => {
    assert.throws(() => validateSpecTriageDocument({
      review: failReview,
      triage: triageArtifact([applyTriageItem({ decision: "deferred_to_gate" })]),
    }), /spec-triage: items\[0\]\.decision must be one of/);
  });

  it("rejects triage entries that do not match the source finding", () => {
    const { allowedTargets, requiredTargets, ...nonApply } = applyTriageItem({
      title: "Different finding",
      decision: "invalid",
    });
    assert.throws(() => validateSpecTriageDocument({
      review: failReview,
      triage: triageArtifact([nonApply]),
    }), /title must match the identified canonical blocking finding title/);
  });

  it("rejects triage logs that do not cover every blocking finding", () => {
    const review = {
      ...failReview,
      blockingFindings: [
        ...failReview.blockingFindings,
        { findingId: "spec-review-blocking-2", title: "Second finding", target: "R2", issue: "x", requiredChange: "y", whyBlocking: "z" },
      ],
    };
    assert.throws(() => validateSpecTriageDocument({
      review,
      triage: triageArtifact([applyTriageItem({
        decision: "invalid",
        rationale: "The target is already covered by existing scope.",
        evidence: "spec.json scope.in already covers the implementation target.",
      })]),
    }), /spec-triage\.json items length 1 does not match blockingFindings length 2/);
  });

  it("permits an incomplete proposal so the command can request only the required shortfall", () => {
    assert.doesNotThrow(() => validateSpecRepairDocument({
      review: failReview,
      triage: triageArtifact([applyTriageItem()]),
      repair: repairArtifact([]),
    }));
  });
});
