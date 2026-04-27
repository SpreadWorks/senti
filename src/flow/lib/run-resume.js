/**
 * src/flow/lib/run-resume.js
 *
 * Resume command — discover and return context of the active flow.
 * Uses the shared resolve-context envelope so the output stays in lockstep
 * with `flow get resolve-context`.
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
    };
  }
}
