import { FlowCommand } from "./base-command.js";
import { recordNonBlockingDecision } from "./nonblocking.js";
import { nonblockingFailureEnvelope } from "./nonblocking-command-failure.js";

export default class SetNonBlockingDecisionCommand extends FlowCommand {
  execute(ctx) {
    try {
      return recordNonBlockingDecision({
        root: ctx.root,
        flowManager: ctx.flowManager,
        choice: ctx.choice,
        reason: ctx.reason,
        expectEvidenceDigest: ctx.expectEvidenceDigest,
        remainingRisk: ctx.remainingRisk,
      });
    } catch (error) {
      return nonblockingFailureEnvelope({
        type: "set",
        key: "nonblocking-decision",
        error,
        state: ctx.flowState,
      });
    }
  }
}
