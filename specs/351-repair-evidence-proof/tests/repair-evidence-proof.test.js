// spec: R1 R2 R3 R4 R5 R6
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  buildAppliedFindingRepairProof,
  recordAppliedFindingRepairEvidence,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import {
  FindingDispositionPolicy,
  RepairEvidenceReference,
} from "../../../src/flow/lib/finding-disposition-policy.js";
import { classifyGateRetryExhaustionSource } from "../../../src/flow/lib/run-gate.js";
import { RepairDeltaArtifact, writeRepairDelta } from "../../../src/flow/lib/repair-state-identity.js";
import { loadIssueLog } from "../../../src/flow/lib/set-issue-log.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

const FINDING = "a".repeat(64);
const TREE = "b".repeat(64);
const DIFF = "c".repeat(64);
const HEAD = "d".repeat(40);
const RECORDED_AT = "2026-07-26T03:00:00.000Z";

function validProof() {
  return buildAppliedFindingRepairProof({
    normalizedFindingId: "review-finding-1",
    findingFingerprint: FINDING,
    reviewedTree: TREE,
    reviewedHead: HEAD,
    repairDiff: DIFF,
    validatingTestResult: {
      status: "pass",
      findingFingerprint: FINDING,
      reviewedTree: TREE,
    },
    repairRef: { files: ["src/example.js"] },
    phase: "integration",
    taskId: null,
    timestamp: RECORDED_AT,
  });
}

function mustFixFinding() {
  return {
    findingId: "review-finding-1",
    fingerprint: FINDING,
    disposition: "must-fix",
    requirementId: "R1",
    rationale: "The finding blocks an integration requirement.",
    reportedAt: "2026-07-26T02:00:00.000Z",
  };
}

test("R1: workflow proof contains every required binding", () => {
  assert.deepEqual(validProof(), {
    normalizedFindingId: "review-finding-1",
    findingFingerprint: FINDING,
    reviewedTree: TREE,
    reviewedHead: HEAD,
    repairDiff: DIFF,
    validatingTestResult: {
      status: "pass",
      findingFingerprint: FINDING,
      reviewedTree: TREE,
    },
    repairRef: { files: ["src/example.js"] },
    phase: "impl-review",
    taskId: null,
    timestamp: RECORDED_AT,
  });
});

test("R1: task review proof keeps the canonical task scope", () => {
  const proof = new RepairEvidenceReference({
    ...validProof(),
    phase: "impl",
    taskId: "T-1",
  });
  assert.equal(proof.scope.phase, "task-review");
  assert.equal(proof.scope.taskId, "T-1");
});

test("R2: matching proof satisfies a must-fix disposition", () => {
  const proof = validProof();
  const decision = new FindingDispositionPolicy({ maxOccurrences: 3 }).evaluateGate({
    findings: [mustFixFinding()],
    issueLogEntries: [proof],
    phase: "integration",
    reviewedTree: TREE,
    reviewedHead: HEAD,
    repairDiff: DIFF,
  });
  assert.equal(decision.allowsPass(), true);
});

test("R3: missing, duplicate, stale, malformed, mismatched, and non-passing proof is rejected", () => {
  const proof = validProof();
  const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
  const context = {
    findings: [mustFixFinding()],
    phase: "integration",
    reviewedTree: TREE,
    reviewedHead: HEAD,
    repairDiff: DIFF,
  };
  assert.throws(() => new RepairEvidenceReference({
    ...proof,
    validatingTestResult: { ...proof.validatingTestResult, status: "fail" },
  }));
  for (const entries of [
    [],
    [proof, proof],
    [{ ...proof, timestamp: "2026-07-26T01:00:00.000Z" }],
    [{ ...proof, reviewedTree: "e".repeat(64) }],
    [{ ...proof, repairDiff: "e".repeat(64) }],
    [{ ...proof, taskId: "T-1" }],
    [{ ...proof, validatingTestResult: { ...proof.validatingTestResult, status: "fail" } }],
    [proof, { ...proof, reviewedHead: "not-a-commit" }],
  ]) {
    assert.equal(policy.evaluateGate({ ...context, issueLogEntries: entries }).allowsPass(), false);
  }
});

test("R4: diagnostic-only issue-log entries cannot satisfy repair proof", () => {
  const decision = new FindingDispositionPolicy({ maxOccurrences: 3 }).evaluateGate({
    findings: [mustFixFinding()],
    issueLogEntries: [{
      step: "impl-repair",
      reason: "Repair completed.",
      trigger: "repair workflow",
      resolution: "Changed src/example.js.",
      normalizedFindingId: "review-finding-1",
      repairRef: { files: ["src/example.js"] },
    }],
    phase: "integration",
    reviewedTree: TREE,
    reviewedHead: HEAD,
    repairDiff: DIFF,
  });
  assert.equal(decision.allowsPass(), false);
});

test("R5: typed draft semantic findings defer without repair proof", () => {
  const classification = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "draft",
      result: "fail",
      evaluations: [{
        guardrail_id: "migration-parity",
        result: "fail",
        category: "semantic",
        reason: "The draft omits the replacement behavior inventory.",
      }],
    },
  });
  assert.equal(classification.reason, "semantic_findings");
  assert.equal(classification.deferAllowed, true);
});

test("R5: non-semantic draft findings remain blocking", () => {
  const classification = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "draft",
      result: "fail",
      evaluations: [{
        guardrail_id: "draft-structure",
        result: "fail",
        category: "process",
        reason: "The draft artifact lifecycle phase is invalid.",
      }],
    },
  });
  assert.equal(classification.deferAllowed, false);
  assert.equal(classification.reason, "non_semantic_findings");
});

test("R6: complete and invalid proof paths remain independently testable", () => {
  assert.equal(validProof().findingFingerprint, FINDING);
  assert.equal(validProof().repairDiff, DIFF);
});

test("R1: validated repair producer persists one complete proof per applied finding", () => {
  const root = createTmpDir("repair-evidence-proof-");
  try {
    const specPath = "specs/proof/spec.json";
    const specDir = path.join(root, "specs/proof");
    writeJson(root, specPath, { requirements: [] });
    writeFile(root, "src/example.js", "export const proof = true;\n");
    writeJson(root, "specs/proof/impl-review.json", {
      phase: "impl",
      reviewedTree: TREE,
      reviewedHead: HEAD,
      blockingFindings: [{ findingId: "review-finding-1", fingerprint: FINDING }],
      nonBlockingImprovements: [],
    });
    writeJson(root, "specs/proof/test-execute-result.json", {
      repairFingerprint: TREE,
      summary: [{ id: "R1", result: "pass" }],
    });
    writeJson(root, "specs/proof/test-result-review.json", {
      repairFingerprint: TREE,
      verdict: "pass",
    });
    const delta = new RepairDeltaArtifact({
      version: 1,
      id: "repair-001",
      previousHash: "e".repeat(64),
      currentHash: "f".repeat(64),
      changedPaths: ["src/example.js"],
    });
    writeRepairDelta(specDir, delta);
    const entry = {
      id: "repair-001",
      sourceFindingIds: ["review-finding-1"],
      reason: "Validated repair proof fixture.",
      previousHash: "e".repeat(64),
      currentHash: "f".repeat(64),
      changedPathCount: 1,
      changedPathsRef: "repair-deltas/repair-001.json",
      changedPathsDigest: delta.digest,
      createdAt: RECORDED_AT,
    };

    recordAppliedFindingRepairEvidence({ root, specPath, sourceStep: "impl-review", entry });
    recordAppliedFindingRepairEvidence({ root, specPath, sourceStep: "impl-review", entry });

    const entries = loadIssueLog(root, specPath).entries;
    assert.equal(entries.length, 1);
    const proof = new RepairEvidenceReference(entries[0]);
    assert.equal(proof.normalizedFindingId, "review-finding-1");
    assert.equal(proof.repairDiff, delta.digest);
    assert.equal(proof.timestamp, RECORDED_AT);
    assert.equal(proof.scope.phase, "impl-review");
    assert.equal(proof.scope.taskId, null);
  } finally {
    removeTmpDir(root);
  }
});
