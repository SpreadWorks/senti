import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  checkReviewRetryBelowMax,
  updateReviewRetryCounter,
} from "../../../src/flow/lib/run-review.js";
import { runImplReview } from "../../../src/flow/commands/review.js";
import {
  checkRetryBelowMax as checkGateRetryBelowMax,
  classifyGateRetryExhaustionSource,
  resolveRetryMax,
  updateGateRetryCounter,
} from "../../../src/flow/lib/run-gate.js";
import SetIssueLogCommand from "../../../src/flow/lib/set-issue-log.js";
import {
  buildAcceptanceReviewArtifactFromEvidence,
  writeAcceptanceReviewArtifact,
} from "../../../src/flow/lib/acceptance-review-artifacts.js";
import { readFlowFindingsArtifact } from "../../../src/flow/lib/flow-findings.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";

let tmp;

const SEMANTIC_FINDING_FINGERPRINT = "a".repeat(64);

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function semanticFinding(id) {
  return {
    findingId: id,
    fingerprint: SEMANTIC_FINDING_FINGERPRINT,
    disposition: "must-fix",
    failureMode: "missing_acceptance_requirement",
    category: "semantic",
    title: "Missing test-facing behavior",
    reason: "The semantic finding mentions missing test behavior without representing a mechanical precheck failure.",
    rationale: "The finding blocks a mandatory acceptance requirement.",
  };
}

function retryMetrics(counter, phase, count = 10) {
  return Array.from({ length: count }, () => ({ phase, counter, delta: 1 }));
}

function fakeFlowManager(updates) {
  return {
    updateStepStatus(id, status) {
      updates.push({ id, status });
    },
  };
}

function prepareSpecRoot() {
  tmp = createTmpDir("retry-exhaustion-defer-");
  writeJson(tmp, "specs/demo/spec.json", {
    requirements: [{ id: "R1", desc: "demo requirement", priority: "must" }],
  });
  return {
    root: tmp,
    specDir: path.join(tmp, "specs", "demo"),
    specPath: "specs/demo/spec.json",
  };
}

function prepareAcceptanceEvidence(specDir) {
  writeJson(specDir, "scenario-validity-result.json", { result: "pass" });
  writeFile(specDir, "tests/retry-exhaustion.test.js", "test('R1: demo requirement', () => {});\n");
  writeJson(specDir, "test-execute-result.json", {
    version: "2",
    summary: [{ id: "R1", result: "pass" }],
  });
  writeJson(specDir, "test-result-review.json", { verdict: "pass" });
  writeJson(specDir, "retro.json", { result: "pass" });
}

test("review retry exhaustion defers semantic findings without prose keyword blocking", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "FAIL",
    blockingFindings: [semanticFinding("test-semantic")],
  });
  const updates = [];
  const result = checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    },
    flowManager: fakeFlowManager(updates),
  }, "test");

  assert.equal(result?.result, "deferred");
  assert.deepEqual(updates, [{ id: "test-review", status: "done" }]);
  const finding = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0];
  assert.equal(finding.sourceArtifact, "test-review.json");
  assert.equal(finding.sourceFindingId, "test-semantic");
});

for (const missingField of ["disposition", "rationale"]) {
  test(`review retry exhaustion rejects a semantic finding without ${missingField}`, () => {
    const fixture = prepareSpecRoot();
    const invalidFinding = semanticFinding("invalid-semantic");
    delete invalidFinding[missingField];
    writeJson(fixture.specDir, "test-review.json", {
      verdict: "FAIL",
      blockingFindings: [invalidFinding],
    });

    assert.throws(
      () => checkReviewRetryBelowMax({
        root: fixture.root,
        flowState: {
          spec: fixture.specPath,
          metrics: retryMetrics("reviewRetry", "test"),
        },
        flowManager: fakeFlowManager([]),
      }, "test"),
      new RegExp(`${missingField}.*(required|non-empty)`, "i"),
    );
    assert.equal(readFlowFindingsArtifact(fixture.specDir).toJSON().entries.length, 0);
  });
}

test("review retry exhaustion groups repeated findings by fingerprint", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "FAIL",
    blockingFindings: [
      semanticFinding("repeat-first"),
      semanticFinding("repeat-second"),
    ],
  });
  const updates = [];
  const result = checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    },
    flowManager: fakeFlowManager(updates),
  }, "test");

  assert.equal(result?.result, "deferred");
  assert.equal(result?.artifacts?.completionKind, "deferred");
  assert.equal(result?.artifacts?.findingCount, 1);
  assert.deepEqual(updates, [{ id: "test-review", status: "done" }]);
  const findings = readFlowFindingsArtifact(fixture.specDir).toJSON().entries;
  assert.equal(findings.length, 1);
  assert.equal(findings[0].fingerprint, SEMANTIC_FINDING_FINGERPRINT);
});

test("review retry exhaustion excludes informational findings from deferred work", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "FAIL",
    findings: [
      semanticFinding("must-fix"),
      {
        ...semanticFinding("informational"),
        fingerprint: "c".repeat(64),
        disposition: "informational",
        rationale: "This observation has no mandatory repair authority.",
      },
    ],
  });
  const result = checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    },
    flowManager: fakeFlowManager([]),
  }, "test");

  assert.equal(result?.result, "deferred");
  const findings = readFlowFindingsArtifact(fixture.specDir).toJSON().entries;
  assert.equal(findings.length, 1);
  assert.equal(findings[0].fingerprint, SEMANTIC_FINDING_FINGERPRINT);
});

test("deferred findings remain isolated by flow run", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "FAIL",
    blockingFindings: [semanticFinding("same-finding")],
  });
  const deferForRun = (runId) => checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: {
      runId,
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    },
    flowManager: fakeFlowManager([]),
  }, "test");

  assert.equal(deferForRun("run-a")?.result, "deferred");
  assert.equal(deferForRun("run-b")?.result, "deferred");
  const all = readFlowFindingsArtifact(fixture.specDir).toJSON().entries;
  const runA = readFlowFindingsArtifact(fixture.specDir, {
    flowState: { runId: "run-a" },
  }).toJSON().entries;
  const runB = readFlowFindingsArtifact(fixture.specDir, {
    flowState: { runId: "run-b" },
  }).toJSON().entries;

  assert.equal(all.length, 2);
  assert.equal(runA.length, 1);
  assert.equal(runB.length, 1);
  assert.equal(runA[0].runId, "run-a");
  assert.equal(runB[0].runId, "run-b");
});

test("task review producer records an explicit scoped defer outcome at its configured bound", async () => {
  const fixture = prepareSpecRoot();
  const flowState = {
    runId: "task-review-bounded",
    spec: fixture.specPath,
    currentTaskId: "T-1",
    stepAttempts: [],
  };
  const updates = [];
  const context = {
    root: fixture.root,
    phase: null,
    flowState,
    flowManager: {
      mutate(mutator) { mutator(flowState); },
      updateStepStatus(id, status) { updates.push({ id, status }); },
    },
  };
  let result;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    result = await runImplReview({
      root: fixture.root,
      flow: flowState,
      taskSpec: { task: { id: "T-1" }, relPath: "specs/demo/tasks/T-1.md", content: "Task T-1" },
      touchedFiles: new Set(),
      reviewOutput: JSON.stringify({
        blockingFindings: [{
          findingKey: "missing-task-behavior",
          title: "Missing task behavior",
          failureMode: "missing_acceptance_requirement",
          file: null,
          requirementId: "R1",
          issue: "The task behavior is missing.",
          suggestion: "Implement the task behavior.",
          disposition: "must-fix",
          rationale: "R1 makes the task behavior mandatory.",
        }],
        nonBlockingImprovements: [],
      }),
    });
    updateReviewRetryCounter(context, result);
  }

  assert.equal(result.result, "deferred");
  assert.deepEqual(updates, [{ id: "task-review", status: "done" }]);
  const deferred = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0];
  assert.equal(deferred.sourceStep, "task-review");
  assert.equal(deferred.disposition, "deferred");
});

test("gate retry exhaustion defers typed informational findings and blocks structured coverage failures", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "impl-gate-result.json", {
    phase: "integration",
    result: "fail",
    evaluations: [{
      findingId: "integration-semantic",
      fingerprint: SEMANTIC_FINDING_FINGERPRINT,
      result: "fail",
      category: "semantic",
      reason: "Missing command behavior in a semantic requirement path.",
      rationale: "This bounded informational finding has no mandatory authority.",
      disposition: "informational",
    }],
  });
  const updates = [];
  const result = checkGateRetryBelowMax({
    root: fixture.root,
    flowState: {
      spec: fixture.specPath,
      metrics: retryMetrics("gateRetry", "integration"),
    },
    flowManager: fakeFlowManager(updates),
  }, "integration");

  assert.equal(result?.result, "deferred");
  assert.deepEqual(updates, [{ id: "impl-gate", status: "done" }]);
  assert.equal(readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0].sourceFindingId, "integration-semantic");

  const coverage = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "test",
      result: "fail",
      blockingFindings: [{ origin: "test-coverage", failureKind: "missing_header" }],
    },
  });
  assert.equal(coverage.deferAllowed, false);
  assert.equal(coverage.reason, "coverage_header_failure");
});

test("gate rejects a blocking observation without a typed disposition", () => {
  const classification = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "integration",
      result: "fail",
      observations: [{
        severity: "blocking",
        observed: "A blocking observation without authority or disposition.",
      }],
    },
  });

  assert.equal(classification.deferAllowed, false);
  assert.equal(classification.reason, "invalid_finding_disposition");
});

test("gate refuses to defer a must-fix finding without matching repair evidence", () => {
  const finding = {
    guardrail_id: "R1",
    result: "fail",
    category: "requirements",
    reason: "R1 is not implemented.",
  };
  const classification = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "integration",
      result: "fail",
      evaluations: [finding],
    },
    repairEvidence: [],
  });

  assert.equal(classification.deferAllowed, false);
  assert.equal(classification.completionKind, "blocking");
  assert.equal(classification.reason, "missing_repair_evidence");
});

test("gate types real requirement evaluation failures before retry exhaustion classification", () => {
  const classification = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "integration",
      result: "fail",
      evaluations: [{
        guardrail_id: "R1",
        result: "fail",
        category: "requirements",
        reason: "R1 is not implemented.",
      }],
    },
    issueLogEntries: [],
  });

  assert.equal(classification.deferAllowed, false);
  assert.equal(classification.reason, "missing_repair_evidence");
});

test("gate rejects stale repair claims and tampered typed dispositions", () => {
  const fixture = prepareSpecRoot();
  const flowState = { spec: fixture.specPath, currentTaskId: null, metrics: [] };
  const result = {
    result: "fail",
    artifacts: {
      phase: "spec",
      failureKind: "ai_semantic_fail",
      evaluations: [{
        guardrail_id: "R1",
        result: "fail",
        category: "requirements",
        reason: "R1 is not implemented.",
      }],
    },
  };
  updateGateRetryCounter({
    root: fixture.root,
    phase: "spec",
    flowState,
    flowManager: { appendMetric(metric) { flowState.metrics.push(metric); } },
  }, result);
  const finding = result.artifacts.evaluations[0];
  writeFile(fixture.root, "src/example.js", "export const example = 'repaired';\n");

  const stale = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "spec",
      generatedAt: result.artifacts.generatedAt,
      result: "fail",
      evaluations: [finding],
    },
    root: fixture.root,
    issueLogEntries: [{
      step: "spec-gate",
      normalizedFindingId: finding.findingId,
      repairRef: { files: ["src/example.js"] },
      timestamp: "2000-01-01T00:00:00.000Z",
    }],
  });
  assert.equal(stale.deferAllowed, false);
  assert.equal(stale.reason, "missing_repair_evidence");

  const tampered = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "spec",
      generatedAt: result.artifacts.generatedAt,
      result: "fail",
      evaluations: [{ ...finding, disposition: "informational" }],
    },
  });
  assert.equal(tampered.deferAllowed, false);
  assert.equal(tampered.reason, "invalid_finding_disposition");
});

test("gate retry producer uses live scoped issue-log evidence at the bound", () => {
  const fixture = prepareSpecRoot();
  writeFile(fixture.root, "src/example.js", "export const example = true;\n");
  const flowState = {
    spec: fixture.specPath,
    currentTaskId: null,
    metrics: [],
  };
  const firstResult = {
    result: "fail",
    artifacts: {
      phase: "spec",
      failureKind: "ai_semantic_fail",
      evaluations: [{
        guardrail_id: "R1",
        result: "fail",
        category: "requirements",
        reason: "R1 is not implemented.",
      }],
    },
  };
  updateGateRetryCounter({
    root: fixture.root,
    phase: "spec",
    flowState,
    flowManager: { appendMetric(metric) { flowState.metrics.push(metric); } },
  }, firstResult);
  const findingId = firstResult.artifacts.evaluations[0].findingId;
  assert.match(findingId, /^[a-f0-9]{64}$/);
  writeFile(fixture.root, "src/example.js", "export const example = 'repaired';\n");
  new SetIssueLogCommand().execute({
    root: fixture.root,
    flowState,
    step: "spec-gate",
    reason: "Implemented the missing requirement before the bounded retry.",
    normalizedFindingId: findingId,
    repairRefFile: "src/example.js",
  });
  const max = resolveRetryMax({ flowState, scope: "flow" }, "spec");
  flowState.metrics = retryMetrics("gateRetry", "spec", max - 1);
  const updates = [];
  const boundedResult = {
    result: "fail",
    artifacts: {
      phase: "spec",
      failureKind: "ai_semantic_fail",
      evaluations: [{
        guardrail_id: "R1",
        result: "fail",
        category: "requirements",
        reason: "R1 is still not implemented after the repair attempt.",
      }],
    },
  };
  updateGateRetryCounter({
    root: fixture.root,
    phase: "spec",
    flowState,
    flowManager: {
      appendMetric(metric) { flowState.metrics.push(metric); },
      mutate(mutator) { mutator(flowState); },
      updateStepStatus(id, status) { updates.push({ id, status }); },
    },
  }, boundedResult);

  assert.equal(boundedResult.result, "deferred");
  assert.deepEqual(updates, [{ id: "spec-gate", status: "done" }]);
});

test("gate retry exhaustion remains blocked when must-fix repair evidence is missing", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "impl-gate-result.json", {
    phase: "integration",
    result: "fail",
    evaluations: [{
      guardrail_id: "R1",
      result: "fail",
      category: "requirements",
      reason: "R1 is not implemented.",
    }],
    repairEvidence: [],
  });
  const updates = [];
  const result = checkGateRetryBelowMax({
    root: fixture.root,
    flowState: {
      spec: fixture.specPath,
      metrics: retryMetrics("gateRetry", "integration"),
    },
    flowManager: fakeFlowManager(updates),
  }, "integration");

  assert.equal(result?.ok, false);
  assert.ok(result?.errors?.some((error) => error.code === "ESCALATE_RETRY_EXHAUSTED"));
  assert.deepEqual(updates, []);
  assert.equal(readFlowFindingsArtifact(fixture.specDir).toJSON().entries.length, 0);
});

test("acceptance-review consumes deferred findings and mirrors final disposition", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "FAIL",
    blockingFindings: [semanticFinding("test-semantic")],
  });
  checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    },
    flowManager: fakeFlowManager([]),
  }, "test");
  prepareAcceptanceEvidence(fixture.specDir);

  const deferredFindingId = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0].findingId;
  writeJson(fixture.specDir, "acceptance-review-evidence.json", {
    deferredFindingDispositions: [{
      findingId: deferredFindingId,
      finalDisposition: "fixed",
      evidenceRefs: ["test-review.json#test-semantic"],
    }],
  });
  const artifact = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  assert.equal(artifact.verdict, "pass");
  assert.equal(artifact.deferredFindings[0].finalDisposition, "fixed");

  writeAcceptanceReviewArtifact({ specDir: fixture.specDir, artifact });
  const mirrored = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0];
  assert.equal(mirrored.finalDisposition, "fixed");

  fs.renameSync(path.join(fixture.specDir, "test-review.json"), path.join(fixture.specDir, "test-review.json.bak"));
  const missingSource = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  assert.equal(missingSource.verdict, "blocked");
});
