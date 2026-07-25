/**
 * src/flow/lib/set-retry.js
 *
 * FlowCommand: `flow set retry reset <gate|review> <phase> --reason <text> --yes`.
 * Audited retry counter reset for both gateRetry (spec 209) and reviewRetry
 * (spec 253). Exhausted targets require changed evidence and grant exactly one
 * re-evaluation.
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { countGateRetry, resolveRetryMax } from "./run-gate.js";
import { countReviewRetry, resolveReviewRetryMax } from "./run-review.js";
import { flattenSteps } from "./step-tree.js";
import { resolveCurrentReviewTreeSha } from "./review-evidence-store.js";
import { ReviewRecoveryIdentity, ReviewSemanticRecoveryMutation, ReviewTargetState } from "./review-convergence.js";
import { resolveImplReviewScope } from "./task-scope.js";
import { buildRepairFingerprint } from "./impl-repair-artifacts.js";
import {
  RetryRecoveryInput,
  RetryRecoveryGrantError,
  applyRetryReset,
  resolveRecoveryMaxAttempts,
} from "./retry-recovery.js";

const COUNTER_BY_KIND = Object.freeze({
  gate: "gateRetry",
  review: "reviewRetry",
});
const COUNT_FN_BY_KIND = Object.freeze({
  gate: countGateRetry,
  review: countReviewRetry,
});
const MAX_FN_BY_KIND = Object.freeze({
  gate: resolveRetryMax,
  review: resolveReviewRetryMax,
});

function normalizeReviewResetPhase(phase) {
  if (phase === "draft-questions-review") return "draft-questions";
  if (phase === "draft-coverage-review") return "draft-coverage";
  return phase;
}

function resolveReviewResetPhases(ctx, phase) {
  const normalized = normalizeReviewResetPhase(phase);
  if (normalized !== "draft") return [normalized];
  const steps = Array.isArray(ctx.flowState?.steps) ? flattenSteps(ctx.flowState.steps) : [];
  const active = steps.find((step) => step.status === "in_progress");
  if (active?.id === "draft-questions-review") return ["draft-questions"];
  if (active?.id === "draft-coverage-review") return ["draft-coverage"];
  return ["draft-questions", "draft-coverage"];
}

class RetryResetOperation {
  constructor({ input, attemptsBefore, maxAttempts, afterReset = null }) {
    this.input = input;
    this.attemptsBefore = attemptsBefore;
    this.maxAttempts = maxAttempts;
    this.afterReset = afterReset;
    Object.freeze(this);
  }

  get phase() {
    return this.input.phase;
  }
}

function reviewRecoveryTaskId(flowState, phase) {
  if (phase !== "impl") return null;
  const scope = resolveImplReviewScope(flowState);
  if (scope.kind === "task") return scope.task.id;
  if (scope.kind === "flow" || scope.kind === "broad") return null;
  throw new Error(scope.reason || "review recovery scope could not be resolved");
}

function latestReviewConvergenceRecord(flowState, phase, taskId) {
  const records = Array.isArray(flowState?.reviewConvergence?.records)
    ? flowState.reviewConvergence.records
    : [];
  const matching = records.filter((record) => (
    record.phase === phase && (record.taskId ?? null) === taskId
  ));
  return matching[matching.length - 1] ?? null;
}

function currentReviewTargetState(ctx) {
  return ReviewTargetState.fromRepairFingerprint(buildRepairFingerprint({
    root: ctx.root,
    specPath: ctx.flowState.spec,
    state: ctx.flowState,
  }));
}

function currentReviewRecoveryIdentity(ctx, targetState) {
  return new ReviewRecoveryIdentity({
    treeSha: resolveCurrentReviewTreeSha(ctx.root),
    targetStateDigest: targetState.digest,
  });
}

function reviewTargetPathMatcher(flowState, phase) {
  if (phase === "impl") return () => true;
  const specPath = String(flowState.spec).replaceAll("\\", "/");
  const specDir = specPath.slice(0, specPath.lastIndexOf("/"));
  if (phase === "test") {
    return (candidate) => candidate === specPath || candidate.startsWith(`${specDir}/tests/`);
  }
  return (candidate) => candidate.startsWith(`${specDir}/`);
}

function unchangedReviewConvergenceTarget(ctx, phase, taskId, currentIdentity, currentTargetState) {
  const current = latestReviewConvergenceRecord(ctx.flowState, phase, taskId);
  if (!current) return false;
  const previousIdentity = new ReviewRecoveryIdentity({
    treeSha: current.treeSha,
    targetStateDigest: current.targetStateDigest,
  });
  if (!currentIdentity.changedFrom(previousIdentity)) return true;
  if (currentIdentity.treeSha !== previousIdentity.treeSha) return false;
  if (!current.targetState) return true;
  const previousTargetState = new ReviewTargetState(current.targetState);
  return !previousTargetState.hasChangedEntryWithin(
    currentTargetState,
    reviewTargetPathMatcher(ctx.flowState, phase),
  );
}

export default class SetRetryCommand extends FlowCommand {
  execute(ctx) {
    let input;
    try {
      input = new RetryRecoveryInput(ctx);
    } catch (err) {
      return Envelope.fail(
        "set",
        "retry",
        "INVALID_RECOVERY_INPUT",
        err.message,
      );
    }
    const { kind, phase } = input;
    const normalizedReviewPhase = kind === "review" ? normalizeReviewResetPhase(phase) : null;
    const reviewTaskId = kind === "review"
      ? reviewRecoveryTaskId(ctx.flowState, normalizedReviewPhase)
      : null;
    const resetPhases = kind === "review" ? resolveReviewResetPhases(ctx, phase) : [phase];
    const currentTargetState = kind === "review" ? currentReviewTargetState(ctx) : null;
    const currentIdentity = kind === "review"
      ? currentReviewRecoveryIdentity(ctx, currentTargetState)
      : null;
    if (
      kind === "review"
      && unchangedReviewConvergenceTarget(
        ctx,
        normalizedReviewPhase,
        reviewTaskId,
        currentIdentity,
        currentTargetState,
      )
    ) {
      return Envelope.fail(
        "set",
        "retry",
        "REVIEW_IDENTITY_UNCHANGED",
        "review retry reset requires a changed tree SHA or canonical evidence identity",
      );
    }

    const counter = COUNTER_BY_KIND[kind];
    const countFn = COUNT_FN_BY_KIND[kind];
    const resolveConfiguredMaxAttempts = MAX_FN_BY_KIND[kind];

    const operations = [];
    for (const p of resetPhases) {
      const phaseInput = input.phase === p
        ? input
        : new RetryRecoveryInput({
            action: input.action,
            kind: input.kind,
            phase: p,
            reason: input.reason,
            yes: input.yes,
          });
      const attemptsBefore = countFn(ctx.flowState?.metrics, p);
      const maxAttempts = resolveRecoveryMaxAttempts({
        root: ctx.root,
        flowState: ctx.flowState,
        kind,
        phase: p,
        attempts: attemptsBefore,
        resolvedMax: resolveConfiguredMaxAttempts({ flowState: ctx.flowState }, p),
      });
      const reviewRecord = kind === "review"
        ? latestReviewConvergenceRecord(ctx.flowState, p, reviewTaskId)
        : null;
      operations.push(new RetryResetOperation({
        input: phaseInput,
        attemptsBefore,
        maxAttempts,
        afterReset: reviewRecord == null
          ? null
          : new ReviewSemanticRecoveryMutation({
              phase: p,
              taskId: reviewTaskId,
              previousTreeSha: reviewRecord.treeSha,
              nextTreeSha: currentIdentity.treeSha,
              previousTargetStateDigest: reviewRecord.targetStateDigest,
              nextTargetStateDigest: currentIdentity.targetStateDigest,
              nextTargetState: currentTargetState.toJSON(),
              expectedRunId: ctx.flowState.runId,
              expectedSpec: ctx.flowState.spec,
              ...(Object.hasOwn(ctx.flowState, "issue") && {
                expectedIssue: ctx.flowState.issue,
              }),
            }),
      }));
    }

    const grants = [];
    for (const op of operations) {
      try {
        const reset = applyRetryReset({
          root: ctx.root,
          spec: ctx.flowState.spec,
          flowManager: ctx.flowManager,
          input: op.input,
          expectedAttempts: op.attemptsBefore,
          expectedMaxAttempts: op.maxAttempts,
          expectedRunId: ctx.flowState.runId,
          expectedHasIssue: Object.hasOwn(ctx.flowState, "issue"),
          expectedIssue: ctx.flowState.issue,
          resolveConfiguredMaxAttempts(state, targetPhase) {
            return resolveConfiguredMaxAttempts({ flowState: state }, targetPhase);
          },
          afterReset: op.afterReset == null
            ? null
            : (flowState) => op.afterReset.apply(flowState),
        });
        if (reset.grant) grants.push(reset.grant.toJSON());
      } catch (error) {
        if (!(error instanceof RetryRecoveryGrantError)) throw error;
        return Envelope.fail(
          "set",
          "retry",
          error.code,
          error.message,
          error.data,
        );
      }
    }

    return { action: input.action, kind, phase, phases: resetPhases, counter, reset: true, grants };
  }
}
