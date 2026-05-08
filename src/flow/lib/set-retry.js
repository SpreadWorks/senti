/**
 * src/flow/lib/set-retry.js
 *
 * FlowCommand: `flow set retry reset <gate|review> <phase> --yes`.
 * Generic retry counter reset for both gateRetry (spec 209) and reviewRetry
 * (spec 253). Replaces the legacy `flow set gate-retry reset` form (no alias
 * per alpha policy).
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { countGateRetry } from "./run-gate.js";
import { countReviewRetry } from "./run-review.js";

const VALID_ACTIONS = Object.freeze(["reset"]);
const VALID_KINDS = Object.freeze(["gate", "review"]);
const PHASES_BY_KIND = Object.freeze({
  gate: ["task-impl", "integration"],
  review: ["draft", "spec", "test", "impl"],
});
const COUNTER_BY_KIND = Object.freeze({
  gate: "gateRetry",
  review: "reviewRetry",
});
const COUNT_FN_BY_KIND = Object.freeze({
  gate: countGateRetry,
  review: countReviewRetry,
});

export default class SetRetryCommand extends FlowCommand {
  execute(ctx) {
    const { action, kind, phase } = ctx;

    if (!action || !kind || !phase) {
      return Envelope.fail(
        "set",
        "retry",
        "INVALID_USAGE",
        "usage: flow set retry <action> <kind> <phase> --yes",
      );
    }
    if (!VALID_ACTIONS.includes(action)) {
      return Envelope.fail(
        "set",
        "retry",
        "INVALID_ACTION",
        `invalid action: ${action} (valid: ${VALID_ACTIONS.join(", ")})`,
      );
    }
    if (!VALID_KINDS.includes(kind)) {
      return Envelope.fail(
        "set",
        "retry",
        "INVALID_KIND",
        `invalid kind: ${kind} (valid: ${VALID_KINDS.join(", ")})`,
      );
    }
    const validPhases = PHASES_BY_KIND[kind];
    if (!validPhases.includes(phase)) {
      return Envelope.fail(
        "set",
        "retry",
        "INVALID_PHASE",
        `invalid phase for kind=${kind}: ${phase} (valid: ${validPhases.join(", ")})`,
      );
    }

    const counter = COUNTER_BY_KIND[kind];
    const countFn = COUNT_FN_BY_KIND[kind];

    if (!ctx.yes) {
      const state = ctx.flowState;
      const current = countFn(state?.metrics, phase);
      process.stderr.write(
        `[sdd-forge] current ${counter} count for phase "${phase}": ${current}\n` +
          "[sdd-forge] pass --yes to confirm the reset.\n",
      );
      return Envelope.fail(
        "set",
        "retry",
        "CONFIRMATION_REQUIRED",
        "--yes is required to reset the counter",
      );
    }

    ctx.flowManager.appendMetric(
      { phase, counter, delta: 0, reset: true },
      { taskId: null }, // R19: explicit flow-scope
    );

    return { action, kind, phase, counter, reset: true };
  }
}
