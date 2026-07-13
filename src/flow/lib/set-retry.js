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
import { clearReviewStopState } from "./review-failure.js";
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
  constructor({ input, attemptsBefore, maxAttempts }) {
    this.input = input;
    this.attemptsBefore = attemptsBefore;
    this.maxAttempts = maxAttempts;
    Object.freeze(this);
  }

  get phase() {
    return this.input.phase;
  }
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

    const counter = COUNTER_BY_KIND[kind];
    const countFn = COUNT_FN_BY_KIND[kind];
    const resolveConfiguredMaxAttempts = MAX_FN_BY_KIND[kind];
    const resetPhases = kind === "review" ? resolveReviewResetPhases(ctx, phase) : [phase];

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
        flowState: ctx.flowState,
        kind,
        phase: p,
        attempts: attemptsBefore,
        resolvedMax: resolveConfiguredMaxAttempts({ flowState: ctx.flowState }, p),
      });
      operations.push(new RetryResetOperation({
        input: phaseInput,
        attemptsBefore,
        maxAttempts,
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
          afterReset: kind === "review"
            ? (state) => clearReviewStopState(state, op.phase)
            : null,
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
