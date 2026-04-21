/**
 * src/flow/lib/set-metric.js
 *
 * Append a metric entry to state.metrics (append-only array).
 *
 * ctx.phase   — one of VALID_PHASES (see constants.js)
 * ctx.counter — one of VALID_METRIC_COUNTERS (see constants.js)
 * ctx.taskId  — optional explicit taskId (overrides active-task inference)
 */

import { FlowCommand, resolveExplicitTaskOption } from "./base-command.js";
import { VALID_PHASES, VALID_METRIC_COUNTERS } from "../../lib/constants.js";

export default class SetMetricCommand extends FlowCommand {
  execute(ctx) {
    const { phase, counter } = ctx;

    if (!phase || !counter) {
      throw new Error("usage: flow set metric <phase> <counter> [--task-id <id>]");
    }

    if (!VALID_PHASES.includes(phase)) {
      throw new Error(`invalid phase: ${phase} (valid: ${VALID_PHASES.join(", ")})`);
    }

    if (!VALID_METRIC_COUNTERS.includes(counter)) {
      throw new Error(`invalid counter: ${counter} (valid: ${VALID_METRIC_COUNTERS.join(", ")})`);
    }

    ctx.flowManager.incrementMetric(phase, counter, resolveExplicitTaskOption(ctx));

    return { phase, counter };
  }
}
