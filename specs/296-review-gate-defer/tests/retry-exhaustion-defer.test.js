// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  checkReviewRetryBelowMax,
  updateReviewRetryCounter,
} from "../../../src/flow/lib/run-review.js";
import {
  checkRetryBelowMax as checkGateRetryBelowMax,
  classifyGateRetryExhaustionSource,
} from "../../../src/flow/lib/run-gate.js";
import {
  buildAcceptanceReviewArtifactFromEvidence,
  applyAcceptanceReviewResult,
  writeAcceptanceReviewArtifact,
} from "../../../src/flow/lib/acceptance-review-artifacts.js";
import { readFlowFindingsArtifact } from "../../../src/flow/lib/flow-findings.js";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

const reviewSourceByPhase = {
  "draft-questions": {
    commandPhase: "draft",
    sourceArtifact: "draft-review-questions.json",
    stepId: "draft-questions-review",
    artifact: {
      verdict: "FAIL",
      findings: [semanticFinding("draft-semantic")]
    },
    steps: [
      { id: "draft-questions-review", status: "in_progress" }
    ]
  },
  spec: {
    commandPhase: "spec",
    sourceArtifact: "spec-review.json",
    stepId: "spec-review",
    artifact: {
      verdict: "FAIL",
      blocking: [semanticFinding("spec-semantic")]
    }
  },
  test: {
    commandPhase: "test",
    sourceArtifact: "test-review.json",
    stepId: "test-review",
    artifact: {
      verdict: "FAIL",
      blockingFindings: [semanticFinding("test-semantic")]
    }
  },
  impl: {
    commandPhase: null,
    sourceArtifact: "impl-review.json",
    stepId: "impl-review",
    artifact: {
      verdict: "FAIL",
      blockingFindings: [semanticFinding("impl-semantic")]
    }
  }
};

const gateSourceByPhase = {
  draft: {
    sourceArtifact: "draft-gate-source.json",
    stepId: "draft-gate"
  },
  spec: {
    sourceArtifact: "spec-gate-source.json",
    stepId: "spec-gate"
  },
  "task-impl": {
    sourceArtifact: "task-impl-gate-source.json",
    stepId: "impl-gate"
  },
  integration: {
    sourceArtifact: "impl-gate-result.json",
    stepId: "impl-gate"
  }
};

function semanticFinding(id) {
  return {
    findingId: id,
    failureMode: "missing_acceptance_requirement",
    category: "semantic",
    title: "Missing test coverage for semantic requirement",
    reason: "The AI semantic finding mentions test and missing but is not a mechanical precheck failure."
  };
}

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function makeTempFlowRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-296-"));
  const specDir = path.join(root, "specs", "demo");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    requirements: [
      { id: "R1", desc: "demo", priority: "must" }
    ]
  }, null, 2) + "\n");
  return { root, specDir, specPath: "specs/demo/spec.json" };
}

function writeAcceptancePrerequisites(specDir) {
  fs.mkdirSync(path.join(specDir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(specDir, "scenario-validity-result.json"), JSON.stringify({ result: "pass" }, null, 2) + "\n");
  fs.writeFileSync(path.join(specDir, "tests", "acceptance.test.js"), "test('R1: demo', () => {});\n");
  fs.writeFileSync(path.join(specDir, "test-execute-result.json"), JSON.stringify({
    version: "2",
    summary: [{ id: "R1", result: "pass" }]
  }, null, 2) + "\n");
  fs.writeFileSync(path.join(specDir, "test-result-review.json"), JSON.stringify({ verdict: "pass" }, null, 2) + "\n");
  fs.writeFileSync(path.join(specDir, "retro.json"), JSON.stringify({ result: "pass" }, null, 2) + "\n");
}

function retryMetrics(counter, phase) {
  return Array.from({ length: 10 }, () => ({ phase, counter, delta: 1 }));
}

function fakeFlowManager(flowState, updates) {
  return {
    updateStepStatus(id, status) {
      updates.push({ id, status });
    },
    mutate(fn) {
      fn(flowState);
    }
  };
}

function reviewRetryContext(reviewPhase) {
  const source = reviewSourceByPhase[reviewPhase];
  const { root, specDir, specPath } = makeTempFlowRoot();
  fs.writeFileSync(path.join(specDir, source.sourceArtifact), JSON.stringify(source.artifact, null, 2) + "\n");
  const flowState = {
    spec: specPath,
    metrics: retryMetrics("reviewRetry", reviewPhase),
    steps: source.steps || []
  };
  const updates = [];
  return {
    root,
    specDir,
    source,
    updates,
    ctx: {
      root,
      flowState,
      flowManager: fakeFlowManager(flowState, updates)
    }
  };
}

function reviewRetryContextWithCount(reviewPhase, count) {
  const fixture = reviewRetryContext(reviewPhase);
  fixture.ctx.flowState.metrics = retryMetrics("reviewRetry", reviewPhase).slice(0, count);
  fixture.ctx.flowManager.appendMetric = (entry) => {
    fixture.ctx.flowState.metrics.push(entry);
  };
  return fixture;
}

function gateRetryContext(phase) {
  const source = gateSourceByPhase[phase];
  const { root, specDir, specPath } = makeTempFlowRoot();
  fs.writeFileSync(path.join(specDir, source.sourceArtifact), JSON.stringify({
    phase,
    result: "fail",
    evaluations: [
      {
        findingId: `${phase}-semantic`,
        result: "fail",
        category: "requirements",
        guardrail_id: "R2",
        reason: "Missing test command behavior in the semantic implementation path"
      }
    ]
  }, null, 2) + "\n");
  const flowState = {
    spec: specPath,
    metrics: retryMetrics("gateRetry", phase)
  };
  const updates = [];
  return {
    root,
    specDir,
    source,
    updates,
    ctx: {
      root,
      flowState,
      flowManager: fakeFlowManager(flowState, updates)
    }
  };
}

function gateRetryContextWithArtifact(phase, artifact) {
  const source = gateSourceByPhase[phase];
  const { root, specDir, specPath } = makeTempFlowRoot();
  fs.writeFileSync(path.join(specDir, source.sourceArtifact), JSON.stringify({
    phase,
    result: "fail",
    ...artifact
  }, null, 2) + "\n");
  const flowState = {
    spec: specPath,
    metrics: retryMetrics("gateRetry", phase)
  };
  const updates = [];
  return {
    root,
    specDir,
    source,
    updates,
    ctx: {
      root,
      flowState,
      flowManager: fakeFlowManager(flowState, updates)
    }
  };
}

test("R1: review retry exhaustion defers semantic findings for every flow review phase", () => {
  for (const phase of ["draft-questions", "spec", "test", "impl"]) {
    const fixture = reviewRetryContext(phase);
    const result = checkReviewRetryBelowMax(fixture.ctx, fixture.source.commandPhase);
    assert.equal(result?.result, "deferred", phase);
    assert.deepEqual(fixture.updates, [{ id: fixture.source.stepId, status: "done" }], phase);
    const findings = readFlowFindingsArtifact(fixture.specDir).toJSON().entries;
    assert.equal(findings.length, 1, phase);
    assert.equal(findings[0].sourceStep, fixture.source.stepId, phase);
  }
});

test("R2: gate retry exhaustion defers semantic findings for every tracked gate phase", () => {
  for (const phase of ["draft", "spec", "task-impl", "integration"]) {
    const fixture = gateRetryContext(phase);
    const result = checkGateRetryBelowMax(fixture.ctx, phase);
    assert.equal(result?.result, "deferred", phase);
    assert.deepEqual(fixture.updates, [{ id: fixture.source.stepId, status: "done" }], phase);
    const findings = readFlowFindingsArtifact(fixture.specDir).toJSON().entries;
    assert.equal(findings.length, 1, phase);
    assert.equal(findings[0].sourceStep, fixture.source.stepId, phase);
  }
});

test("R3: prose words do not turn AI semantic findings into mechanical blockers", () => {
  const classification = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "task-impl",
      result: "fail",
      observations: [
        {
          severity: "blocking",
          category: "semantic",
          failureMode: "requirement_alignment",
          observed: "The implementation is missing a test-facing command behavior required by the spec."
        }
      ]
    }
  });
  assert.equal(classification.deferAllowed, true);
});

test("R4: structured non-semantic prechecks are not deferred as semantic findings", () => {
  const cases = [
    [{ toolingFailure: "parser_error" }, "tooling_failure"],
    [{ command: { exitCode: 1 } }, "failed_command"],
    [{ sourceArtifactStatus: "invalid_schema" }, "invalid_schema"],
    [{ testEvidence: { result: "fail" } }, "failed_test_evidence"],
    [{ guardCode: "NO_PROGRESS_SINCE_LAST_FAIL" }, "no_progress_guard"],
    [{ flowStateValid: false }, "flow_corruption"],
    [{ malformedArtifact: true }, "malformed_artifact"],
    [{ coverage: { validation: { ok: false, messages: ["missing spec header"] } } }, "coverage_header_failure"],
    [{ blockingFindings: [{ origin: "test-coverage", failureKind: "missing_header" }] }, "coverage_header_failure"]
  ];
  for (const [sourceArtifact, reason] of cases) {
    const classification = classifyGateRetryExhaustionSource({
      sourceArtifact: {
        phase: "test",
        result: "fail",
        ...sourceArtifact
      }
    });
    assert.equal(classification.deferAllowed, false, reason);
    assert.equal(classification.reason, reason);
  }

  const retryFixture = gateRetryContextWithArtifact("integration", {
    toolingFailure: "parser_error",
    evaluations: [
      {
        result: "fail",
        category: "requirements",
        reason: "semantic-looking text must not matter when toolingFailure is structured"
      }
    ]
  });
  const retryResult = checkGateRetryBelowMax(retryFixture.ctx, "integration");
  assert.notEqual(retryResult?.result, "deferred");
  assert.equal(fs.existsSync(path.join(retryFixture.specDir, "flow-findings.json")), false);
});

test("R5: test-review uses flow-level repair and reviewRetry budget", () => {
  const fixture = reviewRetryContextWithCount("test", 4);
  assert.equal(checkReviewRetryBelowMax(fixture.ctx, "test"), null);
  updateReviewRetryCounter(fixture.ctx, {
    artifacts: {
      phase: "test",
      retryPhase: "test",
      verdict: "FAIL"
    }
  });
  assert.equal(fixture.ctx.flowState.metrics.length, 5);
  const result = checkReviewRetryBelowMax(fixture.ctx, "test");
  assert.equal(result?.result, "deferred");
  assert.deepEqual(fixture.updates, [{ id: "test-review", status: "done" }]);
  assert.equal(readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0].attempts, 5);

  const toolingFixture = reviewRetryContext("test");
  fs.writeFileSync(path.join(toolingFixture.specDir, "test-review.json"), JSON.stringify({
    verdict: "TOOLING_FAILURE",
    toolingFailure: "parser_error",
    blockingFindings: [semanticFinding("ignored")]
  }, null, 2) + "\n");
  const toolingResult = checkReviewRetryBelowMax(toolingFixture.ctx, "test");
  assert.notEqual(toolingResult?.result, "deferred");
  assert.equal(fs.existsSync(path.join(toolingFixture.specDir, "flow-findings.json")), false);

  const coverageFixture = reviewRetryContext("test");
  fs.writeFileSync(path.join(coverageFixture.specDir, "test-coverage.json"), JSON.stringify({
    validation: {
      ok: false,
      messages: ["missing spec header"]
    }
  }, null, 2) + "\n");
  fs.writeFileSync(path.join(coverageFixture.specDir, "test-review.json"), JSON.stringify({
    verdict: "FAIL",
    blockingFindings: [
      {
        origin: "test-coverage",
        failureKind: "missing_header",
        title: "Missing spec header",
        issue: "A spec-local test file lacks the required header."
      }
    ]
  }, null, 2) + "\n");
  const coverageResult = checkReviewRetryBelowMax(coverageFixture.ctx, "test");
  assert.notEqual(coverageResult?.result, "deferred");
  assert.equal(fs.existsSync(path.join(coverageFixture.specDir, "flow-findings.json")), false);

  const prompt = readRepoFile("src/flow/prompts/plan/test-review.md");
  assert.match(prompt, /flow-level repair/i);
  assert.match(prompt, /reviewRetry/i);
  assert.match(prompt, /separate .*senti flow run review --phase test/i);
  assert.doesNotMatch(prompt, /one-shot|does not auto-fix|internal PASS-seeking loop|REVIEW_MAX_ATTEMPTS_EXCEEDED received:\s*STOP/is);
});

test("R6: flow-findings records bounded references after review deferral", () => {
  const fixture = reviewRetryContext("spec");
  checkReviewRetryBelowMax(fixture.ctx, "spec");
  const entry = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0];
  assert.equal(typeof entry.findingId, "string");
  assert.notEqual(entry.findingId, "");
  assert.equal(entry.sourceStep, "spec-review");
  assert.equal(entry.sourceArtifact, "spec-review.json");
  assert.equal(entry.sourceFindingId, "spec-semantic");
  assert.equal(entry.retryExhausted, true);
  assert.equal(entry.attempts, 10);
  assert.equal(entry.round, 10);
  assert.equal(entry.completionKind, "deferred");
  assert.equal(entry.finalDisposition, null);
  assert.equal(Object.hasOwn(entry, "reason"), false);
});

test("R7: acceptance-review consumes deferred findings and mirrors finalDisposition", () => {
  const fixture = reviewRetryContext("spec");
  checkReviewRetryBelowMax(fixture.ctx, "spec");
  writeAcceptancePrerequisites(fixture.specDir);
  const generatedFindingId = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0].findingId;
  fs.writeFileSync(path.join(fixture.specDir, "acceptance-review-evidence.json"), JSON.stringify({
    deferredFindingDispositions: [
      {
        findingId: generatedFindingId,
        finalDisposition: "fixed",
        evidenceRefs: ["spec-review.json#spec-semantic"]
      }
    ]
  }, null, 2) + "\n");
  const built = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  assert.equal(built.deferredFindings[0].finalDisposition, "fixed");
  writeAcceptanceReviewArtifact({ specDir: fixture.specDir, artifact: built });
  const mirrored = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0];
  assert.equal(mirrored.finalDisposition, "fixed");

  fs.writeFileSync(path.join(fixture.specDir, "acceptance-review-evidence.json"), JSON.stringify({
    deferredFindingDispositions: [
      {
        findingId: generatedFindingId,
        finalDisposition: "still_open",
        evidenceRefs: ["spec-review.json#spec-semantic"]
      }
    ]
  }, null, 2) + "\n");
  const amend = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  assert.equal(amend.verdict, "amend_required");
  assert.equal(amend.nextAction, "repair");

  fs.writeFileSync(path.join(fixture.specDir, "acceptance-review-evidence.json"), JSON.stringify({
    deferredFindingDispositions: [
      {
        findingId: generatedFindingId,
        finalDisposition: "blocking",
        evidenceRefs: ["spec-review.json#spec-semantic"]
      }
    ]
  }, null, 2) + "\n");
  const blocked = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  assert.equal(blocked.verdict, "blocked");

  const state = {
    spec: "specs/demo/spec.json",
    steps: [
      { id: "implement", status: "done" },
      { id: "acceptance-review", status: "in_progress" },
      { id: "final-regression", status: "pending" }
    ]
  };
  applyAcceptanceReviewResult({
    root: fixture.root,
    artifact: blocked,
    flowManager: {
      load: () => state,
      mutate: (fn) => fn(state)
    }
  });
  assert.equal(state.steps.find((step) => step.id === "final-regression").status, "pending");

  const userDecision = writeAcceptanceReviewArtifact({
    specDir: fixture.specDir,
    artifact: {
      version: 1,
      goalSatisfactionScore: 1,
      requirementAlignmentScore: 1,
      implementationQualityScore: 1,
      acceptanceScore: 1,
      thresholds: {
        goalSatisfactionPass: 0.9,
        requirementAlignmentPass: 0.9,
        implementationQualityPass: 0.8
      },
      mechanicalBlockers: [],
      hardBlockers: [],
      attempt: 1,
      findings: [{
        findingId: "U-1",
        summary: "A product decision is required.",
        severity: "medium",
        category: "product_decision",
        mappedRequirementIds: ["R1"],
        linkedRequirementAmendmentProposalIds: [],
        evidenceRefs: [],
        confidence: "high",
        shouldReimplement: false,
        reimplementationReason: "",
        requiresUserDecision: true
      }],
      deferredFindings: [
        {
          findingId: generatedFindingId,
          sourceStep: "spec-review",
          sourceArtifact: "spec-review.json",
          sourceFindingId: "spec-semantic",
          finalDisposition: "fixed",
          evidenceRefs: []
        }
      ],
      requirementAmendmentProposals: [],
      userDecision: null,
      blockedDecision: null,
      verdict: "pass",
      nextAction: "user_decision",
      targetStep: "spec"
    }
  });
  assert.equal(userDecision.artifact.verdict, "user_decision_required");

  fs.writeFileSync(path.join(fixture.specDir, "acceptance-review-evidence.json"), JSON.stringify({
    deferredFindingDispositions: [
      {
        findingId: generatedFindingId,
        finalDisposition: "fixed",
        evidenceRefs: ["spec-review.json#spec-semantic"]
      }
    ]
  }, null, 2) + "\n");
  fs.renameSync(path.join(fixture.specDir, "spec-review.json"), path.join(fixture.specDir, "spec-review.json.bak"));
  const missingSource = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  assert.equal(missingSource.verdict, "blocked");

  const prompt = readRepoFile("src/flow/prompts/impl/acceptance-review.md");
  assert.match(prompt, /flow-findings\.json/);
  assert.match(prompt, /finalDisposition/);
});

test("R8: retry-limit prompts delegate deferrable semantic findings instead of stopping", () => {
  const promptFiles = [
    "src/flow/prompts/plan/spec-review.md",
    "src/flow/prompts/plan/test-review.md",
    "src/flow/prompts/plan/spec-gate.md",
    "src/flow/prompts/plan/draft-gate.md",
    "src/flow/prompts/impl/impl-review.md",
    "src/flow/prompts/impl/impl-gate.md"
  ];
  for (const file of promptFiles) {
    const prompt = readRepoFile(file);
    assert.match(prompt, /acceptance-review|flow-findings\.json/i, `${file} should mention deferral`);
    assert.doesNotMatch(prompt, /retry limit[^.\n]*STOP|REVIEW_MAX_ATTEMPTS_EXCEEDED received:\s*STOP|ESCALATE_RETRY_EXHAUSTED received:\s*STOP|GATE_MAX_ATTEMPTS_EXCEEDED received:\s*STOP/is, `${file} should not stop for deferrable semantic retry exhaustion`);
  }
});

test("R9: shared regression coverage exists for retry exhaustion deferral contracts", () => {
  const reviewFixture = reviewRetryContext("test");
  assert.equal(checkReviewRetryBelowMax(reviewFixture.ctx, "test")?.result, "deferred");

  const gateFixture = gateRetryContext("integration");
  assert.equal(checkGateRetryBelowMax(gateFixture.ctx, "integration")?.result, "deferred");

  const mechanical = classifyGateRetryExhaustionSource({
    sourceArtifact: {
      phase: "test",
      result: "fail",
      coverage: {
        validation: {
          ok: false,
          messages: ["missing spec header"]
        }
      }
    }
  });
  assert.equal(mechanical.deferAllowed, false);
  assert.equal(mechanical.reason, "coverage_header_failure");

  fs.writeFileSync(path.join(reviewFixture.specDir, "acceptance-review-evidence.json"), JSON.stringify({
    deferredFindingDispositions: [
      {
        findingId: "DF-1",
        finalDisposition: "fixed",
        evidenceRefs: ["test-review.json#test-semantic"]
      }
    ]
  }, null, 2) + "\n");
  const acceptance = buildAcceptanceReviewArtifactFromEvidence({ specDir: reviewFixture.specDir });
  assert.equal(acceptance.deferredFindings[0].finalDisposition, "fixed");
});
