// spec: R1 R2 R3 R4 R5 R6 R7
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FindingDispositionPolicy,
  InformationalDisposition,
  MustFixDisposition,
  ReviewFindingFingerprint,
} from "../../../src/flow/lib/finding-disposition-policy.js";
import "../../../tests/unit/flow/finding-disposition-policy.test.js";

const FINDING_FINGERPRINT = "a".repeat(64);
const REVIEWED_TREE = "b".repeat(64);
const REVIEWED_HEAD = "d".repeat(40);
const REPAIR_DIFF = "c".repeat(64);

function mandatoryFinding(overrides = {}) {
  return {
    findingId: FINDING_FINGERPRINT,
    fingerprint: FINDING_FINGERPRINT,
    category: "policy",
    requirementId: "R1",
    rationale: "A mandatory finding requires repair before the gate can pass.",
    disposition: "must-fix",
    repeatCount: 1,
    ...overrides,
  };
}

function exactEvidence(overrides = {}) {
  return {
    step: "impl-review",
    normalizedFindingId: FINDING_FINGERPRINT,
    findingFingerprint: FINDING_FINGERPRINT,
    reviewedTree: REVIEWED_TREE,
    reviewedHead: REVIEWED_HEAD,
    repairDiff: REPAIR_DIFF,
    repairRef: {
      files: ["src/flow/lib/finding-disposition-policy.js"],
    },
    validatingTestResult: {
      status: "pass",
      findingFingerprint: FINDING_FINGERPRINT,
      reviewedTree: REVIEWED_TREE,
    },
    taskId: null,
    timestamp: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

function evaluateMandatoryGate(policy, {
  finding = mandatoryFinding(),
  issueLogEntries = [exactEvidence()],
  reviewedTree = REVIEWED_TREE,
  reviewedHead = REVIEWED_HEAD,
  repairDiff = REPAIR_DIFF,
} = {}) {
  return policy.evaluateGate({
    findings: [finding],
    issueLogEntries,
    phase: "integration",
    reviewedTree,
    reviewedHead,
    repairDiff,
    root: process.cwd(),
  });
}

describe("Issue #467 finding disposition policy", () => {
  it("R1: keeps a repeated mandatory finding must-fix at the occurrence limit", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const disposition = policy.classify({
      finding: mandatoryFinding(),
      requirement: { id: "R1", priority: "must" },
      repeatCount: 3,
    });

    assert.ok(disposition instanceof MustFixDisposition);
    assert.equal(disposition.requiresRepair(), true);
  });

  it("R1: keeps a repeated blocking guardrail finding must-fix at the occurrence limit", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const disposition = policy.classify({
      finding: mandatoryFinding({ requirementId: null }),
      guardrail: { id: "complete-context", severity: "blocking" },
      repeatCount: 3,
    });

    assert.ok(disposition instanceof MustFixDisposition);
    assert.equal(disposition.requiresRepair(), true);
  });

  it("R2: unblocks a mandatory finding only with exact repair evidence", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const decision = evaluateMandatoryGate(policy);

    assert.equal(decision.allowsPass(), true);
  });

  it("R2: accepts an existing explicit deferred decision without repair evidence", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const decision = policy.evaluateGate({
      findings: [mandatoryFinding({ explicitDecision: { kind: "defer", findingFingerprint: FINDING_FINGERPRINT } })],
      issueLogEntries: [],
      phase: "integration",
      reviewedTree: REVIEWED_TREE,
      root: process.cwd(),
    });

    assert.equal(decision.allowsPass(), true);
  });

  it("R2: accepts an existing explicit allow decision without repair evidence", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const decision = policy.evaluateGate({
      findings: [mandatoryFinding({ explicitDecision: { kind: "allow", findingFingerprint: FINDING_FINGERPRINT } })],
      issueLogEntries: [],
      phase: "integration",
      reviewedTree: REVIEWED_TREE,
      root: process.cwd(),
    });

    assert.equal(decision.allowsPass(), true);
  });

  it("R3: requires the evidence fingerprint, tree, diff, and test result to match", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const decision = evaluateMandatoryGate(policy);

    assert.equal(decision.evidence.length, 1);
  });

  for (const [name, evidence] of [
    ["unrelated finding", exactEvidence({ normalizedFindingId: "d".repeat(64), findingFingerprint: "d".repeat(64) })],
    ["stale evaluated target tree", exactEvidence({ reviewedTree: "d".repeat(64) })],
    ["touched-only repair reference", exactEvidence({
      repairDiff: undefined,
      repairRef: { files: ["src/flow/lib/finding-disposition-policy.js"] },
    })],
    ["missing repair reference", exactEvidence({ repairRef: undefined })],
    ["missing finding fingerprint", exactEvidence({ findingFingerprint: undefined })],
    ["finding fingerprint", exactEvidence({ findingFingerprint: "d".repeat(64) })],
    ["missing reviewed tree", exactEvidence({ reviewedTree: undefined })],
    ["reviewed tree", exactEvidence({ reviewedTree: "d".repeat(64) })],
    ["missing reviewed HEAD", exactEvidence({ reviewedHead: undefined })],
    ["reviewed HEAD", exactEvidence({ reviewedHead: "e".repeat(40) })],
    ["repair diff", exactEvidence({ repairDiff: "d".repeat(64) })],
    ["test result", exactEvidence({ validatingTestResult: { status: "fail", findingFingerprint: FINDING_FINGERPRINT, reviewedTree: REVIEWED_TREE } })],
    ["missing test result", exactEvidence({ validatingTestResult: undefined })],
    ["test result finding fingerprint", exactEvidence({ validatingTestResult: { status: "pass", findingFingerprint: "d".repeat(64), reviewedTree: REVIEWED_TREE } })],
    ["test result reviewed tree", exactEvidence({ validatingTestResult: { status: "pass", findingFingerprint: FINDING_FINGERPRINT, reviewedTree: "d".repeat(64) } })],
  ]) {
    it(`R4: rejects evidence with a mismatched ${name}`, () => {
      const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
      const decision = evaluateMandatoryGate(policy, { issueLogEntries: [evidence] });

      assert.equal(decision.allowsPass(), false);
    });
  }

  it("R5: gives findings at different locations or with different root causes distinct fingerprints", () => {
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
    const differentLocation = ReviewFindingFingerprint.fromFinding({
      ...common,
      location: "line:367",
      rootCause: "missing-reviewed-tree",
    });
    const differentCause = ReviewFindingFingerprint.fromFinding({
      ...common,
      location: "line:335",
      rootCause: "missing-validating-test-result",
    });

    assert.equal(first.equals(differentLocation), false);
    assert.equal(first.equals(differentCause), false);
  });

  it("R6: retains informational disposition for a non-mandatory finding", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const disposition = policy.classify({
      finding: mandatoryFinding({ requirementId: null, disposition: "informational" }),
      repeatCount: 3,
    });

    assert.ok(disposition instanceof InformationalDisposition);
    assert.equal(disposition.requiresRepair(), false);
  });

  it("R7: exercises policy classes used by the shared and spec-local regression contracts", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const mandatory = policy.classify({
      finding: mandatoryFinding(),
      requirement: { id: "R1", priority: "must" },
      repeatCount: 1,
    });
    const informational = policy.classify({
      finding: mandatoryFinding({ requirementId: null, disposition: "informational" }),
      repeatCount: 1,
    });

    assert.ok(mandatory instanceof MustFixDisposition);
    assert.ok(informational instanceof InformationalDisposition);
  });
});
