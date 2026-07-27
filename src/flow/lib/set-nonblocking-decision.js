import { FlowCommand } from "./base-command.js";
import { recordNonBlockingDecision } from "./nonblocking.js";
import { Envelope } from "../../lib/flow-envelope.js";

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
      if (error.code !== "NONBLOCKING_STALE_EVIDENCE") throw error;
      return Envelope.fail(
        "set",
        "nonblocking-decision",
        error.code,
        error.message,
        { nonblockingDecision: error.context, continuation: error.continuation },
      );
    }
  }
}
