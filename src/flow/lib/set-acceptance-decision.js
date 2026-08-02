import { FlowCommand } from "./base-command.js";
import { applyAcceptanceDecision } from "./acceptance-review-artifacts.js";

export default class SetAcceptanceDecisionCommand extends FlowCommand {
  execute(ctx) {
    const choice = ctx.choice;
    if (!choice) throw new Error("usage: flow set acceptance-decision --choice <choice>");
    return applyAcceptanceDecision({
      root: ctx.root,
      executionRoot: ctx.executionRoot || ctx.root,
      flowManager: ctx.flowManager,
      choice,
    });
  }
}
