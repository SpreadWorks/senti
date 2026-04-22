/**
 * src/flow/lib/set-gate-retry.js
 *
 * FlowCommand: `flow set gate-retry reset <phase> --yes`.
 * Clears the per-phase gateRetry counter by appending a reset metric entry
 * (spec 209). Only `task-impl` and `integration` — the phases tracked by
 * `RETRY_TRACKED_PHASES` — are valid targets.
 */

import { FlowCommand } from "./base-command.js";
import { countGateRetry } from "./run-gate.js";
import { Envelope } from "../../lib/flow-envelope.js";

const VALID_ACTIONS = Object.freeze(["reset"]);
const RESET_TRACKED_PHASES = Object.freeze(["task-impl", "integration"]);

export default class SetGateRetryCommand extends FlowCommand {
  execute(ctx) {
    const { action, phase } = ctx;

    if (!action || !phase) {
      return Envelope.fail(
        "set",
        "gate-retry",
        "INVALID_USAGE",
        "usage: flow set gate-retry <action> <phase> --yes",
      );
    }
    if (!VALID_ACTIONS.includes(action)) {
      return Envelope.fail(
        "set",
        "gate-retry",
        "INVALID_ARG_VALUE",
        `invalid action: ${action} (valid: ${VALID_ACTIONS.join(", ")})`,
      );
    }
    if (!RESET_TRACKED_PHASES.includes(phase)) {
      return Envelope.fail(
        "set",
        "gate-retry",
        "INVALID_PHASE",
        `invalid phase: ${phase} (valid: ${RESET_TRACKED_PHASES.join(", ")})`,
      );
    }

    if (!ctx.yes) {
      const state = ctx.flowState;
      const current = countGateRetry(state?.metrics, phase);
      process.stderr.write(
        `[sdd-forge] current gateRetry count for phase "${phase}": ${current}\n` +
          "[sdd-forge] pass --yes to confirm the reset.\n",
      );
      return Envelope.fail(
        "set",
        "gate-retry",
        "CONFIRMATION_REQUIRED",
        "--yes is required to reset gateRetry",
      );
    }

    ctx.flowManager.appendMetric({
      phase,
      counter: "gateRetry",
      delta: 0,
      reset: true,
    });

    return { action, phase, reset: true };
  }
}
