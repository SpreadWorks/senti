import { FlowCommand } from "./base-command.js";
import { activateNonBlockingPolicy } from "./nonblocking.js";

export default class SetPolicyCommand extends FlowCommand {
  execute(ctx) {
    if (ctx.value !== "nonblocking") throw new Error("usage: senti flow set policy nonblocking --reason <text>");
    return activateNonBlockingPolicy({ root: ctx.root, flowManager: ctx.flowManager, reason: ctx.reason });
  }
}
