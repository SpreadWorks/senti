import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkSpecJson } from "../../../src/flow/lib/run-gate.js";
import {
  CanonicalSpecReview,
  SpecReviewDelta,
  mergeSpecReviewDelta,
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

describe("revision-scoped canonical spec review delta contracts", () => {
  function review() {
    return new CanonicalSpecReview({
      version: 2,
      identity: { specId: "001-gate", revision: 1, digest: "a".repeat(64), byteLength: 123 },
      generation: 0,
      findings: [{
        kind: "blocking", findingId: "spec-review-blocking-1", title: "Missing implementation target", target: "R1",
        body: "The requirement does not identify the implementation target.", issue: "Implementation may skip required code.",
        requiredChange: "Name the helper.", whyBlocking: "The behavior cannot be verified.",
      }],
      audit: [],
    });
  }

  function delta(current, stage, values = {}) {
    return new SpecReviewDelta({
      version: 2, stage, identity: current.identity.toJSON(), baseReviewDigest: current.digest,
      findings: [], operations: [], ...values,
    });
  }

  it("merges a typed apply triage update without changing review finding content", () => {
    const current = review();
    const next = mergeSpecReviewDelta({ review: current, delta: delta(current, "spec-triage", {
      findings: [{ findingId: "spec-review-blocking-1", disposition: "apply", evidence: "Requirement R1 is missing the helper.", allowedTargets: [{ target: { entity: "requirement", id: "R1", field: "desc" }, operationKinds: ["replace-entity-field"] }] }],
    }) });
    assert.equal(next.findings.byId("spec-review-blocking-1").title, "Missing implementation target");
    assert.equal(next.findings.byId("spec-review-blocking-1").disposition, "apply");
    assert.equal(next.audit.at(-1).stage, "spec-triage");
  });

  it("accepts partial and empty triage/repair deltas without completeness retries", () => {
    const current = review();
    const triaged = mergeSpecReviewDelta({ review: current, delta: delta(current, "spec-triage") });
    const repaired = mergeSpecReviewDelta({ review: triaged, delta: delta(triaged, "spec-repair") });
    assert.equal(triaged.audit.at(-1).outcome, "no-op");
    assert.equal(repaired.audit.at(-1).outcome, "no-op");
  });

  it("discards malformed and unknown triage entries while retaining valid siblings", () => {
    const current = review();
    const next = mergeSpecReviewDelta({ review: current, delta: delta(current, "spec-triage", {
      findings: [
        { findingId: "spec-review-blocking-1", disposition: "invalid", evidence: "Already covered." },
        { findingId: "unknown", disposition: "reject", evidence: "Bad disposition." },
      ],
    }) });
    assert.equal(next.findings.byId("spec-review-blocking-1").disposition, "invalid");
    assert.equal(next.audit.at(-1).discardedOperations.length, 1);
  });

  it("forbids worker self-triage during the spec-review stage", () => {
    const current = review();
    const parsed = delta(current, "spec-review", { findings: [{
      kind: "blocking", findingId: "self-authorized", title: "Bad", target: "R1", body: "Bad.", issue: "Bad.", requiredChange: "Bad.", whyBlocking: "Bad.",
      disposition: "apply", evidence: "No.", allowedTargets: [{ target: { entity: "requirement", id: "R1", field: "desc" }, operationKinds: ["replace-entity-field"] }],
    }] });
    assert.equal(parsed.findings.findings.length, 0);
    assert.equal(parsed.discardedFindings.length, 1);
  });

  it("rejects V1 and stale V2 envelopes at the typed boundary", () => {
    const current = review();
    assert.throws(() => new SpecReviewDelta({ version: 1, stage: "spec-repair", identity: current.identity.toJSON(), baseReviewDigest: current.digest, findings: [], operations: [] }));
    assert.throws(() => mergeSpecReviewDelta({ review: current, delta: new SpecReviewDelta({ version: 2, stage: "spec-repair", identity: current.identity.toJSON(), baseReviewDigest: "b".repeat(64), findings: [], operations: [] }) }), /stale/);
  });
});
