/** Version-1 entry point for an explicit retry Attempt transition. */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import {
  CanonicalRetryRecovery,
  RetryRecoveryInput,
} from "./retry-recovery.js";

export default class SetRetryCommand extends FlowCommand {
  execute(ctx) {
    let request;
    try {
      request = new RetryRecoveryInput(ctx);
    } catch (error) {
      return Envelope.fail("set", "retry", "INVALID_RECOVERY_INPUT", error.message);
    }

    try {
      const grant = new CanonicalRetryRecovery({
        flowManager: ctx.flowManager,
        state: ctx.flowState,
        request,
      }).apply();
      return {
        action: request.action,
        kind: request.kind,
        phase: request.phase,
        reset: true,
        grants: [grant.toJSON()],
      };
    } catch (error) {
      return Envelope.fail("set", "retry", "RETRY_NOT_AVAILABLE", error.message);
    }
  }
}
