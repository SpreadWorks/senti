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
  applyRetryRecoveryGrant,
  buildRecoveryEligibilityForState,
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

function rollbackLoadOnlyRunIdMigration(ctx) {
  ctx.flowManager?.rollbackLastRunIdMigration?.();
}

class RetryResetOperation {
  constructor({ input, attemptsBefore, maxAttempts, eligibility = null }) {
    this.input = input;
    this.attemptsBefore = attemptsBefore;
    this.maxAttempts = maxAttempts;
    this.eligibility = eligibility;
    this.exhausted = eligibility != null;
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
      rollbackLoadOnlyRunIdMigration(ctx);
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
      let eligibility = null;
      if (attemptsBefore >= maxAttempts) {
        eligibility = buildRecoveryEligibilityForState({
          root: ctx.root,
          flowState: ctx.flowState,
          kind,
          phase: p,
          attempts: attemptsBefore,
          maxAttempts,
        });
        if (eligibility.recoverable !== true) {
          rollbackLoadOnlyRunIdMigration(ctx);
          return Envelope.fail(
            "set",
            "retry",
            String(eligibility.reason || "recovery-not-eligible").replace(/-/g, "_").toUpperCase(),
            `retry recovery rejected for ${kind}/${p}: ${eligibility.reason}`,
            { kind, phase: p, attempts: attemptsBefore, max: maxAttempts, reason: eligibility.reason },
          );
        }
      }
      operations.push(new RetryResetOperation({
        input: phaseInput,
        attemptsBefore,
        maxAttempts,
        eligibility,
      }));
    }

    const grants = [];
    for (const op of operations) {
      if (op.exhausted) {
        const grant = applyRetryRecoveryGrant({
          root: ctx.root,
          spec: ctx.flowState.spec,
          flowState: ctx.flowManager.load(),
          input: op.input,
          eligibility: op.eligibility,
          attemptsBefore: op.attemptsBefore,
          maxAttempts: op.maxAttempts,
        });
        grants.push(grant.toJSON());
      } else {
        ctx.flowManager.appendMetric(
          { phase: op.phase, counter, delta: 0, reset: true },
          { taskId: null },
        );
      }
    }
    if (kind === "review") {
      ctx.flowManager.mutate((state) => {
        for (const p of resetPhases) clearReviewStopState(state, p);
      });
    }

    return { action: input.action, kind, phase, phases: resetPhases, counter, reset: true, grants };
  }
}
