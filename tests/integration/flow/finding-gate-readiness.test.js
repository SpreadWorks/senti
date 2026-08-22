import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ReviewFindingFingerprint } from "../../../src/flow/lib/finding-disposition-policy.js";
import { evaluateReviewFindingGateReadiness } from "../../../src/flow/lib/run-gate.js";

const GENERATED_AT = "2026-01-02T03:04:05.000Z";

function finding({ key = "missing-typed-artifact", requirementId = "R1", disposition = "must-fix" } = {}) {
  const value = {
    findingKey: key,
    title: "Missing typed artifact",
    failureMode: "missing_acceptance_requirement",
    file: null,
    requirementId,
    guardrailId: null,
    issue: "The typed artifact is missing.",
    suggestion: "Write the typed artifact.",
    disposition,
    rationale: "The accepted requirement makes the artifact mandatory.",
  };
  const fingerprint = ReviewFindingFingerprint.fromFinding({
    ...value,
    scope: "flow",
    phase: "impl-review",
    taskId: null,
    category: value.failureMode,
  }).value;
  return { ...value, findingId: fingerprint, fingerprint };
}

function artifact({
  blockingFindings = [],
  nonBlockingImprovements = [],
  runId = "run-current",
  repairFingerprint = "a".repeat(64),
} = {}) {
  return {
    version: 1,
    phase: "impl",
    generatedAt: GENERATED_AT,
    runId,
    taskId: null,
    planRewindAt: null,
    verdict: blockingFindings.length > 0
      ? "REJECTED"
      : nonBlockingImprovements.length > 0 ? "ADVISORY" : "PASS",
    summary: {
      blocking: blockingFindings.length,
      nonBlocking: nonBlockingImprovements.length,
      total: blockingFindings.length + nonBlockingImprovements.length,
    },
    blockingFindings,
    nonBlockingImprovements,
    repairFingerprint,
  };
}

describe("cataloged review finding gate readiness", () => {
  it("blocks an authoritative must-fix finding without repair evidence", () => {
    const result = evaluateReviewFindingGateReadiness({
      reviewArtifacts: [artifact({ blockingFindings: [finding()] })],
      phase: "integration",
      issueLog: { entries: [] },
      runId: "run-current",
    });

    assert.equal(result.artifact.verdict, "REJECTED");
    assert.equal(result.decision.allowsPass(), false);
    assert.match(result.decision.issues[0], /missing matching repair evidence/);
  });

  it("honors an explicit all-reject triage bound to the finding identity", () => {
    const blocked = finding({ key: "rejected-by-triage" });
    const result = evaluateReviewFindingGateReadiness({
      reviewArtifacts: [artifact({ blockingFindings: [blocked] })],
      phase: "integration",
      issueLog: { entries: [] },
      triage: { items: [{ findingId: blocked.findingId, decision: "reject" }] },
      runId: "run-current",
    });

    assert.equal(result.decision.allowsPass(), true);
  });

  it("retains an unresolved historical obligation when the latest review passes", () => {
    const result = evaluateReviewFindingGateReadiness({
      reviewArtifacts: [
        artifact({ blockingFindings: [finding()] }),
        artifact({ repairFingerprint: "b".repeat(64) }),
      ],
      phase: "integration",
      issueLog: { entries: [] },
      runId: "run-current",
    });

    assert.equal(result.artifact.verdict, "PASS");
    assert.equal(result.decision.allowsPass(), false);
  });

  it("supersedes older obligations only when the current fingerprint is authoritative", () => {
    const result = evaluateReviewFindingGateReadiness({
      reviewArtifacts: [
        artifact({ blockingFindings: [finding()], repairFingerprint: "a".repeat(64) }),
        artifact({ repairFingerprint: "b".repeat(64) }),
      ],
      phase: "integration",
      issueLog: { entries: [] },
      runId: "run-current",
      supersedesHistory: true,
    });

    assert.equal(result.decision.allowsPass(), true);
  });

  it("ignores artifacts from an earlier run while preserving ordered history", () => {
    const result = evaluateReviewFindingGateReadiness({
      reviewArtifacts: [
        artifact({ blockingFindings: [finding()], runId: "run-old" }),
        artifact({ runId: "run-current" }),
      ],
      phase: "integration",
      issueLog: { entries: [] },
      runId: "run-current",
    });

    assert.equal(result.decision.allowsPass(), true);
  });

  it("fails closed when the catalog has no review artifact", () => {
    assert.throws(() => evaluateReviewFindingGateReadiness({
      reviewArtifacts: [],
      phase: "integration",
      issueLog: { entries: [] },
    }), /cataloged implementation review artifact is missing/);
  });

  it("fails closed when a cataloged finding identity was forged", () => {
    const forged = { ...finding(), findingId: "f".repeat(64), fingerprint: "f".repeat(64) };
    assert.throws(() => evaluateReviewFindingGateReadiness({
      reviewArtifacts: [artifact({ blockingFindings: [forged] })],
      phase: "integration",
      issueLog: { entries: [] },
    }), /stable identity/);
  });
});
