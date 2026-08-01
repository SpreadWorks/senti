// spec: R13
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { FlowTargetBinding } from "../../../src/lib/flow-target-guard.js";
import {
  resolveReviewActionForFlowState,
  ReviewToolingRecoveryMutation,
} from "../../../src/flow/lib/review-convergence.js";
import {
  createTmpDir,
  removeTmpDir,
} from "../../../tests/helpers/tmp-dir.js";

const TREE_SHA = "a".repeat(40);
const TARGET_DIGEST = "b".repeat(64);
const CHANGED_DIGEST = "c".repeat(64);
const CHANGED_TREE_SHA = "d".repeat(40);
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeTmpDir(root);
});

function fixture() {
  const root = createTmpDir("spec-482-provider-recovery-");
  roots.push(root);
  const flowState = {
    runId: "provider-recovery-run",
    issue: 483,
    spec: "specs/482-cli-target-binding/spec.json",
    featureBranch: "feature/482-cli-target-binding",
    baseBranch: "main",
    worktree: false,
  };
  const target = {
    flowState,
    mode: "branch",
    mainRoot: root,
    authorityRoot: root,
    invocationRoot: root,
  };
  const binding = FlowTargetBinding.capture(target);
  flowState.reviewConvergence = {
    version: 1,
    records: [{
      phase: "spec",
      taskId: null,
      treeSha: TREE_SHA,
      targetStateDigest: TARGET_DIGEST,
      targetBindingDigest: binding.digest,
      semanticAttempts: 0,
      semanticMaxAttempts: 4,
      toolingAttempts: 1,
      toolingMaxAttempts: 1,
      evidence: null,
      finalizedEvidenceAvailable: false,
      handoffFindings: [],
      blocker: {
        kind: "tooling_attempts_exhausted",
        reason: "provider-error",
      },
      toolingOutcome: {
        kind: "TOOLING_ERROR",
        stage: "communication",
        attempt: 2,
        maxAttempts: 2,
        remainingAttempts: 0,
        reason: "provider-error",
        permissionRelated: false,
      },
      provider: "provider-neutral",
    }],
  };
  return { flowState, binding, target };
}

function recovery(flowState, targetStateDigest = CHANGED_DIGEST) {
  return ReviewToolingRecoveryMutation.forExhaustedAttempt({
    reviewRecord: flowState.reviewConvergence.records[0],
    phase: "spec",
    taskId: null,
    flowState,
    nextTreeSha: CHANGED_TREE_SHA,
    nextTargetStateDigest: targetStateDigest,
    nextTargetState: {
      digest: targetStateDigest,
      entries: [{
        path: "src/flow/lib/review-convergence.js",
        contentHash: targetStateDigest,
        mode: "100644",
      }],
    },
  });
}

test("R13: stale digest suppresses an old blocker instead of reusing it", () => {
  const { flowState } = fixture();

  const action = resolveReviewActionForFlowState(flowState, {
    phase: "spec",
    resolveTreeSha: () => TREE_SHA,
    resolveTargetStateDigest: () => CHANGED_DIGEST,
  });

  assert.equal(action, null);
});

test("R13: unchanged input receives one audited recovery per dispatcher invocation", () => {
  const { flowState, binding } = fixture();
  const first = recovery(flowState).apply(flowState);

  assert.equal(first.treeSha, CHANGED_TREE_SHA);
  assert.equal(first.toolingAttempts, 0);
  assert.equal(flowState.reviewConvergence.records[0].targetBindingDigest, binding.digest);
  assert.equal(flowState.reviewConvergence.records[0].targetStateDigest, CHANGED_DIGEST);

  const record = flowState.reviewConvergence.records[0];
  assert.equal(ReviewToolingRecoveryMutation.forExhaustedAttempt({
    reviewRecord: record,
    phase: "spec",
    taskId: null,
    flowState,
    nextTreeSha: CHANGED_TREE_SHA,
    nextTargetStateDigest: CHANGED_DIGEST,
  }), null);
});
