/**
 * src/flow/lib/get-qa-count.js
 *
 * Return the number of answered questions in draft phase.
 */

import { FlowCommand } from "./base-command.js";
import { buildMetricsSummary } from "./get-status.js";

export default class GetQaCountCommand extends FlowCommand {
  execute(ctx) {
    const summary = buildMetricsSummary(ctx.flowState.metrics || []);
    const count = summary.total?.draft?.question ?? 0;

    return { count };
  }
}
