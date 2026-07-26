import { FlowCommand } from "./base-command.js";
import { getDirectFlowAction } from "./direct-flow-controller.js";

export default class GetDirectCommand extends FlowCommand {
  constructor() {
    super({
      requiresFlow: false,
      explicitTargetResolution: true,
    });
  }

  execute(ctx) {
    return getDirectFlowAction(ctx);
  }
}
