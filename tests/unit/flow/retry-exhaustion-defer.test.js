import assert from "node:assert/strict";
import crypto from "node:crypto";
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
  checkIntegrationTestArtifacts,
  resolveRetryMax,
  updateGateRetryCounter,
} from "../../../src/flow/lib/run-gate.js";
import SetIssueLogCommand from "../../../src/flow/lib/set-issue-log.js";
import {
  applyAcceptanceReviewResult,
  artifactFromAcceptanceJudgments,
  buildAcceptanceReviewContext,
  deriveAcceptanceReviewVerdict,
  writeAcceptanceReviewArtifact,
} from "../../../src/flow/lib/acceptance-review-artifacts.js";
import {
  AcceptanceResponseBinding,
  bindAcceptanceResponse,
  buildDeferredDispositionRepairPrompt,
  DeferredDispositionCoverage,
} from "../../../src/flow/lib/run-acceptance-review.js";
import {
  buildRepairFingerprint,
  readRejectedImplReviewTriage,
  writeRepairEvidenceArtifact,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import {
  readFlowFindingsArtifact,
  writeFlowFindingsArtifact,
} from "../../../src/flow/lib/flow-findings.js";
import { materializeNonblockingAcceptanceHandoff } from "../../../src/flow/lib/nonblocking-handoff.js";
import {
  applyReviewEvidenceTransition,
  ReviewDisposition,
  ReviewEvidence,
} from "../../../src/flow/lib/review-convergence.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import {
  makeDefaultTask,
  makeFlowState,
  moveFlowToStep,
} from "../../helpers/flow-setup.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
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
    updateStepStatus(transition) {
      updates.push({ id: transition.stepId, status: transition.requestedStatus });
    },
  };
}

function flowStateAt(stepId, overrides = {}) {
  return moveFlowToStep(makeFlowState(overrides), stepId);
}

function taskReviewState(overrides = {}) {
  return makeFlowState({
    ...overrides,
    currentTaskId: "T-1",
    tasks: [makeDefaultTask({
      id: "T-1",
      status: "in_progress",
      steps: [
        { id: "task-impl", status: "done" },
        { id: "task-review", status: "in_progress" },
        { id: "task-gate", status: "pending" },
      ],
    })],
  });
}

function prepareSpecRoot() {
  tmp = createTmpDir("retry-exhaustion-defer-");
  writeJson(tmp, ".senti/config.json", {
    name: "deferred-finding-test",
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  writeFile(tmp, "src/demo.js", "export const demo = true;\n");
  writeJson(tmp, "specs/demo/spec.json", {
    requirements: [{ id: "R1", desc: "demo requirement", priority: "must" }],
  });
  return {
    root: tmp,
    specDir: path.join(tmp, "specs", "demo"),
    specPath: "specs/demo/spec.json",
  };
}

function prepareAcceptanceEvidence({ root, specDir, specPath }) {
  const testFile = "specs/demo/tests/retry-exhaustion.test.js";
  const scenarioRaw = "specs/demo/tests/.raw/scenario-validity.log";
  const executionRaw = "specs/demo/tests/.raw/test-execution.log";
  writeFile(root, testFile, "test('R1: demo requirement', () => {});\n");
  writeFile(root, scenarioRaw, "R1 expected failure\n");
  writeFile(root, executionRaw, "R1 pass\n");
  writeJson(specDir, "scenario-validity-result.json", {
    version: "1",
    raw_output_path: scenarioRaw,
    command: `node ${testFile}`,
    process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null },
    result: "pass",
    summary: [{
      id: "R1",
      classification: "expected_fail",
      evidence: {
        test_file: testFile,
        test_name: "R1: demo requirement",
        command: `node ${testFile}`,
        raw_output_lines: { start_line: 1, end_line: 1 },
      },
    }],
  });
  const fingerprint = buildRepairFingerprint({ root, specPath });
  writeRepairEvidenceArtifact({ specDir, stepId: "test-execute", fingerprint, artifact: {
    version: "2",
    raw_output_path: executionRaw,
    summary: [{
      id: "R1",
      result: "pass",
      evidence: {
        test_file: testFile,
        test_name: "R1: demo requirement",
        command: `node --test ${testFile}`,
        raw_output_lines: { start_line: 1, end_line: 1 },
      },
    }],
    regression: {
      required: false,
      result: "skipped",
      mode: "none",
      changed_files: [],
      trigger_relevant_changed_files: [],
      category: "spec-artifact-only",
      reason: "unit fixture",
      classified_paths: [],
    },
  }});
  writeRepairEvidenceArtifact({ specDir, stepId: "test-result-review", fingerprint, artifact: {
    verdict: "pass",
    checked_items: [{ check: "project_regression_verification", result: "pass", detail: "verified" }],
    result_file_path: "specs/demo/test-execute-result.json",
    raw_output_path: executionRaw,
  }});
  writeRepairEvidenceArtifact({ specDir, stepId: "impl-review", fingerprint, artifact: {
    version: 1,
    phase: "impl",
    generatedAt: new Date().toISOString(),
    verdict: "PASS",
    summary: { blocking: 0, nonBlocking: 0, total: 0 },
    blockingFindings: [],
    nonBlockingImprovements: [],
    excluded: { missingFile: 0, outOfScope: 0 },
  }});
  writeRepairEvidenceArtifact({ specDir, stepId: "impl-gate", fingerprint, artifact: {
    verdict: "pass",
    issues: [],
    nextAction: "retro",
    level: "integration",
    phase: "integration",
    evaluations: [],
    reasons: [],
  }});
  writeRepairEvidenceArtifact({ specDir, stepId: "retro", fingerprint, artifact: {
    spec: specPath,
    date: new Date().toISOString(),
    mode: "result-file",
    requirements: [{ desc: "demo requirement", status: "done", note: "R1: demo requirement" }],
    unplanned: [],
    summary: {
      total: 1,
      done: 1,
      partial: 0,
      not_done: 0,
      not_applicable_count: 0,
      na_count: 0,
      not_testable_count: 0,
      rate: 1,
      notes: "unit fixture",
    },
  }});
  return fingerprint;
}

test("review retry exhaustion defers semantic findings without prose keyword blocking", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "REJECTED",
    blockingFindings: [semanticFinding("test-semantic")],
  });
  const updates = [];
  const flowFindingsPath = path.join(fixture.specDir, "flow-findings.json");
  const result = checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: flowStateAt("test-review", {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    }),
    flowManager: {
      updateStepStatus(transition) {
        assert.equal(fs.existsSync(flowFindingsPath), true, "deferred artifact must exist before the step commit");
        updates.push({ id: transition.stepId, status: transition.requestedStatus });
      },
    },
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
      verdict: "REJECTED",
      blockingFindings: [invalidFinding],
    });

    assert.throws(
      () => checkReviewRetryBelowMax({
        root: fixture.root,
        flowState: flowStateAt("test-review", {
          spec: fixture.specPath,
          metrics: retryMetrics("reviewRetry", "test"),
        }),
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
    verdict: "REJECTED",
    blockingFindings: [
      semanticFinding("repeat-first"),
      semanticFinding("repeat-second"),
    ],
  });
  const updates = [];
  const result = checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: flowStateAt("test-review", {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    }),
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
    verdict: "REJECTED",
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
    flowState: flowStateAt("test-review", {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    }),
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
    verdict: "REJECTED",
    blockingFindings: [semanticFinding("same-finding")],
  });
  const deferForRun = (runId) => checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: flowStateAt("test-review", {
      runId,
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    }),
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
  const flowState = taskReviewState({
    runId: "task-review-bounded",
    spec: fixture.specPath,
    stepAttempts: [],
  });
  const updates = [];
  const context = {
    root: fixture.root,
    phase: null,
    flowState,
    flowManager: {
      mutate(mutator) { mutator(flowState); },
      updateStepStatus(transition) {
        updates.push({ id: transition.stepId, status: transition.requestedStatus });
      },
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
    runId: "run-test",
    planRewindAt: null,
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
  const flowFindingsPath = path.join(fixture.specDir, "flow-findings.json");
  const result = checkGateRetryBelowMax({
    root: fixture.root,
    flowState: flowStateAt("impl-gate", {
      spec: fixture.specPath,
      metrics: retryMetrics("gateRetry", "integration"),
    }),
    flowManager: {
      updateStepStatus(transition) {
        assert.equal(fs.existsSync(flowFindingsPath), true, "deferred artifact must exist before the step commit");
        const source = JSON.parse(fs.readFileSync(path.join(fixture.specDir, "impl-gate-result.json"), "utf8"));
        assert.equal(source.evaluations[0].findingId, "integration-semantic");
        updates.push({ id: transition.stepId, status: transition.requestedStatus });
      },
    },
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

test("draft gate defers typed semantic findings without implementation repair evidence", () => {
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
    repairEvidence: [],
  });

  assert.equal(classification.deferAllowed, true);
  assert.equal(classification.completionKind, "deferred");
  assert.equal(classification.reason, "semantic_findings");
});

test("draft gate keeps typed non-semantic findings blocking", () => {
  const classification = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "draft",
      result: "fail",
      evaluations: [{
        guardrail_id: "migration-parity",
        result: "fail",
        category: "process",
        reason: "The draft review artifact has an invalid lifecycle phase.",
      }],
    },
  });

  assert.equal(classification.deferAllowed, false);
  assert.equal(classification.reason, "non_semantic_findings");
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

test("gate retry exhaustion rejects diagnostic-only issue-log evidence at the bound", () => {
  const fixture = prepareSpecRoot();
  writeFile(fixture.root, "src/example.js", "export const example = true;\n");
  const flowState = flowStateAt("spec-gate", {
    spec: fixture.specPath,
    currentTaskId: null,
    metrics: [],
  });
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
      updateStepStatus(transition) {
        updates.push({ id: transition.stepId, status: transition.requestedStatus });
      },
    },
  }, boundedResult);

  assert.equal(boundedResult.result, "fail");
  assert.deepEqual(updates, []);
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
    flowState: flowStateAt("impl-gate", {
      spec: fixture.specPath,
      metrics: retryMetrics("gateRetry", "integration"),
    }),
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
    verdict: "REJECTED",
    blockingFindings: [semanticFinding("test-semantic")],
  });
  checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: flowStateAt("test-review", {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    }),
    flowManager: fakeFlowManager([]),
  }, "test");
  const fingerprint = prepareAcceptanceEvidence(fixture);

  const deferredFindingId = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0].findingId;
  writeJson(fixture.specDir, "acceptance-review-evidence.json", {
    deferredFindingDispositions: [{
      findingId: deferredFindingId,
      finalDisposition: "fixed",
      evidenceRefs: ["test-review.json#test-semantic"],
    }],
  });
  const state = {
    spec: fixture.specPath,
    runId: "run-test",
    planRewindAt: null,
    request: "Verify the deferred demo requirement.",
  };
  const diff = [
    "diff --git a/src/demo.js b/src/demo.js",
    "--- a/src/demo.js",
    "+++ b/src/demo.js",
    "@@ -1 +1 @@",
    "-export const demo = false;",
    "+export const demo = true;",
    "",
  ].join("\n");
  const context = buildAcceptanceReviewContext({ root: fixture.root, state, diff });
  const artifact = artifactFromAcceptanceJudgments({
    context,
    requirementJudgments: [{
      requirementId: "R1",
      status: "met",
      requestRefs: ["flow.request"],
      requirementRefs: ["spec.json#R1"],
      diffRefs: ["diff:src/demo.js"],
      repairRefs: ["acceptance:no-repair"],
      testRefs: ["test-execute-result.json#R1"],
      missingEvidence: [],
    }],
  });
  assert.equal(artifact.verdict, "pass");
  assert.equal(artifact.deferredFindings[0].finalDisposition, "fixed");
  assert.equal(artifact.requirementJudgments[0].requirementId, "R1");
  assert.equal(artifact.repairFingerprint, fingerprint.hash);

  writeAcceptanceReviewArtifact({
    specDir: fixture.specDir,
    artifact,
    requirementIds: ["R1"],
    fingerprint,
  });
  const mirrored = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0];
  assert.equal(mirrored.finalDisposition, "fixed");

  fs.renameSync(path.join(fixture.specDir, "test-review.json"), path.join(fixture.specDir, "test-review.json.bak"));
  const missingContext = buildAcceptanceReviewContext({ root: fixture.root, state, diff });
  const missingSource = artifactFromAcceptanceJudgments({ context: missingContext, requirementJudgments: [] });
  assert.equal(missingSource.verdict, "blocked");
});

test("acceptance-review accepts an audited skipped scenario-validity precondition", () => {
  const fixture = prepareSpecRoot();
  prepareAcceptanceEvidence(fixture);
  const state = makeFlowState({
    spec: fixture.specPath,
    runId: "run-test",
    request: "Verify recovered implementation evidence.",
  });
  findStepById(state.steps, "scenario-validity").status = "skipped";
  const scenarioResultPath = path.join(fixture.specDir, "scenario-validity-result.json");
  const scenarioResult = JSON.parse(fs.readFileSync(scenarioResultPath, "utf8"));
  scenarioResult.result = "block";
  fs.writeFileSync(scenarioResultPath, `${JSON.stringify(scenarioResult, null, 2)}\n`);

  const context = buildAcceptanceReviewContext({
    root: fixture.root,
    state,
    diff: "",
  });

  assert.equal(
    context.mechanicalBlockers.some((blocker) => blocker.kind === "failed_tests"),
    false,
  );
});

test("acceptance-review turns a continued impl-gate failure into an explicit risk decision", () => {
  const fixture = prepareSpecRoot();
  const fingerprint = prepareAcceptanceEvidence(fixture);
  writeRepairEvidenceArtifact({
    specDir: fixture.specDir,
    stepId: "impl-gate",
    fingerprint,
    artifact: {
      verdict: "fail",
      issues: [],
      nextAction: "retro",
      level: "integration",
      phase: "integration",
      evaluations: [{
        findingId: "continued-gate-finding",
        fingerprint: SEMANTIC_FINDING_FINGERPRINT,
        result: "fail",
        category: "semantic",
        reason: "A bounded implementation gate observation remains open.",
      }],
      reasons: [],
    },
  });
  writeFlowFindingsArtifact(fixture.specDir, {
    entries: [{
      findingId: "DF-continued-gate",
      sourceStep: "impl-gate",
      sourceArtifact: "impl-gate-result.json",
      sourceFindingId: "continued-gate-finding",
      runId: "run-test",
      fingerprint: SEMANTIC_FINDING_FINGERPRINT,
      disposition: "deferred",
      rationale: "The explicit nonblocking decision retained this gate observation for acceptance.",
      retryExhausted: true,
      attempts: 1,
      round: 1,
      completionKind: "deferred",
      finalDisposition: "still_open",
    }],
  });
  const state = {
    spec: fixture.specPath,
    runId: "run-test",
    planRewindAt: null,
    request: "Verify that the continued gate risk is explicitly decided.",
  };
  const diff = [
    "diff --git a/src/demo.js b/src/demo.js",
    "--- a/src/demo.js",
    "+++ b/src/demo.js",
    "@@ -1 +1 @@",
    "-export const demo = false;",
    "+export const demo = true;",
    "",
  ].join("\n");
  const context = buildAcceptanceReviewContext({ root: fixture.root, state, diff });
  assert.equal(context.mechanicalBlockers.some((blocker) => blocker.kind === "failed_tests"), false);
  assert.equal(context.deferredFindings[0].sourceStep, "impl-gate");
  const artifact = artifactFromAcceptanceJudgments({
    context,
    requirementJudgments: [{
      requirementId: "R1",
      status: "met",
      requestRefs: ["flow.request"],
      requirementRefs: ["spec.json#R1"],
      diffRefs: ["diff:src/demo.js"],
      repairRefs: ["acceptance:no-repair"],
      testRefs: ["test-execute-result.json#R1"],
      missingEvidence: [],
    }],
    deferredFindingDispositions: [{
      findingId: "DF-continued-gate",
      finalDisposition: "still_open",
      evidenceRefs: ["impl-gate-result.json#continued-gate-finding"],
    }],
  });
  assert.equal(artifact.verdict, "user_decision_required");
  assert.equal(artifact.mechanicalBlockers.length, 0);
});

test("acceptance-review verifies a typed nonblocking handoff without reclassifying it as a mechanical pass", () => {
  const fixture = prepareSpecRoot();
  const fingerprint = prepareAcceptanceEvidence(fixture);
  writeRepairEvidenceArtifact({
    specDir: fixture.specDir,
    stepId: "test-result-review",
    fingerprint,
    artifact: {
      verdict: "fail",
      checked_items: [
        { check: "summary_evidence", result: "fail", detail: "The raw test evidence could not be verified." },
        { check: "project_regression_verification", result: "pass", detail: "verified" },
      ],
      invalid_reason: "The raw test evidence could not be verified.",
      result_file_path: "specs/demo/test-execute-result.json",
      raw_output_path: "specs/demo/tests/.raw/test-execution.log",
    },
  });
  const source = fs.readFileSync(path.join(fixture.specDir, "test-result-review.json"), "utf8");
  const state = {
    spec: fixture.specPath,
    runId: "run-test",
    planRewindAt: null,
    request: "Verify that unavailable test evidence stays an explicit acceptance risk.",
  };
  materializeNonblockingAcceptanceHandoff({
    root: fixture.root,
    flowState: state,
    sourceStep: "test-result-review",
    evidenceRef: "specs/demo/test-result-review.json",
    evidenceDigest: crypto.createHash("sha256").update(source).digest("hex"),
    resultKind: "quality",
    attempts: 1,
  });
  const context = buildAcceptanceReviewContext({
    root: fixture.root,
    state,
    diff: "diff --git a/src/demo.js b/src/demo.js\n",
  });
  assert.equal(context.mechanicalBlockers.some((blocker) => blocker.kind === "failed_tests"), false);
  assert.equal(context.evidence.deferredFindingEvidence[0].sourceRef.startsWith("nonblocking-handoffs.json#NB-"), true);
  const finding = context.deferredFindings[0];
  const artifact = artifactFromAcceptanceJudgments({
    context,
    requirementJudgments: [{
      requirementId: "R1",
      status: "met",
      requestRefs: ["flow.request"],
      requirementRefs: ["spec.json#R1"],
      diffRefs: ["diff:src/demo.js"],
      repairRefs: ["acceptance:no-repair"],
      testRefs: ["test-execute-result.json#R1"],
      missingEvidence: [],
    }],
    deferredFindingDispositions: [{
      findingId: finding.findingId,
      finalDisposition: "still_open",
      evidenceRefs: [`${finding.sourceArtifact}#${finding.sourceFindingId}`],
    }],
  });
  assert.equal(artifact.verdict, "user_decision_required");
  assert.equal(artifact.mechanicalBlockers.length, 0);

  fs.appendFileSync(path.join(fixture.specDir, "test-result-review.json"), " ");
  const staleSourceContext = buildAcceptanceReviewContext({
    root: fixture.root,
    state,
    diff: "diff --git a/src/demo.js b/src/demo.js\n",
  });
  assert.equal(
    staleSourceContext.mechanicalBlockers.some((blocker) => blocker.kind === "missing_deferred_source"),
    true,
  );
});

test("acceptance-review resolves still-open findings after mechanical source verification", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "REJECTED",
    blockingFindings: [semanticFinding("test-semantic")],
  });
  checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: flowStateAt("test-review", {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    }),
    flowManager: fakeFlowManager([]),
  }, "test");
  prepareAcceptanceEvidence(fixture);
  const state = {
    spec: fixture.specPath,
    runId: "run-test",
    planRewindAt: null,
    request: "Verify the deferred demo requirement.",
  };
  const diff = [
    "diff --git a/src/demo.js b/src/demo.js",
    "--- a/src/demo.js",
    "+++ b/src/demo.js",
    "@@ -1 +1 @@",
    "-export const demo = false;",
    "+export const demo = true;",
    "",
  ].join("\n");
  const context = buildAcceptanceReviewContext({ root: fixture.root, state, diff });
  assert.equal(
    context.mechanicalBlockers.some((blocker) => blocker.kind === "unresolved_deferred_finding"),
    false,
  );
  assert.equal(context.evidence.deferredFindingEvidence.length, 1);
  const finding = context.deferredFindings[0];
  const bound = bindAcceptanceResponse(context, {
    requirementJudgments: [{
      requirementId: "R1",
      status: "met",
      requestRefs: ["the original request"],
      requirementRefs: ["R1"],
      diffRefs: ["src/demo.js"],
      repairRefs: ["no repair"],
      testRefs: ["specs/demo/tests/retry-exhaustion.test.js"],
      missingEvidence: [],
    }],
    deferredFindingDispositions: [{
      findingId: finding.findingId,
      finalDisposition: "fixed",
      evidenceRefs: ["source finding"],
    }],
  });
  assert.deepEqual(bound.requirementJudgments[0].requestRefs, ["flow.request"]);
  assert.deepEqual(bound.requirementJudgments[0].requirementRefs, ["spec.json#R1"]);
  assert.deepEqual(bound.requirementJudgments[0].repairRefs, ["acceptance:no-repair"]);
  assert.deepEqual(bound.requirementJudgments[0].diffRefs, [
    "diff:src/demo.js",
  ]);
  assert.deepEqual(bound.requirementJudgments[0].testRefs, [
    "test-execute-result.json#R1",
    "test-result-review.json",
  ]);
  assert.equal(
    bound.deferredFindingDispositions[0].evidenceRefs[0],
    `${finding.sourceArtifact}#${finding.sourceFindingId}`,
  );
  const artifact = artifactFromAcceptanceJudgments({
    context,
    requirementJudgments: bound.requirementJudgments,
    deferredFindingDispositions: bound.deferredFindingDispositions,
  });
  assert.equal(artifact.verdict, "pass");
  assert.equal(artifact.deferredFindings[0].finalDisposition, "fixed");
  assert.deepEqual(artifact.hardBlockers, []);
});

test("acceptance-review preserves the invalid artifact validation detail", () => {
  const fixture = prepareSpecRoot();
  prepareAcceptanceEvidence(fixture);
  const reviewPath = path.join(fixture.specDir, "impl-review.json");
  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  review.summary.nonBlocking += 1;
  fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);

  const context = buildAcceptanceReviewContext({
    root: fixture.root,
    state: makeFlowState({
      spec: fixture.specPath,
      request: "Verify the persisted acceptance evidence.",
    }),
    diff: "diff --git a/src/demo.js b/src/demo.js\n",
  });
  const blocker = context.mechanicalBlockers.find((entry) => (
    entry.kind === "invalid_schema" && entry.summary === "Required artifact is invalid: impl-review.json."
  ));
  assert.equal(blocker.detail, "impl-review non-blocking summary is inconsistent");
});

test("unresolved deferred findings route to acceptance decision without masking mechanical blockers", () => {
  const unresolved = {
    hardBlockers: [{ findingId: "deferred-1", kind: "unresolved_deferred_finding" }],
    requirementJudgments: [{ requirementId: "R1", status: "met" }],
  };

  assert.equal(deriveAcceptanceReviewVerdict({
    ...unresolved,
    mechanicalBlockers: [],
  }), "user_decision_required");
  assert.equal(deriveAcceptanceReviewVerdict({
    ...unresolved,
    mechanicalBlockers: [{ blockerId: "M-1", kind: "missing_artifact" }],
  }), "blocked");
});

test("acceptance-review deduplicates flow findings and review handoffs by fingerprint", () => {
  const fixture = prepareSpecRoot();
  const fingerprint = prepareAcceptanceEvidence(fixture);
  const duplicateFinding = {
    findingId: "task-duplicate",
    summary: "Deferred task review finding",
    fingerprint: SEMANTIC_FINDING_FINGERPRINT,
    evidenceRefs: ["impl-review.json#task-duplicate"],
  };
  const uniqueFinding = {
    findingId: "task-unique",
    summary: "Distinct task review finding",
    fingerprint: "b".repeat(64),
    evidenceRefs: ["impl-review.json#task-unique"],
  };
  const evidence = new ReviewEvidence({
    phase: "impl",
    taskId: "T-1",
    treeSha: "1".repeat(40),
    provenance: {
      provider: "fixture-provider",
      invocationId: "acceptance-deferred-dedup",
      capturedAt: "2026-07-24T00:00:00.000Z",
    },
    disposition: new ReviewDisposition({
      value: "REJECTED",
      blockingFindings: [duplicateFinding, uniqueFinding],
    }),
  });
  const canonicalEvidenceRef = `review-evidence/${evidence.identity.evidenceDigest}.json`;
  writeFile(fixture.specDir, canonicalEvidenceRef, evidence.canonicalText);
  const state = {
    spec: fixture.specPath,
    runId: "run-test",
    planRewindAt: null,
    request: "Verify canonical deferred-finding deduplication.",
  };
  applyReviewEvidenceTransition(state, evidence, { configuredSemanticMaxAttempts: 4 });
  writeFlowFindingsArtifact(fixture.specDir, {
    entries: [{
      findingId: "DF-1",
      sourceStep: "task-review",
      sourceArtifact: "impl-review.json",
      sourceFindingId: duplicateFinding.findingId,
      runId: state.runId,
      fingerprint: duplicateFinding.fingerprint,
      disposition: "deferred",
      rationale: "The task review finding reached its semantic retry bound.",
      retryExhausted: true,
      attempts: 4,
      round: 4,
      completionKind: "deferred",
      finalDisposition: "still_open",
    }],
  });
  const diff = [
    "diff --git a/src/demo.js b/src/demo.js",
    "--- a/src/demo.js",
    "+++ b/src/demo.js",
    "@@ -1 +1 @@",
    "-export const demo = false;",
    "+export const demo = true;",
    "",
  ].join("\n");
  const context = buildAcceptanceReviewContext({ root: fixture.root, state, diff });
  const uniqueHandoffId = `RF-${evidence.identity.evidenceDigest.slice(0, 12)}-${uniqueFinding.findingId}`;
  assert.deepEqual(
    context.deferredFindings.map((finding) => finding.findingId),
    ["DF-1", uniqueHandoffId],
  );
  assert.equal(context.deferredFindings[0].sourceArtifact, canonicalEvidenceRef);
  assert.equal(context.mechanicalBlockers.length, 0);
  const artifact = artifactFromAcceptanceJudgments({
    context,
    requirementJudgments: [{
      requirementId: "R1",
      status: "met",
      requestRefs: ["flow.request"],
      requirementRefs: ["spec.json#R1"],
      diffRefs: ["diff:src/demo.js"],
      repairRefs: ["acceptance:no-repair"],
      testRefs: ["test-execute-result.json#R1"],
      missingEvidence: [],
    }],
    deferredFindingDispositions: context.deferredFindings.map((finding) => ({
      findingId: finding.findingId,
      finalDisposition: "fixed",
      evidenceRefs: [`${finding.sourceArtifact}#${finding.sourceFindingId}`],
    })),
  });

  writeAcceptanceReviewArtifact({
    specDir: fixture.specDir,
    artifact,
    requirementIds: ["R1"],
    fingerprint,
    flowState: state,
  });
  assert.equal(artifact.deferredFindings.length, 2);
});

test("acceptance-review resolves deferred findings from superseded canonical review evidence", () => {
  const fixture = prepareSpecRoot();
  prepareAcceptanceEvidence(fixture);
  const deferredFinding = {
    findingId: "historical-deferred",
    summary: "Deferred historical review finding",
    fingerprint: "c".repeat(64),
    evidenceRefs: ["impl-review.json#historical-deferred"],
  };
  const rejectedEvidence = new ReviewEvidence({
    phase: "impl",
    taskId: null,
    treeSha: "2".repeat(40),
    provenance: {
      provider: "fixture-provider",
      invocationId: "historical-review",
      capturedAt: "2026-07-24T00:00:00.000Z",
    },
    disposition: new ReviewDisposition({
      value: "REJECTED",
      blockingFindings: [deferredFinding],
    }),
  });
  const advisoryEvidence = new ReviewEvidence({
    phase: "impl",
    taskId: null,
    treeSha: "3".repeat(40),
    provenance: {
      provider: "fixture-provider",
      invocationId: "replacement-review",
      capturedAt: "2026-07-24T00:01:00.000Z",
    },
    disposition: new ReviewDisposition({
      value: "PASS",
    }),
  });
  const historicalEvidenceRef = `review-evidence/${rejectedEvidence.identity.evidenceDigest}.json`;
  writeFile(fixture.specDir, historicalEvidenceRef, rejectedEvidence.canonicalText);
  writeFile(
    fixture.specDir,
    `review-evidence/${advisoryEvidence.identity.evidenceDigest}.json`,
    advisoryEvidence.canonicalText,
  );
  const state = {
    spec: fixture.specPath,
    runId: "run-test",
    planRewindAt: null,
    request: "Verify deferred findings survive a later implementation review.",
  };
  applyReviewEvidenceTransition(state, rejectedEvidence, { configuredSemanticMaxAttempts: 4 });
  applyReviewEvidenceTransition(state, advisoryEvidence, { configuredSemanticMaxAttempts: 4 });
  writeFlowFindingsArtifact(fixture.specDir, {
    entries: [{
      findingId: "DF-1",
      sourceStep: "impl-review",
      sourceArtifact: "impl-review.json",
      sourceFindingId: deferredFinding.findingId,
      runId: state.runId,
      fingerprint: deferredFinding.fingerprint,
      disposition: "deferred",
      rationale: "The original review was deferred after retry exhaustion.",
      retryExhausted: true,
      attempts: 4,
      round: 4,
      completionKind: "deferred",
      finalDisposition: "still_open",
    }],
  });
  const diff = [
    "diff --git a/src/demo.js b/src/demo.js",
    "--- a/src/demo.js",
    "+++ b/src/demo.js",
    "@@ -1 +1 @@",
    "-export const demo = false;",
    "+export const demo = true;",
    "",
  ].join("\n");

  const context = buildAcceptanceReviewContext({ root: fixture.root, state, diff });

  assert.equal(context.mechanicalBlockers.length, 0);
  assert.equal(context.deferredFindings.length, 1);
  assert.equal(context.deferredFindings[0].sourceArtifact, historicalEvidenceRef);
  assert.deepEqual(context.evidence.deferredFindingEvidence, [{
    findingId: "DF-1",
    sourceRef: `${historicalEvidenceRef}#${deferredFinding.findingId}`,
    sourceFinding: deferredFinding,
  }]);
});

test("acceptance-review rewinds stale fingerprint evidence to test execution", () => {
  const fixture = prepareSpecRoot();
  const previousFingerprint = prepareAcceptanceEvidence(fixture);
  writeFile(fixture.root, "src/demo.js", "export const demo = 'acceptance-repaired';\n");
  const state = flowStateAt("acceptance-review", {
    spec: fixture.specPath,
    repairBaseline: previousFingerprint.baseline.toJSON(),
    request: "Verify repaired acceptance behavior.",
  });
  const flowManager = new FlowManager({
    root: fixture.root,
    mainRoot: fixture.root,
    inWorktree: false,
  });
  flowManager.create(state);
  const activeState = flowManager.loadReadOnly();
  const context = buildAcceptanceReviewContext({
    root: fixture.root,
    state: activeState,
    diff: [
      "diff --git a/src/demo.js b/src/demo.js",
      "--- a/src/demo.js",
      "+++ b/src/demo.js",
      "@@ -1 +1 @@",
      "-export const demo = false;",
      "+export const demo = 'acceptance-repaired';",
      "",
    ].join("\n"),
  });
  const artifact = artifactFromAcceptanceJudgments({
    context,
    requirementJudgments: [],
  });
  assert.equal(artifact.verdict, "blocked");
  assert.notEqual(artifact.repairFingerprint, previousFingerprint.hash);

  const result = applyAcceptanceReviewResult({
    root: fixture.root,
    flowManager,
    artifact,
    evidenceRefresh: context.evidenceRefresh,
  });
  const recoveredState = flowManager.loadReadOnly();

  assert.equal(result.evidenceRefresh.recovered, true);
  assert.equal(findStepById(recoveredState.steps, "test-execute").status, "in_progress");
  assert.equal(findStepById(recoveredState.steps, "acceptance-review").status, "pending");
  for (const relativePath of [
    "test-execute-result.json",
    "test-result-review.json",
    "impl-review.json",
    "impl-gate-result.json",
    "retro.json",
    "acceptance-review.json",
  ]) {
    assert.equal(fs.existsSync(path.join(fixture.specDir, relativePath)), false, relativePath);
  }
  assert.equal(fs.existsSync(path.join(fixture.specDir, "scenario-validity-result.json")), true);
});

test("acceptance-review recognizes rejected latest triage after an earlier repair", () => {
  const fixture = prepareSpecRoot();
  const previousFingerprint = prepareAcceptanceEvidence(fixture);
  const finding = semanticFinding("latest-rejected-finding");
  writeRepairEvidenceArtifact({
    specDir: fixture.specDir,
    stepId: "impl-review",
    fingerprint: previousFingerprint,
    artifact: {
      version: 1,
      phase: "impl",
      generatedAt: new Date().toISOString(),
      verdict: "REJECTED",
      summary: { blocking: 1, nonBlocking: 0, total: 1 },
      blockingFindings: [finding],
      nonBlockingImprovements: [],
      excluded: { missingFile: 0, outOfScope: 0 },
    },
  });
  writeJson(fixture.specDir, "impl-triage.json", {
    version: 2,
    phase: "impl-triage",
    sourceStep: "impl-review",
    sourceArtifact: "impl-review.json",
    previousFingerprint: previousFingerprint.toReference(),
    generatedAt: new Date().toISOString(),
    items: [{
      findingId: finding.findingId,
      sourceStep: "impl-review",
      decision: "reject",
      rationale: "The approved specification requires the implemented behavior.",
      evidenceRefs: [`impl-review.json#${finding.findingId}`],
    }],
  });
  writeJson(fixture.specDir, "impl-repair.json", {});

  writeFile(fixture.root, "src/demo.js", "export const demo = 'post-repair';\n");
  const currentFingerprint = buildRepairFingerprint({
    root: fixture.root,
    specPath: fixture.specPath,
  });
  const testExecute = JSON.parse(fs.readFileSync(
    path.join(fixture.specDir, "test-execute-result.json"),
    "utf8",
  ));
  writeRepairEvidenceArtifact({
    specDir: fixture.specDir,
    stepId: "test-execute",
    fingerprint: currentFingerprint,
    artifact: testExecute,
  });

  const context = buildAcceptanceReviewContext({
    root: fixture.root,
    state: {
      spec: fixture.specPath,
      runId: "run-test",
      planRewindAt: null,
      request: "Verify the latest rejected triage.",
    },
    diff: [
      "diff --git a/src/demo.js b/src/demo.js",
      "--- a/src/demo.js",
      "+++ b/src/demo.js",
      "@@ -1 +1 @@",
      "-export const demo = true;",
      "+export const demo = 'post-repair';",
      "",
    ].join("\n"),
  });

  assert.equal(
    context.mechanicalBlockers.some((blocker) => blocker.kind === "failed_tests"),
    false,
  );
  assert.equal(
    context.mechanicalBlockers.some((blocker) => (
      blocker.summary === "Required artifact is invalid: impl-repair.json."
    )),
    true,
  );
});

test("rejected impl-review lookup ignores triage owned by another source step", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "impl-triage.json", {
    version: 2,
    phase: "impl-triage",
    sourceStep: "acceptance-review",
    sourceArtifact: "missing-acceptance-review.json",
  });

  assert.equal(readRejectedImplReviewTriage(fixture.specDir), null);
});

test("integration gate rewinds stale fingerprint evidence before semantic evaluation", () => {
  const fixture = prepareSpecRoot();
  initGitRepo(fixture.root);
  writeJson(fixture.specDir, "file-map.json", { R1: ["src/demo.js"] });
  commitAll(fixture.root, "Create repository fixture");
  const previousFingerprint = prepareAcceptanceEvidence(fixture);
  commitAll(fixture.root, "Create integration gate fixture");
  const repairedSource = "export const demo = 'gate-repaired';\n";
  writeFile(fixture.root, "src/demo.js", repairedSource);
  const testResultPath = path.join(fixture.specDir, "test-execute-result.json");
  const testResult = JSON.parse(fs.readFileSync(testResultPath, "utf8"));
  const changedFile = {
    status: "modified",
    path: "src/demo.js",
    fingerprint: crypto.createHash("sha256").update(repairedSource).digest("hex"),
  };
  testResult.regression = {
    required: false,
    result: "skipped",
    mode: "none",
    category: "full-regression-deferred",
    reason: "full project regression deferred to final-regression",
    classified_paths: [{ path: "src/demo.js", category: "full-regression-deferred" }],
    changed_files: [changedFile],
    trigger_relevant_changed_files: [changedFile],
  };
  testResult.summary[0].result = "fail";
  testResult.summary[0].error = "stale failure fixed by the current implementation";
  fs.writeFileSync(testResultPath, `${JSON.stringify(testResult, null, 2)}\n`);
  const state = flowStateAt("impl-gate", {
    spec: fixture.specPath,
    repairBaseline: previousFingerprint.baseline.toJSON(),
    request: "Verify repaired integration gate behavior.",
  });
  const flowManager = new FlowManager({
    root: fixture.root,
    mainRoot: fixture.root,
    inWorktree: false,
  });
  flowManager.create(state);
  const activeState = flowManager.loadReadOnly();
  const staleEvidence = checkIntegrationTestArtifacts(
    fixture.root,
    activeState,
    "integration",
    "integration",
  );
  assert.equal(typeof staleEvidence?.recover, "function", JSON.stringify(staleEvidence));
  const ctx = { flowManager };
  const result = staleEvidence.recover(ctx, {
    level: "integration",
    phase: "integration",
    specDir: fixture.specDir,
  });
  const recoveredState = flowManager.loadReadOnly();

  assert.equal(ctx.gateEvidenceRefresh, true);
  assert.equal(result.result, "recovered");
  assert.equal(result.next, "test-execute");
  assert.equal(findStepById(recoveredState.steps, "test-execute").status, "in_progress");
  assert.equal(findStepById(recoveredState.steps, "impl-gate").status, "pending");
  assert.equal(fs.existsSync(path.join(fixture.specDir, "test-execute-result.json")), false);
  assert.equal(fs.existsSync(path.join(fixture.specDir, "test-result-review.json")), false);
});

test("acceptance-review repairs only omitted deferred disposition coverage", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "REJECTED",
    blockingFindings: [semanticFinding("test-semantic")],
  });
  checkReviewRetryBelowMax({
    root: fixture.root,
    flowState: flowStateAt("test-review", {
      spec: fixture.specPath,
      metrics: retryMetrics("reviewRetry", "test"),
    }),
    flowManager: fakeFlowManager([]),
  }, "test");
  prepareAcceptanceEvidence(fixture);
  const context = buildAcceptanceReviewContext({
    root: fixture.root,
    state: {
      spec: fixture.specPath,
      runId: "run-test",
      planRewindAt: null,
      request: "Verify the deferred demo requirement.",
    },
    diff: "diff --git a/src/demo.js b/src/demo.js\n+export const demo = true;\n",
  });
  const coverage = new DeferredDispositionCoverage(context, []);
  const [missing] = coverage.missingFindings;
  const prompt = buildDeferredDispositionRepairPrompt(context, [missing]);
  assert.match(prompt.userPrompt, new RegExp(missing.findingId));
  assert.equal(prompt.jsonSchema.properties.deferredFindingDispositions.minItems, 1);
  assert.equal(prompt.jsonSchema.properties.deferredFindingDispositions.maxItems, 1);

  const sourceRef = `${missing.sourceArtifact}#${missing.sourceFindingId}`;
  const bound = new AcceptanceResponseBinding(context).bindDeferredFindingDispositions([{
    findingId: missing.findingId,
    finalDisposition: "fixed",
    evidenceRefs: ["invented-label"],
  }]);
  coverage.add(bound);
  assert.deepEqual(coverage.requireComplete(), [{
    findingId: missing.findingId,
    finalDisposition: "fixed",
    evidenceRefs: [sourceRef],
  }]);
});

test("canonical typed impl review evidence supersedes only the phase artifact fingerprint", () => {
  const fixture = prepareSpecRoot();
  const oldFingerprint = prepareAcceptanceEvidence(fixture);
  writeFile(fixture.root, "src/demo.js", "export const demo = 'repaired';\n");
  const currentFingerprint = prepareAcceptanceEvidence(fixture);
  assert.notEqual(currentFingerprint.hash, oldFingerprint.hash);

  const phaseArtifactPath = path.join(fixture.specDir, "impl-review.json");
  const phaseArtifact = JSON.parse(fs.readFileSync(phaseArtifactPath, "utf8"));
  phaseArtifact.repairFingerprint = oldFingerprint.hash;
  fs.writeFileSync(phaseArtifactPath, JSON.stringify(phaseArtifact, null, 2) + "\n");

  const evidence = new ReviewEvidence({
    phase: "impl",
    taskId: null,
    treeSha: "1".repeat(40),
    provenance: {
      provider: "fixture-provider",
      invocationId: "acceptance-typed-evidence",
      capturedAt: "2026-07-22T00:00:00.000Z",
    },
    disposition: new ReviewDisposition({ value: "PASS" }),
  });
  writeFile(
    fixture.specDir,
    `review-evidence/${evidence.identity.evidenceDigest}.json`,
    evidence.canonicalText,
  );
  const state = {
    spec: fixture.specPath,
    runId: "run-test",
    planRewindAt: null,
    request: "Verify typed review evidence.",
  };
  applyReviewEvidenceTransition(state, evidence, { configuredSemanticMaxAttempts: 4 });
  const diff = [
    "diff --git a/src/demo.js b/src/demo.js",
    "--- a/src/demo.js",
    "+++ b/src/demo.js",
    "@@ -1 +1 @@",
    "-export const demo = false;",
    "+export const demo = 'repaired';",
    "",
  ].join("\n");
  const context = buildAcceptanceReviewContext({ root: fixture.root, state, diff });
  assert.equal(context.fingerprint.hash, currentFingerprint.hash);
  assert.equal(context.evidence.reviewEvidence.disposition, "PASS");
  assert.equal(
    context.mechanicalBlockers.some((blocker) => (
      blocker.kind === "invalid_schema" && blocker.summary.includes("impl-review.json")
    )),
    false,
  );
});
