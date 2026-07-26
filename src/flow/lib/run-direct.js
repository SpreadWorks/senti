import { FlowCommand } from "./base-command.js";
import { runDirectFlowAction } from "./direct-flow-controller.js";

export default class RunDirectCommand extends FlowCommand {
  constructor() {
    super({
      requiresFlow: false,
      explicitTargetResolution: true,
    });
  }

  execute(ctx) {
    return runDirectFlowAction(ctx, ctx);
  }
}
