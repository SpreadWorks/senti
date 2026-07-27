import { FlowCommand } from "./base-command.js";
import {
  activateNonBlockingPolicy,
} from "./nonblocking.js";
import { nonblockingFailureEnvelope } from "./nonblocking-command-failure.js";

export default class SetPolicyCommand extends FlowCommand {
  execute(ctx) {
    if (ctx.value !== "nonblocking") throw new Error("usage: senti flow set policy nonblocking --reason <text>");
    try {
      return activateNonBlockingPolicy({ root: ctx.root, flowManager: ctx.flowManager, reason: ctx.reason });
    } catch (error) {
      return nonblockingFailureEnvelope({
        type: "set",
        key: "policy",
        error,
        state: ctx.flowState,
      });
    }
  }
}
