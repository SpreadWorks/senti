// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  createAcceptanceReviewFixture,
  runAcceptanceReviewFixture,
} from "../../../tests/helpers/acceptance-review-fixture.js";
import {
  FlowFinding,
  buildDeferredFindingsSummary,
  readFlowFindingsArtifact,
} from "../../../src/flow/lib/flow-findings.js";
import {
  checkReviewRetryBelowMax,
  updateReviewRetryCounter,
} from "../../../src/flow/lib/run-review.js";
import {
  checkRetryBelowMax as checkGateRetryBelowMax,
  classifyGateRetryExhaustionSource,
} from "../../../src/flow/lib/run-gate.js";
import { makeFlowState, moveFlowToStep } from "../../../tests/helpers/flow-setup.js";

const RETRY_FINGERPRINT = "c".repeat(64);

function withFixture(options, callback) {
  const fixture = createAcceptanceReviewFixture(options);
  try {
    return callback(fixture);
  } finally {
    fixture.cleanup();
  }
}

function deferredFinding(id, sourceStep = "test-review") {
  return {
    findingId: id,
    sourceStep,
    sourceArtifact: `${sourceStep}.json`,
    sourceFindingId: `${id}-source`,
  };
}

function retryMetrics(counter, phase, count = 10) {
  return Array.from({ length: count }, () => ({ phase, counter, delta: 1 }));
}

function retryFlowState(fixture, stepId, metrics) {
  return moveFlowToStep(makeFlowState({
    spec: fixture.specPath,
    runId: fixture.state.runId,
    baseBranch: "main",
    featureBranch: "feature/acceptance-fixture",
    metrics,
  }), stepId);
}

function semanticRetryFinding(id, disposition = "must-fix") {
  return {
    findingId: id,
    fingerprint: RETRY_FINGERPRINT,
    disposition,
    failureMode: "missing_acceptance_requirement",
    category: "semantic",
    title: "Missing acceptance behavior",
    reason: "The current flow must retain this semantic finding.",
    rationale: "The migration must preserve the bounded retry disposition.",
  };
}

function writeRetrySource(specDir, file, artifact) {
  fs.writeFileSync(path.join(specDir, file), JSON.stringify(artifact, null, 2) + "\n");
}

test("R1: deferred review findings are stored in the current v2 artifact", () => {
  withFixture({ deferredFindings: [deferredFinding("DF-1")] }, (fixture) => {
    const artifact = readFlowFindingsArtifact(fixture.specDir);
    assert.equal(artifact.version, 2);
    assert.equal(artifact.entries[0].disposition, "deferred");
    assert.equal(artifact.entries[0].runId, fixture.state.runId);
  });
});

test("R2: deferred findings retain bounded source references", () => {
  withFixture({ deferredFindings: [deferredFinding("DF-1", "spec-review")] }, (fixture) => {
    const finding = readFlowFindingsArtifact(fixture.specDir).entries[0];
    assert.equal(finding.sourceArtifact, "spec-review.json");
    assert.equal(finding.sourceFindingId, "DF-1-source");
    assert.equal(path.isAbsolute(finding.sourceArtifact), false);
  });
});

test("R3: malformed flow findings are rejected at the schema boundary", () => {
  assert.throws(() => new FlowFinding({
    findingId: "DF-invalid",
    sourceStep: "test-review",
    sourceArtifact: "../outside.json",
    sourceFindingId: "invalid",
    fingerprint: "a".repeat(64),
    disposition: "deferred",
    rationale: "The source must remain inside the spec directory.",
    retryExhausted: true,
    attempts: 1,
    round: 1,
    completionKind: "deferred",
    finalDisposition: null,
  }), /sourceArtifact/);
});

test("R3: current review retry exhaustion writes a deferred finding through the production policy", () => {
  withFixture({}, (fixture) => {
    fs.writeFileSync(path.join(fixture.specDir, "test-review.json"), JSON.stringify({
      verdict: "REJECTED",
      blockingFindings: [semanticRetryFinding("review-semantic")],
    }, null, 2) + "\n");
    const updates = [];
    const result = checkReviewRetryBelowMax({
      root: fixture.root,
      flowState: retryFlowState(fixture, "test-review", retryMetrics("reviewRetry", "test")),
      flowManager: {
        updateStepStatus(transition) {
          updates.push({ id: transition.stepId, status: transition.requestedStatus });
        },
      },
    }, "test");
    assert.equal(result?.result, "deferred");
    assert.deepEqual(updates, [{ id: "test-review", status: "done" }]);
    const [finding] = readFlowFindingsArtifact(fixture.specDir).entries;
    assert.equal(finding.sourceStep, "test-review");
    assert.equal(finding.sourceArtifact, "test-review.json");
    assert.equal(finding.sourceFindingId, "review-semantic");
    assert.equal(finding.disposition, "deferred");
  });
});

test("R3: current gate retry exhaustion writes a deferred finding through the production policy", () => {
  withFixture({}, (fixture) => {
    fs.writeFileSync(path.join(fixture.specDir, "impl-gate-result.json"), JSON.stringify({
      runId: fixture.state.runId,
      planRewindAt: null,
      phase: "integration",
      result: "fail",
      evaluations: [{
        findingId: "gate-semantic",
        fingerprint: RETRY_FINGERPRINT,
        disposition: "informational",
        result: "fail",
        category: "semantic",
        reason: "The current gate must retain this semantic finding.",
        rationale: "The migration must preserve the bounded retry disposition.",
      }],
    }, null, 2) + "\n");
    const updates = [];
    const result = checkGateRetryBelowMax({
      root: fixture.root,
      flowState: retryFlowState(fixture, "impl-gate", retryMetrics("gateRetry", "integration")),
      flowManager: {
        updateStepStatus(transition) {
          updates.push({ id: transition.stepId, status: transition.requestedStatus });
        },
      },
    }, "integration");
    assert.equal(result?.result, "deferred");
    assert.deepEqual(updates, [{ id: "impl-gate", status: "done" }]);
    const [finding] = readFlowFindingsArtifact(fixture.specDir).entries;
    assert.equal(finding.sourceStep, "impl-gate");
    assert.equal(finding.sourceArtifact, "impl-gate-result.json");
    assert.equal(finding.sourceFindingId, "gate-semantic");
  });
});

test("R3: every review and gate retry surface preserves a current deferred source record", () => {
  const reviewCases = [
    { phase: "draft", metricPhase: "draft-questions", stepId: "draft-questions-review", file: "draft-review-questions.json", findingsKey: "findings" },
    { phase: "spec", metricPhase: "spec", stepId: "spec-review", file: "spec-review.json", findingsKey: "blocking" },
    { phase: "test", metricPhase: "test", stepId: "test-review", file: "test-review.json", findingsKey: "blockingFindings" },
    { phase: null, metricPhase: "impl", stepId: "impl-review", file: "impl-review.json", findingsKey: "blockingFindings" },
  ];
  for (const item of reviewCases) {
    withFixture({}, (fixture) => {
      writeRetrySource(fixture.specDir, item.file, {
        verdict: "REJECTED",
        [item.findingsKey]: [semanticRetryFinding(`review-${item.metricPhase}`)],
      });
      const result = checkReviewRetryBelowMax({
        root: fixture.root,
        flowState: retryFlowState(
          fixture,
          item.stepId,
          retryMetrics("reviewRetry", item.metricPhase),
        ),
        flowManager: { updateStepStatus() {} },
      }, item.phase);
      assert.equal(result?.result, "deferred", item.metricPhase);
      const [finding] = readFlowFindingsArtifact(fixture.specDir).entries;
      assert.equal(finding.sourceStep, item.stepId, item.metricPhase);
      assert.equal(finding.sourceArtifact, item.file, item.metricPhase);
    });
  }

  const gateCases = [
    { phase: "draft", stepId: "draft-gate", file: "draft-gate-source.json" },
    { phase: "spec", stepId: "spec-gate", file: "spec-gate-source.json" },
    { phase: "task-impl", stepId: "impl-gate", file: "task-impl-gate-source.json" },
    { phase: "integration", stepId: "impl-gate", file: "impl-gate-result.json" },
  ];
  for (const item of gateCases) {
    withFixture({}, (fixture) => {
      writeRetrySource(fixture.specDir, item.file, {
        runId: fixture.state.runId,
        planRewindAt: null,
        phase: item.phase,
        result: "fail",
        evaluations: [{
          ...semanticRetryFinding(`gate-${item.phase}`, "informational"),
          result: "fail",
        }],
      });
      const result = checkGateRetryBelowMax({
        root: fixture.root,
        flowState: retryFlowState(
          fixture,
          item.stepId,
          retryMetrics("gateRetry", item.phase),
        ),
        flowManager: { updateStepStatus() {} },
      }, item.phase);
      assert.equal(result?.result, "deferred", item.phase);
      const [finding] = readFlowFindingsArtifact(fixture.specDir).entries;
      assert.equal(finding.sourceArtifact, item.file, item.phase);
    });
  }
});

test("R3: semantic wording does not turn a gate finding into a mechanical blocker", () => {
  const classification = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "task-impl",
      result: "fail",
      observations: [{
        ...semanticRetryFinding("wording-semantic", "informational"),
        result: "fail",
        severity: "blocking",
        failureMode: "requirement_alignment",
        observed: "The implementation is missing a test-facing command behavior required by the spec.",
      }],
    },
  });
  assert.equal(classification.deferAllowed, true);
  assert.equal(classification.reason, "semantic_findings");
});

test("R3: every structured non-semantic retry precheck remains non-deferrable", () => {
  const cases = [
    [{ toolingFailure: "parser_error" }, "tooling_failure"],
    [{ command: { exitCode: 1 } }, "failed_command"],
    [{ sourceArtifactStatus: "invalid_schema" }, "invalid_schema"],
    [{ testEvidence: { result: "fail" } }, "failed_test_evidence"],
    [{ guardCode: "NO_PROGRESS_SINCE_LAST_FAIL" }, "no_progress_guard"],
    [{ flowStateValid: false }, "flow_corruption"],
    [{ malformedArtifact: true }, "malformed_artifact"],
    [{ coverage: { validation: { ok: false } } }, "coverage_header_failure"],
  ];
  for (const [sourceArtifact, reason] of cases) {
    const classification = classifyGateRetryExhaustionSource({
      sourceArtifact: { phase: "test", result: "fail", ...sourceArtifact },
    });
    assert.equal(classification.deferAllowed, false, reason);
    assert.equal(classification.reason, reason);
  }
});

test("R3: review post-hook consumes the final retry slot before deferring", () => {
  withFixture({}, (fixture) => {
    const updates = [];
    const flowState = retryFlowState(fixture, "test-review", retryMetrics("reviewRetry", "test", 4));
    const flowManager = {
      appendMetric(entry) {
        flowState.metrics.push(entry);
      },
      updateStepStatus(transition) {
        updates.push({ id: transition.stepId, status: transition.requestedStatus });
      },
    };
    const context = { root: fixture.root, flowState, flowManager };
    assert.equal(checkReviewRetryBelowMax(context, "test"), null);
    fs.writeFileSync(path.join(fixture.specDir, "test-review.json"), JSON.stringify({
      verdict: "REJECTED",
      blockingFindings: [semanticRetryFinding("post-hook-semantic")],
    }, null, 2) + "\n");
    const result = { artifacts: { phase: "test", retryPhase: "test", verdict: "REJECTED" } };
    updateReviewRetryCounter(context, result);
    assert.equal(flowState.metrics.length, 5);
    assert.equal(result.result, "deferred");
    assert.deepEqual(updates, [{ id: "test-review", status: "done" }]);
    assert.equal(readFlowFindingsArtifact(fixture.specDir).entries[0].sourceFindingId, "post-hook-semantic");
  });
});

test("R4: unresolved deferred findings require an acceptance decision", () => {
  withFixture({ deferredFindings: [deferredFinding("DF-1")] }, (fixture) => {
    const stillOpen = runAcceptanceReviewFixture({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
      requirementJudgments: fixture.requirementJudgments,
      deferredFindingDispositions: fixture.dispositionJudgments("still_open"),
    });
    assert.equal(stillOpen.artifact.verdict, "user_decision_required");
    assert.equal(stillOpen.artifact.hardBlockers[0].kind, "unresolved_deferred_finding");
  });
});

test("R5: fixed deferred findings do not block acceptance", () => {
  withFixture({ deferredFindings: [deferredFinding("DF-1")] }, (fixture) => {
    const fixed = runAcceptanceReviewFixture({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
      requirementJudgments: fixture.requirementJudgments,
      deferredFindingDispositions: fixture.dispositionJudgments("fixed"),
    });
    assert.equal(fixed.artifact.verdict, "pass");
    assert.equal(fixed.artifact.deferredFindings[0].finalDisposition, "fixed");
  });
});

test("R6: deferred finding summaries are observational rather than routing data", () => {
  withFixture({ deferredFindings: [deferredFinding("DF-1", "spec-review"), deferredFinding("DF-2", "impl-gate")] }, (fixture) => {
    const summary = buildDeferredFindingsSummary({ specDir: fixture.specDir });
    assert.deepEqual(summary.sourceSteps, ["spec-review", "impl-gate"]);
    assert.equal(Object.hasOwn(summary, "nextAction"), false);
    assert.equal(Object.hasOwn(summary, "targetStep"), false);
  });
});

test("R7: acceptance persistence writes the current artifact, mirrors final disposition, and preserves source identity", () => {
  withFixture({ deferredFindings: [deferredFinding("DF-1")] }, (fixture) => {
    const before = readFlowFindingsArtifact(fixture.specDir).entries[0];
    const { artifact, written, applied } = runAcceptanceReviewFixture({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
      requirementJudgments: fixture.requirementJudgments,
      deferredFindingDispositions: fixture.dispositionJudgments("fixed"),
      persist: true,
      apply: true,
      flowManager: fixture.flowManager,
    });
    const after = readFlowFindingsArtifact(fixture.specDir).entries[0];
    assert.equal(JSON.parse(fs.readFileSync(written.path, "utf8")).verdict, "pass");
    assert.equal(artifact.deferredFindings[0].finalDisposition, "fixed");
    assert.equal(applied.verdict, "pass");
    assert.equal(fixture.activeStep(), "final-regression");
    assert.equal(after.finalDisposition, "fixed");
    assert.equal(after.fingerprint, before.fingerprint);
    assert.equal(after.sourceArtifact, before.sourceArtifact);
  });
});

test("R8: deferred source evidence remains available to acceptance review", () => {
  withFixture({ deferredFindings: [deferredFinding("DF-1", "impl-review")] }, (fixture) => {
    assert.equal(fs.existsSync(path.join(fixture.specDir, "impl-review.json")), true);
    const { artifact } = runAcceptanceReviewFixture({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
      requirementJudgments: fixture.requirementJudgments,
      deferredFindingDispositions: fixture.dispositionJudgments("not_needed"),
    });
    assert.equal(artifact.deferredFindings[0].sourceArtifact, "impl-review.json");
  });
});

test("R8: missing current mechanical evidence blocks acceptance", () => {
  withFixture({ omitArtifacts: ["test-execute-result.json"] }, (fixture) => {
    const missingSource = runAcceptanceReviewFixture({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
      requirementJudgments: fixture.requirementJudgments,
    });
    assert.equal(missingSource.artifact.verdict, "blocked");
  });
});

test("R8: missing deferred source evidence blocks the current acceptance artifact", () => {
  withFixture({ deferredFindings: [deferredFinding("DF-source", "test-review")] }, (fixture) => {
    fs.unlinkSync(path.join(fixture.specDir, "test-review.json"));
    const missingSource = runAcceptanceReviewFixture({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
      requirementJudgments: fixture.requirementJudgments,
      deferredFindingDispositions: fixture.dispositionJudgments("still_open"),
    });
    assert.equal(missingSource.artifact.verdict, "blocked");
    assert.ok(missingSource.artifact.mechanicalBlockers.some(
      (blocker) => blocker.kind === "missing_deferred_source",
    ));
  });
});

test("R9: structural gate failures remain non-deferrable", () => {
  const classification = classifyGateRetryExhaustionSource({
    sourceArtifact: { sourceArtifactStatus: "invalid_schema" },
    phase: "spec",
  });
  assert.equal(classification.deferAllowed, false);
  assert.equal(classification.completionKind, "blocking");
});

test("R9: final dispositions use only the allowlisted values", () => {
  assert.throws(() => new FlowFinding({
    findingId: "DF-invalid-disposition",
    sourceStep: "test-review",
    sourceArtifact: "test-review.json",
    sourceFindingId: "invalid",
    fingerprint: "b".repeat(64),
    disposition: "deferred",
    rationale: "The bounded retry policy deferred this finding.",
    retryExhausted: true,
    attempts: 1,
    round: 1,
    completionKind: "deferred",
    finalDisposition: "unsupported",
  }), /finalDisposition/);
});
