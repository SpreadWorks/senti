// spec: R5 R6 R7
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  applyReviewEvidenceTransition,
  ReviewDisposition,
  ReviewEvidence,
  ReviewFinding,
} from "../../../src/flow/lib/review-convergence.js";
import {
  persistReviewPostHookToolingFailure,
  checkReviewRetryBelowMax,
} from "../../../src/flow/lib/run-review.js";
import {
  readFlowFindingsArtifact,
} from "../../../src/flow/lib/flow-findings.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";
import {
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
  setupFlowConfig,
} from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const specId = "329-review-completion-scope";
const specPath = `specs/${specId}/spec.json`;
const taskId = "T-default";

function createFixture(t, stepId) {
  const root = createTmpDir("review-completion-scope-");
  t.after(() => removeTmpDir(root));
  initGitRepo(root);
  setupFlowConfig(root, "en");
  fs.mkdirSync(path.join(root, "specs", specId), { recursive: true });
  fs.writeFileSync(path.join(root, specPath), `${JSON.stringify({
    requirements: [],
    user_approval: { approved: true },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "product.js"), "export const value = 1;\n");
  commitAll(root, "initial review target");

  const state = moveFlowToStep(makeFlowState({
    spec: specPath,
    runId: "run-review-completion-scope",
    issue: 453,
    baseBranch: "main",
    featureBranch: "main",
    currentTaskId: taskId,
  }), stepId);
  const flowManager = makeFlowManager(root);
  flowManager.create(state);
  return {
    root,
    flowManager,
    context: {
      root,
      phase: stepId === "test-review" ? "test" : "impl",
      flowState: flowManager.load(),
      flowManager,
    },
  };
}

function records(flowManager) {
  return flowManager.load().reviewConvergence?.records || [];
}

test("R5: flow-level test post-hook ignores a residual task cursor", (t) => {
  const fixture = createFixture(t, "test-review");
  const result = { artifacts: { phase: "test", taskId: "stale-task-scope" } };

  persistReviewPostHookToolingFailure(
    fixture.context,
    result,
    new Error("test review post hook failed"),
  );

  assert.equal(records(fixture.flowManager).length, 1);
  assert.equal(records(fixture.flowManager)[0].taskId, null);
  assert.equal(result.artifacts.toolingOutcome.kind, "TOOLING_ERROR");
});

test("R5: flow-level impl post-hook preserves an explicit null task scope", (t) => {
  const fixture = createFixture(t, "impl-review");
  const result = { artifacts: { phase: "impl", taskId: null } };

  persistReviewPostHookToolingFailure(
    fixture.context,
    result,
    new Error("flow impl review post hook failed"),
  );

  assert.equal(records(fixture.flowManager).length, 1);
  assert.equal(records(fixture.flowManager)[0].taskId, null);
});

test("R5: exhausted flow evidence creates one handoff and rejects identical reprocessing", () => {
  const treeSha = "4".repeat(40);
  const findings = [
    new ReviewFinding({
      findingId: "flow-finding-1",
      summary: "Flow-level identity finding remains at exhaustion.",
      fingerprint: "5".repeat(64),
      evidenceRefs: ["test-review.json#flow-finding-1"],
    }),
    new ReviewFinding({
      findingId: "flow-finding-2",
      summary: "Flow-level scope finding remains at exhaustion.",
      fingerprint: "6".repeat(64),
      evidenceRefs: ["test-review.json#flow-finding-2"],
    }),
  ];
  const evidence = new ReviewEvidence({
    phase: "test",
    taskId: null,
    treeSha,
    provenance: {
      provider: "independent-reviewer",
      invocationId: "flow-exhaustion",
      capturedAt: "2026-07-24T00:00:00.000Z",
    },
    disposition: new ReviewDisposition({
      value: "REJECTED",
      blockingFindings: findings,
    }),
  });
  const state = {
    currentTaskId: taskId,
    reviewConvergence: { version: 1, records: [] },
  };

  applyReviewEvidenceTransition(state, evidence, {
    configuredSemanticMaxAttempts: 1,
    provider: "independent-reviewer",
  });
  assert.equal(state.reviewConvergence.records.length, 1);
  assert.equal(state.reviewConvergence.records[0].taskId, null);
  assert.equal(state.currentTaskId, taskId);
  assert.equal(state.reviewConvergence.records[0].semanticAttempts, 1);
  assert.deepEqual(
    state.reviewConvergence.records[0].handoffFindings.map(({ findingId }) => findingId),
    ["flow-finding-1", "flow-finding-2"],
  );

  const afterFirst = structuredClone(state);
  assert.throws(
    () => applyReviewEvidenceTransition(state, evidence, {
      configuredSemanticMaxAttempts: 1,
      provider: "independent-reviewer",
    }),
    /duplicate/i,
  );
  assert.deepEqual(state, afterFirst);
});

test("R5: exhausted flow findings persist once per identity despite a residual task cursor", (t) => {
  const fixture = createFixture(t, "test-review");
  const specDir = path.join(fixture.root, "specs", specId);
  const findings = [
    {
      findingId: "flow-finding-1",
      fingerprint: "7".repeat(64),
      disposition: "must-fix",
      failureMode: "identity_collision",
      category: "semantic",
      title: "Distinct flow finding identity is required.",
      reason: "The first flow finding must be handed off.",
      rationale: "The finding blocks a mandatory requirement.",
    },
    {
      findingId: "flow-finding-2",
      fingerprint: "8".repeat(64),
      disposition: "must-fix",
      failureMode: "scope_mismatch",
      category: "semantic",
      title: "Flow completion scope must remain null.",
      reason: "The second flow finding must be handed off.",
      rationale: "The finding blocks a mandatory requirement.",
    },
  ];
  fs.writeFileSync(path.join(specDir, "test-review.json"), `${JSON.stringify({
    verdict: "REJECTED",
    blockingFindings: findings,
  }, null, 2)}\n`);
  const flowState = fixture.flowManager.load();
  flowState.currentTaskId = taskId;
  flowState.metrics = Array.from({ length: 5 }, () => ({
    phase: "test",
    counter: "reviewRetry",
    delta: 1,
    taskId: null,
  }));
  const flowManager = {
    updateStepStatus() {},
  };
  const defer = () => checkReviewRetryBelowMax({
    root: fixture.root,
    flowState,
    flowManager,
  }, "test");

  assert.equal(defer()?.artifacts?.completionKind, "deferred");
  assert.equal(defer()?.artifacts?.completionKind, "deferred");
  const persisted = readFlowFindingsArtifact(specDir).toJSON().entries;
  assert.deepEqual(
    persisted.map(({ sourceFindingId }) => sourceFindingId).sort(),
    ["flow-finding-1", "flow-finding-2"],
  );
  assert.equal(persisted.every(({ taskId: persistedTaskId }) => persistedTaskId == null), true);
});

test("R6: task-level post-hook retains its task without changing flow lifecycle state", (t) => {
  const fixture = createFixture(t, "impl-review");
  const before = fixture.flowManager.load();
  const result = { artifacts: { phase: "impl", taskId } };

  persistReviewPostHookToolingFailure(
    fixture.context,
    result,
    new Error("task review post hook failed"),
  );

  const after = fixture.flowManager.load();
  assert.equal(records(fixture.flowManager).length, 1);
  assert.equal(records(fixture.flowManager)[0].taskId, taskId);
  assert.equal(after.currentTaskId, taskId);
  assert.deepEqual(after.steps, before.steps);
  assert.equal(fs.existsSync(path.join(fixture.root, "specs", specId, "flow-findings.json")), false);
});
