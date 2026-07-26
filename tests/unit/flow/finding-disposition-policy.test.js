// spec: R1 R2 R3 R4 R5 R6 R7
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FindingDispositionPolicy,
  InformationalDisposition,
  MustFixDisposition,
  RepairEvidenceReference,
  ReviewFindingFingerprint,
} from "../../../src/flow/lib/finding-disposition-policy.js";

const FINGERPRINT = "a".repeat(64);
const REVIEWED_TREE = "b".repeat(64);
const REVIEWED_HEAD = "d".repeat(40);
const REPAIR_DIFF = "c".repeat(64);

function finding(overrides = {}) {
  return {
    findingId: "review-R1",
    fingerprint: FINGERPRINT,
    category: "maintainability",
    requirementId: "R1",
    rationale: "The finding is tied to the mandatory R1 behavior.",
    ...overrides,
  };
}

function mustFixFinding(overrides = {}) {
  return {
    ...finding(),
    findingId: FINGERPRINT,
    disposition: "must-fix",
    repeatCount: 1,
    ...overrides,
  };
}

function repairEvidence(overrides = {}) {
  return {
    step: "impl-review",
    normalizedFindingId: FINGERPRINT,
    findingFingerprint: FINGERPRINT,
    reviewedTree: REVIEWED_TREE,
    reviewedHead: REVIEWED_HEAD,
    repairDiff: REPAIR_DIFF,
    repairRef: { files: ["src/flow/lib/run-gate.js"] },
    validatingTestResult: { status: "pass", findingFingerprint: FINGERPRINT, reviewedTree: REVIEWED_TREE },
    taskId: null,
    timestamp: "2026-07-19T00:00:00.000Z",
    ...overrides,
  };
}

function evaluateMandatoryGate(policy, evidence, target = {}) {
  return policy.evaluateGate({
    findings: [mustFixFinding()],
    issueLogEntries: [evidence],
    phase: "integration",
    reviewedTree: REVIEWED_TREE,
    reviewedHead: REVIEWED_HEAD,
    repairDiff: REPAIR_DIFF,
    ...target,
  });
}

describe("FindingDispositionPolicy", () => {
  it("R1: classifies findings tied to must requirements and blocking guardrails as must-fix", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });

    const requirementDisposition = policy.classify({
      finding: finding(),
      requirement: { id: "R1", priority: "must" },
      guardrail: null,
      repeatCount: 1,
    });
    const guardrailDisposition = policy.classify({
      finding: finding({ requirementId: null }),
      requirement: null,
      guardrail: { id: "project-oop", severity: "blocking" },
      repeatCount: 1,
    });

    assert.ok(requirementDisposition instanceof MustFixDisposition);
    assert.ok(guardrailDisposition instanceof MustFixDisposition);
    assert.equal(requirementDisposition.fingerprint, FINGERPRINT);
    assert.equal(requirementDisposition.rationale, finding().rationale);
    assert.equal(requirementDisposition.requiresRepair(), true);
  });

  it("R6: keeps informational findings out of the repair loop", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const disposition = policy.classify({
      finding: finding({
        category: "naming",
        requirementId: null,
        rationale: "The name is readable and no requirement or guardrail mandates a change.",
      }),
      requirement: null,
      guardrail: null,
      repeatCount: 1,
    });

    assert.ok(disposition instanceof InformationalDisposition);
    assert.equal(disposition.requiresRepair(), false);
  });

  it("R1: keeps a repeated mandatory fingerprint must-fix at the occurrence bound", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const disposition = policy.classify({
      finding: finding(),
      requirement: { id: "R1", priority: "must" },
      guardrail: null,
      repeatCount: 3,
    });

    assert.ok(disposition instanceof MustFixDisposition);
    assert.equal(disposition.fingerprint, FINGERPRINT);
    assert.equal(disposition.requiresRepair(), true);
  });

  it("R1: rejects a mandatory finding whose rationale is missing", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const input = finding();
    delete input.rationale;

    assert.throws(
      () => policy.classify({
        finding: input,
        requirement: { id: "R1", priority: "must" },
        guardrail: null,
        repeatCount: 1,
      }),
      /rationale.*required|rationale.*non-empty/i,
    );
  });

  it("R2: blocks authoritative must-fix findings until exact scoped repair evidence exists", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const mustFix = mustFixFinding();

    const missing = policy.evaluateGate({
      findings: [mustFix],
      issueLogEntries: [],
      phase: "integration",
    });
    assert.equal(missing.allowsPass(), false);
    assert.match(missing.issues[0], /missing matching repair evidence/);

    const repaired = evaluateMandatoryGate(policy, repairEvidence());
    assert.equal(repaired.allowsPass(), true);

    const wrongTask = policy.evaluateGate({
      findings: [mustFix],
      issueLogEntries: [repairEvidence({ step: "task-review", taskId: "T-2" })],
      phase: "task-impl",
      taskId: "T-1",
    });
    assert.equal(wrongTask.allowsPass(), false);
  });

  it("R2: accepts only fingerprint-bound explicit allow and defer decisions", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    for (const kind of ["allow", "defer"]) {
      const decision = policy.evaluateGate({
        findings: [mustFixFinding({ explicitDecision: { kind, findingFingerprint: FINGERPRINT } })],
        issueLogEntries: [],
        phase: "integration",
      });
      assert.equal(decision.allowsPass(), true);
    }
    assert.throws(
      () => policy.evaluateGate({
        findings: [mustFixFinding({ explicitDecision: { kind: "allow", findingFingerprint: "b".repeat(64) } })],
        issueLogEntries: [],
        phase: "integration",
      }),
      /must match the finding fingerprint/,
    );
  });

  it("R5: separates fingerprints when authoritative findings differ by location or root cause", () => {
    const common = {
      scope: "flow",
      phase: "impl-review",
      requirementId: "R1",
      guardrailId: "complete-context",
      file: "src/flow/lib/finding-disposition-policy.js",
      failureMode: "missing-evidence-binding",
    };

    const first = ReviewFindingFingerprint.fromFinding({
      ...common,
      location: "line:335",
      rootCause: "missing-reviewed-tree",
    });
    const other = ReviewFindingFingerprint.fromFinding({
      ...common,
      location: "line:367",
      rootCause: "missing-validating-test-result",
    });

    assert.equal(first.equals(other), false);
  });

  it("R4: rejects evidence whose reviewed tree differs from the evaluated tree", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const decision = evaluateMandatoryGate(policy, repairEvidence({
      reviewedTree: "d".repeat(64),
      validatingTestResult: { status: "pass", findingFingerprint: FINGERPRINT, reviewedTree: "d".repeat(64) },
    }));

    assert.equal(decision.allowsPass(), false);
  });

  it("R4: rejects fingerprint, repair diff, and test-result mismatches", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    for (const evidence of [
      repairEvidence({ findingFingerprint: "b".repeat(64) }),
      repairEvidence({ repairDiff: "b".repeat(64) }),
      repairEvidence({ validatingTestResult: { status: "fail", findingFingerprint: FINGERPRINT, reviewedTree: REVIEWED_TREE } }),
    ]) {
      assert.equal(evaluateMandatoryGate(policy, evidence).allowsPass(), false);
    }
  });

  it("R3: rejects duplicate complete proofs for one must-fix finding", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const decision = policy.evaluateGate({
      findings: [mustFixFinding()],
      issueLogEntries: [repairEvidence(), repairEvidence()],
      phase: "integration",
      reviewedTree: REVIEWED_TREE,
      reviewedHead: REVIEWED_HEAD,
      repairDiff: REPAIR_DIFF,
    });

    assert.equal(decision.allowsPass(), false);
  });

  it("R3: serializes repairDiff as a top-level evidence value", () => {
    const evidence = new RepairEvidenceReference(repairEvidence()).toJSON();

    assert.equal(evidence.repairDiff, REPAIR_DIFF);
    assert.equal(Object.hasOwn(evidence.repairRef, "diffSha256"), false);
  });

  it("R7: exercises the shared mandatory, evidence, identity, and informational policy contracts", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const mandatory = policy.classify({
      finding: finding(),
      requirement: { id: "R1", priority: "must" },
      repeatCount: 1,
    });
    const informational = policy.classify({
      finding: finding({ requirementId: null, disposition: "informational" }),
      repeatCount: 1,
    });

    assert.ok(mandatory instanceof MustFixDisposition);
    assert.ok(informational instanceof InformationalDisposition);
  });
});
