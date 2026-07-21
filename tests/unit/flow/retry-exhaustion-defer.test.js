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
  artifactFromAcceptanceJudgments,
  buildAcceptanceReviewContext,
  writeAcceptanceReviewArtifact,
} from "../../../src/flow/lib/acceptance-review-artifacts.js";
import {
  buildRepairFingerprint,
  writeRepairEvidenceArtifact,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import { readFlowFindingsArtifact } from "../../../src/flow/lib/flow-findings.js";
import {
  makeDefaultTask,
  makeFlowState,
  moveFlowToStep,
} from "../../helpers/flow-setup.js";
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
    verdict: "FAIL",
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
        assert.equal(fs.existsSync(flowFindingsPath), false, "deferred artifact starts after the step commit");
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
      verdict: "FAIL",
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
    verdict: "FAIL",
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
    verdict: "FAIL",
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
        assert.equal(fs.existsSync(flowFindingsPath), false, "deferred artifact starts after the step commit");
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
    verdict: "FAIL",
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
