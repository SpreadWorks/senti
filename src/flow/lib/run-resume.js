/**
 * src/flow/lib/run-resume.js
 *
 * Resume command — discover and return context of the active flow.
 * Uses the shared resolveActiveFlow() helper for 3-stage fallback discovery.
 * Returns the same data structure as get-resolve-context for consistency.
 */

import { FlowCommand } from "./base-command.js";
import { buildResolvedFlowContext } from "./resolve-context-envelope.js";

export default class RunResumeCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  execute(ctx) {
    const base = buildResolvedFlowContext(ctx);
    const state = ctx.flowManager.resolveActiveFlow(ctx.flowState).state;
    return {
      ...base,
      runId: state.runId || null,
      lifecycle: state.lifecycle || null,
    };
  }
}
