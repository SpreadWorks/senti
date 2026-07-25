import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveReviewActionForFlowState } from "../../../src/flow/lib/review-convergence.js";

const CURRENT_TREE_SHA = "a".repeat(40);
const STALE_TREE_SHA = "b".repeat(40);

function toolingRecord({
  treeSha,
  attempt,
  toolingAttempts,
  reason,
}) {
  return {
    phase: "test",
    taskId: null,
    treeSha,
    semanticAttempts: 0,
    semanticMaxAttempts: 4,
    toolingAttempts,
    toolingMaxAttempts: 1,
    evidence: null,
    finalizedEvidenceAvailable: false,
    handoffFindings: [],
    blocker: null,
    toolingOutcome: {
      kind: "TOOLING_ERROR",
      stage: "result_recording",
      attempt,
      maxAttempts: 2,
      remainingAttempts: 2 - attempt,
      reason,
      permissionRelated: false,
    },
  };
}

describe("review convergence action target identity", () => {
  it("preserves phase and task resolution when no tree resolver is supplied", () => {
    const flowState = {
      reviewConvergence: {
        version: 1,
        records: [toolingRecord({
          treeSha: STALE_TREE_SHA,
          attempt: 2,
          toolingAttempts: 1,
          reason: "legacy caller tooling failure",
        })],
      },
    };

    const action = resolveReviewActionForFlowState(flowState, { phase: "test" });

    assert.equal(action.kind, "stop_as_blocker");
    assert.equal(action.remainingToolingAttempts, 0);
  });

  it("does not project an exhausted action from a stale tree", () => {
    const flowState = {
      reviewConvergence: {
        version: 1,
        records: [toolingRecord({
          treeSha: STALE_TREE_SHA,
          attempt: 2,
          toolingAttempts: 1,
          reason: "stale tooling failure",
        })],
      },
    };

    const action = resolveReviewActionForFlowState(flowState, {
      phase: "test",
      resolveTreeSha: () => CURRENT_TREE_SHA,
    });

    assert.equal(action, null);
  });

  it("preserves the exhausted action for the current tree", () => {
    const flowState = {
      reviewConvergence: {
        version: 1,
        records: [toolingRecord({
          treeSha: CURRENT_TREE_SHA,
          attempt: 2,
          toolingAttempts: 1,
          reason: "current tooling failure",
        })],
      },
    };

    const action = resolveReviewActionForFlowState(flowState, {
      phase: "test",
      resolveTreeSha: () => CURRENT_TREE_SHA,
    });

    assert.equal(action.kind, "stop_as_blocker");
    assert.equal(action.remainingToolingAttempts, 0);
  });

  it("selects the current tree even when a stale record was appended later", () => {
    const flowState = {
      reviewConvergence: {
        version: 1,
        records: [
          toolingRecord({
            treeSha: CURRENT_TREE_SHA,
            attempt: 1,
            toolingAttempts: 0,
            reason: "current retryable failure",
          }),
          toolingRecord({
            treeSha: STALE_TREE_SHA,
            attempt: 2,
            toolingAttempts: 1,
            reason: "later stale failure",
          }),
        ],
      },
    };

    const action = resolveReviewActionForFlowState(flowState, {
      phase: "test",
      resolveTreeSha: () => CURRENT_TREE_SHA,
    });

    assert.equal(action.kind, "retry_review");
    assert.equal(action.budgetKind, "tooling");
    assert.equal(action.remainingToolingAttempts, 1);
  });
});
