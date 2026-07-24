/**
 * src/flow/lib/run-resume.js
 *
 * Resume command — return context for an active flow.
 * Normal resume is registry-backed; --parked is the only path that restores
 * an inactive managed-worktree pointer.
 */

import { FlowCommand } from "./base-command.js";
import { buildResolvedFlowContext } from "./resolve-context-envelope.js";
import { ParkedFlowIdentity } from "../../lib/flow-manager.js";

export default class RunResumeCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  async run(container, input = {}) {
    if (input.parked === true) {
      // Parked recovery must not run ambient flow discovery or reconcile a
      // pending worktree identity transition before the owned validation.
      this.container = container;
      return this.execute({ ...input, flowManager: container.get("flowManager") });
    }
    return super.run(container, input);
  }

  execute(ctx) {
    if (ctx.parked === true) {
      const identity = new ParkedFlowIdentity(ctx);
      return ctx.flowManager.resumeParkedFlow(identity).toJSON();
    }

    const base = buildResolvedFlowContext(ctx);
    const state = ctx.flowManager.resolveActiveFlow(ctx.flowState, {
      selectSpecId: ctx.spec || undefined,
    }).state;
    return {
      ...base,
      runId: state.runId || null,
    };
  }
}
