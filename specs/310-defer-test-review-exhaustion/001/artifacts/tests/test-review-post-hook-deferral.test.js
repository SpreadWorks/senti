// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  createAcceptanceReviewFixture,
  runAcceptanceReviewFixture,
} from "../../../tests/helpers/acceptance-review-fixture.js";
import { readFlowFindingsArtifact } from "../../../src/flow/lib/flow-findings.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { checkReviewRetryBelowMax, updateReviewRetryCounter } from "../../../src/flow/lib/run-review.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

let tmp;
const CLI = path.join(process.cwd(), "src/senti.js");

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function semanticFinding(id) {
  return {
    findingId: id,
    severity: "blocking",
    fingerprint: crypto.createHash("sha256").update(id).digest("hex"),
    disposition: "must-fix",
    rationale: "This semantic finding requires a test-review repair before it can pass.",
    failureMode: "missing_acceptance_requirement",
    category: "semantic",
    title: "Missing test-review behavior",
    reason: "The semantic finding is not a tooling failure or structured coverage failure.",
  };
}

function prepareSpecRoot() {
  tmp = createTmpDir("test-review-post-hook-deferral-");
  writeJson(tmp, "specs/demo/spec.json", {
    requirements: [{ id: "R1", desc: "demo requirement", priority: "must" }],
  });
  return {
    root: tmp,
    specDir: path.join(tmp, "specs", "demo"),
    specPath: "specs/demo/spec.json",
  };
}

function runCli(root, args) {
  const out = execFileSync("node", [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
  return JSON.parse(out);
}

function retryMetrics(phase, count) {
  return Array.from({ length: count }, () => ({ phase, counter: "reviewRetry", delta: 1 }));
}

function makeFlowState(fixture, metrics = retryMetrics("test", 9)) {
  return {
    runId: "run-acceptance-fixture",
    spec: fixture.specPath,
    metrics,
    steps: [
      {
        id: "plan",
        status: "pending",
        children: [
          { id: "test-review", status: "in_progress" },
          { id: "implement", status: "pending" },
        ],
      },
    ],
  };
}

function makeActiveFlowFixture() {
  const fixture = prepareSpecRoot();
  const steps = buildInitialSteps();
  const leaves = flattenSteps(steps);
  const reviewIndex = leaves.findIndex((step) => step.id === "test-review");
  assert.notEqual(reviewIndex, -1);
  leaves.forEach((step, index) => {
    step.status = index < reviewIndex ? "done" : "pending";
  });
  findStepById(steps, "test-review").status = "in_progress";
  const flowState = {
    runId: "run-acceptance-fixture",
    spec: fixture.specPath,
    baseBranch: "main",
    featureBranch: "feature/demo",
    steps,
    requirements: [],
    tasks: [{
      id: "T-1",
      title: "Implement deferred test-review carryover",
      goal: "Implement deferred test-review carryover.",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "pending",
      steps: [],
    }],
    currentTaskId: null,
    metrics: retryMetrics("test", 9),
  };
  const flowManager = makeFlowManager(fixture.root);
  flowManager.create(flowState);
  flowManager.addActiveFlow("demo", "local");
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "FAIL",
    blockingFindings: [semanticFinding("progression-semantic")],
  });
  return { ...fixture, flowState, flowManager };
}

function fakeFlowManager(flowState, updates = []) {
  return {
    updateStepStatus(id, status) {
      const stepId = typeof id === "string" ? id : id.stepId;
      const nextStatus = typeof id === "string" ? status : id.action.status;
      updates.push({ id: stepId, status: nextStatus });
      const step = flowState.steps[0].children.find((child) => child.id === stepId);
      if (step) step.status = nextStatus;
    },
    appendMetric(metric) {
      flowState.metrics.push(metric);
    },
    mutate(fn) {
      fn(flowState);
    },
  };
}

function runFinalSemanticFail({ fixture, findingId = "semantic-1", metrics, flowStateOverrides = {} } = {}) {
  const flowState = {
    ...makeFlowState(fixture, metrics),
    ...flowStateOverrides,
  };
  const updates = [];
  if (!fs.existsSync(path.join(fixture.specDir, "test-review.json"))) {
    writeJson(fixture.specDir, "test-review.json", {
      verdict: "FAIL",
      blockingFindings: [semanticFinding(findingId)],
    });
  }
  updateReviewRetryCounter({
    root: fixture.root,
    flowState,
    flowManager: fakeFlowManager(flowState, updates),
  }, {
    artifacts: {
      retryPhase: "test",
      verdict: "FAIL",
    },
  });
  return { flowState, updates };
}

function acceptanceFixtureForDeferredFinding(entry) {
  return createAcceptanceReviewFixture({
    deferredFindings: [{
      findingId: entry.findingId,
      sourceStep: entry.sourceStep,
      sourceArtifact: entry.sourceArtifact,
      sourceFindingId: entry.sourceFindingId,
    }],
  });
}

test("R1: final semantic FAIL post-hook writes flow-findings.json in the same command lifecycle", () => {
  const fixture = prepareSpecRoot();
  runFinalSemanticFail({ fixture });

  assert.equal(fs.existsSync(path.join(fixture.specDir, "flow-findings.json")), true);
});

test("R2: deferred entry contains required test-review retry exhaustion metadata", () => {
  const fixture = prepareSpecRoot();
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "FAIL",
    blockingFindings: [semanticFinding("semantic-metadata")],
    advisoryFindings: [
      {
        ...semanticFinding("advisory-should-not-defer"),
        severity: "advisory",
      },
    ],
    resolvedFindings: [
      {
        ...semanticFinding("resolved-should-not-defer"),
        finalDisposition: "fixed",
      },
    ],
  });
  runFinalSemanticFail({ fixture, findingId: "semantic-metadata" });

  const entry = readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0];
  assert.equal(readFlowFindingsArtifact(fixture.specDir).toJSON().entries.length, 1);
  assert.match(entry.findingId, /^DF-/);
  assert.notEqual(entry.findingId, entry.sourceFindingId);
  assert.equal(entry.sourceStep, "test-review");
  assert.equal(entry.sourceArtifact, "test-review.json");
  assert.equal(entry.sourceFindingId, "semantic-metadata");
  assert.equal(entry.retryExhausted, true);
  assert.equal(entry.attempts, 10);
  assert.equal(entry.round, 10);
  assert.equal(entry.completionKind, "deferred");
  assert.equal(entry.finalDisposition, "still_open");
});

test("R3: semantic deferral marks test-review complete through the flow manager", () => {
  const fixture = makeActiveFlowFixture();
  updateReviewRetryCounter({
    root: fixture.root,
    phase: "test",
    flowState: fixture.flowState,
    flowManager: fixture.flowManager,
  }, {
    artifacts: {
      phase: "test",
      retryPhase: "test",
      verdict: "FAIL",
    },
  });

  const status = runCli(fixture.root, ["flow", "get", "status"]);
  const testReview = flattenSteps(status.data.steps).find((step) => step.id === "test-review");
  assert.equal(testReview.status, "done");

  const nextAction = runCli(fixture.root, ["flow", "get", "next-action"]);
  assert.ok(["implement", "task-impl", "test-execute", "impl-review", "impl-gate"].includes(nextAction.data.step));
});

test("R4: post-hook deferral shares the same source artifact and finding id as pre-check deferral", () => {
  const preCheckFixture = prepareSpecRoot();
  writeJson(preCheckFixture.specDir, "test-review.json", {
    verdict: "FAIL",
    blockingFindings: [semanticFinding("shared-source-id")],
  });
  const preCheckState = makeFlowState(preCheckFixture, retryMetrics("test", 10));
  const preCheckUpdates = [];
  const preCheck = checkReviewRetryBelowMax({
    root: preCheckFixture.root,
    flowState: preCheckState,
    flowManager: fakeFlowManager(preCheckState, preCheckUpdates),
  }, "test");

  const postHookFixture = prepareSpecRoot();
  const { updates: postHookUpdates } = runFinalSemanticFail({
    fixture: postHookFixture,
    findingId: "shared-source-id",
  });

  const preCheckEntry = readFlowFindingsArtifact(preCheckFixture.specDir).toJSON().entries[0];
  const postHookEntry = readFlowFindingsArtifact(postHookFixture.specDir).toJSON().entries[0];
  assert.equal(preCheck?.result, "deferred");
  assert.deepEqual(preCheckUpdates, [{ id: "test-review", status: "done" }]);
  assert.deepEqual(postHookUpdates, [{ id: "test-review", status: "done" }]);
  assert.equal(preCheckEntry.sourceArtifact, postHookEntry.sourceArtifact);
  assert.equal(preCheckEntry.sourceFindingId, postHookEntry.sourceFindingId);
});

test("R5: tooling and structured coverage failures stay outside semantic carryover while semantic failures still defer", () => {
  const fixture = prepareSpecRoot();
  runFinalSemanticFail({ fixture, findingId: "semantic-control" });
  writeJson(fixture.specDir, "test-review.json", {
    verdict: "TOOLING_FAILURE",
    toolingOutcome: true,
    blockingFindings: [semanticFinding("tooling-should-not-defer")],
  });
  updateReviewRetryCounter({
    root: fixture.root,
    flowState: makeFlowState(fixture, retryMetrics("test", 9)),
    flowManager: fakeFlowManager(makeFlowState(fixture, retryMetrics("test", 9))),
  }, {
    artifacts: {
      retryPhase: "test",
      verdict: "TOOLING_FAILURE",
    },
  });

  const entries = readFlowFindingsArtifact(fixture.specDir).toJSON().entries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceFindingId, "semantic-control");

  const structured = prepareSpecRoot();
  writeJson(structured.specDir, "test-review.json", {
    verdict: "FAIL",
    blockingFindings: [semanticFinding("coverage-should-not-defer")],
  });
  writeJson(structured.specDir, "test-coverage.json", {
    validation: {
      ok: false,
      messages: ["missing header for R5"],
    },
  });
  runFinalSemanticFail({ fixture: structured, findingId: "coverage-should-not-defer" });
  assert.equal(readFlowFindingsArtifact(structured.specDir).toJSON().entries.length, 0);
});

test("R6: unchanged-evidence recovery state does not block final semantic carryover", () => {
  const fixture = prepareSpecRoot();
  runFinalSemanticFail({
    fixture,
    findingId: "unchanged-evidence-semantic",
    flowStateOverrides: {
      retryRecovery: {
        review: {
          test: {
            recoveryPossible: false,
            reason: "unchanged-evidence",
          },
        },
      },
    },
  });

  assert.equal(readFlowFindingsArtifact(fixture.specDir).toJSON().entries[0].sourceFindingId, "unchanged-evidence-semantic");
});

test("R7: repeated carryover for the same source finding does not append duplicates", () => {
  const fixture = prepareSpecRoot();
  runFinalSemanticFail({ fixture, findingId: "stable-duplicate-id" });
  runFinalSemanticFail({ fixture, findingId: "stable-duplicate-id" });

  const entries = readFlowFindingsArtifact(fixture.specDir).toJSON().entries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sourceFindingId, "stable-duplicate-id");
});

test("R8: acceptance-review receives deferred findings created by the post-hook path", () => {
  const producerFixture = prepareSpecRoot();
  runFinalSemanticFail({ fixture: producerFixture, findingId: "acceptance-deferred" });
  const [entry] = readFlowFindingsArtifact(producerFixture.specDir).toJSON().entries;
  const acceptanceFixture = acceptanceFixtureForDeferredFinding(entry);
  try {
    const { artifact, applied } = runAcceptanceReviewFixture({
      root: acceptanceFixture.root,
      state: acceptanceFixture.state,
      diff: acceptanceFixture.diff,
      requirementJudgments: acceptanceFixture.requirementJudgments,
      deferredFindingDispositions: acceptanceFixture.dispositionJudgments("still_open"),
      apply: true,
      flowManager: acceptanceFixture.flowManager,
    });
    assert.equal(artifact.deferredFindings.length, 1);
    assert.equal(artifact.deferredFindings[0].findingId, entry.findingId);
    assert.equal(artifact.deferredFindings[0].sourceStep, "test-review");
    assert.equal(artifact.deferredFindings[0].sourceFindingId, "acceptance-deferred");
    assert.equal(artifact.deferredFindings[0].finalDisposition, "still_open");
    assert.equal(artifact.verdict, "user_decision_required");
    assert.equal(applied.verdict, "user_decision_required");
    assert.equal(acceptanceFixture.activeStep(), "acceptance-decision");
  } finally {
    acceptanceFixture.cleanup();
  }
});

test("R8: unresolved deferred findings route acceptance-review to user decision", () => {
  const producerFixture = prepareSpecRoot();
  runFinalSemanticFail({ fixture: producerFixture, findingId: "acceptance-branching" });
  const [entry] = readFlowFindingsArtifact(producerFixture.specDir).toJSON().entries;
  const blockingFixture = acceptanceFixtureForDeferredFinding(entry);
  try {
    const blocking = runAcceptanceReviewFixture({
      root: blockingFixture.root,
      state: blockingFixture.state,
      diff: blockingFixture.diff,
      requirementJudgments: blockingFixture.requirementJudgments,
      deferredFindingDispositions: blockingFixture.dispositionJudgments("blocking"),
    });
    assert.equal(blocking.artifact.verdict, "user_decision_required");
    assert.equal(blocking.artifact.deferredFindings[0].finalDisposition, "blocking");
  } finally {
    blockingFixture.cleanup();
  }

  const acceptanceFixture = acceptanceFixtureForDeferredFinding(entry);
  try {
    const stillOpen = runAcceptanceReviewFixture({
      root: acceptanceFixture.root,
      state: acceptanceFixture.state,
      diff: acceptanceFixture.diff,
      requirementJudgments: acceptanceFixture.requirementJudgments,
      deferredFindingDispositions: acceptanceFixture.dispositionJudgments("still_open"),
      apply: true,
      flowManager: acceptanceFixture.flowManager,
    });
    assert.equal(stillOpen.applied.verdict, "user_decision_required");
    assert.equal(acceptanceFixture.activeStep(), "acceptance-decision");
  } finally {
    acceptanceFixture.cleanup();
  }
});

test("R8: fixed post-hook findings retain source identity and route to final regression", () => {
  const producerFixture = prepareSpecRoot();
  runFinalSemanticFail({ fixture: producerFixture, findingId: "acceptance-fixed" });
  const [entry] = readFlowFindingsArtifact(producerFixture.specDir).toJSON().entries;
  const fixture = acceptanceFixtureForDeferredFinding(entry);
  try {
    const { artifact, applied } = runAcceptanceReviewFixture({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
      requirementJudgments: fixture.requirementJudgments,
      deferredFindingDispositions: fixture.dispositionJudgments("fixed"),
      apply: true,
      flowManager: fixture.flowManager,
    });
    assert.equal(artifact.deferredFindings[0].findingId, entry.findingId);
    assert.equal(artifact.deferredFindings[0].sourceArtifact, "test-review.json");
    assert.equal(artifact.deferredFindings[0].finalDisposition, "fixed");
    assert.equal(artifact.verdict, "pass");
    assert.equal(applied.verdict, "pass");
    assert.equal(fixture.activeStep(), "final-regression");
  } finally {
    fixture.cleanup();
  }
});

test("R8: passing acceptance review routes to final regression", () => {
  const acceptanceFixture = createAcceptanceReviewFixture();
  try {
    runAcceptanceReviewFixture({
      root: acceptanceFixture.root,
      state: acceptanceFixture.state,
      diff: acceptanceFixture.diff,
      requirementJudgments: acceptanceFixture.requirementJudgments,
      apply: true,
      flowManager: acceptanceFixture.flowManager,
    });
    assert.equal(acceptanceFixture.activeStep(), "final-regression");
  } finally {
    acceptanceFixture.cleanup();
  }
});

test("R9: post-hook carryover preserves reviewRetry evidence for manual retry reset workflows", () => {
  const fixture = prepareSpecRoot();
  const { flowState } = runFinalSemanticFail({ fixture });

  const retryCount = flowState.metrics.filter((entry) => entry.phase === "test" && entry.counter === "reviewRetry").length;
  assert.equal(retryCount, 10);
  assert.equal(readFlowFindingsArtifact(fixture.specDir).toJSON().entries.length, 1);
});
