// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  applyAcceptanceReviewResult,
  buildAcceptanceReviewArtifactFromEvidence,
} from "../../../src/flow/lib/acceptance-review-artifacts.js";
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
  flowManager.save(flowState);
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
      updates.push({ id, status });
      const step = flowState.steps[0].children.find((child) => child.id === id);
      if (step) step.status = status;
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

function prepareAcceptanceEvidence(specDir) {
  writeJson(specDir, "scenario-validity-result.json", { result: "pass" });
  writeFile(specDir, "tests/post-hook-deferral.test.js", "// spec: R1\nimport { test } from 'node:test';\ntest('R1: demo', () => {});\n");
  writeJson(specDir, "test-execute-result.json", {
    version: "2",
    summary: [{ id: "R1", result: "pass" }],
  });
  writeJson(specDir, "test-result-review.json", { verdict: "pass" });
  writeJson(specDir, "retro.json", { result: "pass" });
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
    toolingFailure: true,
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
  const fixture = prepareSpecRoot();
  runFinalSemanticFail({ fixture, findingId: "acceptance-deferred" });
  prepareAcceptanceEvidence(fixture.specDir);

  const artifact = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  assert.equal(artifact.deferredFindings.length, 1);
  assert.equal(artifact.deferredFindings[0].sourceStep, "test-review");
  assert.equal(artifact.deferredFindings[0].sourceFindingId, "acceptance-deferred");
  assert.equal(artifact.deferredFindings[0].finalDisposition, "still_open");
  assert.equal(artifact.verdict, "amend_required");
  assert.equal(artifact.targetStep, "implement");
});

test("R8: acceptance-review derives blocked and user-decision outcomes for deferred findings", () => {
  const fixture = prepareSpecRoot();
  runFinalSemanticFail({ fixture, findingId: "acceptance-branching" });
  prepareAcceptanceEvidence(fixture.specDir);
  const [entry] = readFlowFindingsArtifact(fixture.specDir).toJSON().entries;
  writeJson(fixture.specDir, "acceptance-review-evidence.json", {
    deferredFindingDispositions: [
      {
        findingId: entry.findingId,
        finalDisposition: "blocking",
        evidenceRefs: ["test-review.json"],
      },
    ],
  });
  const blocked = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  assert.equal(blocked.verdict, "blocked");
  assert.equal(blocked.deferredFindings[0].finalDisposition, "blocking");

  fs.rmSync(path.join(fixture.specDir, "acceptance-review-evidence.json"));
  const stillOpen = buildAcceptanceReviewArtifactFromEvidence({ specDir: fixture.specDir });
  const flowState = {
    spec: "specs/demo/spec.json",
    acceptanceReview: { round: 1 },
    steps: buildInitialSteps(),
  };
  const userDecision = applyAcceptanceReviewResult({
    root: fixture.root,
    flowManager: {
      load() {
        return flowState;
      },
      mutate(fn) {
        fn(flowState);
      },
    },
    artifact: stillOpen,
  });
  assert.equal(userDecision.verdict, "user_decision_required");
  assert.equal(userDecision.artifact.nextAction, "user_decision");
  assert.equal(userDecision.artifact.targetStep, "implement");
});

test("R9: post-hook carryover preserves reviewRetry evidence for manual retry reset workflows", () => {
  const fixture = prepareSpecRoot();
  const { flowState } = runFinalSemanticFail({ fixture });

  const retryCount = flowState.metrics.filter((entry) => entry.phase === "test" && entry.counter === "reviewRetry").length;
  assert.equal(retryCount, 10);
  assert.equal(readFlowFindingsArtifact(fixture.specDir).toJSON().entries.length, 1);
});
