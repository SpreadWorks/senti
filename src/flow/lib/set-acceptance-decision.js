import { FlowCommand } from "./base-command.js";
import { CanonicalAcceptanceDecision } from "./canonical-acceptance-artifacts.js";

export default class SetAcceptanceDecisionCommand extends FlowCommand {
  execute(ctx) {
    const choice = ctx.choice;
    if (!choice) throw new Error("usage: flow set acceptance-decision --choice <choice>");
    const state = ctx.flowManager.load();
    if (state?.schemaRevision !== 3) {
      throw new Error("acceptance decision requires a Version-1 Flow");
    }
    const result = new CanonicalAcceptanceDecision({
      flowManager: ctx.flowManager,
      state,
      choice,
    }).resolve();
    ctx.flowManager.updateStepStatus({
      stepId: "acceptance-decision",
      requestedStatus: "done",
    }, {
      specId: state.specId,
      canonicalCommandResult: result,
    });
    if (choice === "accept_risk_and_continue") {
      ctx.flowManager.updateStepStatus({
        stepId: "final-regression",
        requestedStatus: "in_progress",
      }, { specId: state.specId });
    } else {
      ctx.flowManager.parkFlow(state.specId);
    }
    return result;
  }
}
