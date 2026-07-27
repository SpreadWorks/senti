import { Envelope } from "../../lib/flow-envelope.js";
import {
  FlowContinuation,
  guardFlagsForState,
} from "./user-action-prompt.js";

function fallbackContinuation(state, error) {
  if (error?.continuation) return FlowContinuation.fromStored(error.continuation);
  const guards = guardFlagsForState(state || {});
  return new FlowContinuation({
    actionId: "REFRESH_NONBLOCKING_FLOW",
    nextAction: `senti flow get next-action ${guards}`.trim(),
    instruction: "Refresh the guarded normal Flow action before retrying the nonblocking operation.",
    reason: error?.message || "The nonblocking operation did not complete.",
  });
}

export function nonblockingFailureEnvelope({ type, key, error, state }) {
  const continuation = fallbackContinuation(state, error);
  return Envelope.fail(
    type,
    key,
    error?.code || "NONBLOCKING_OPERATION_FAILED",
    error?.message || "The nonblocking operation did not complete.",
    {
      ...(error?.context && { nonblockingDecision: error.context }),
      ...(error?.existingDecision && { existingDecision: error.existingDecision }),
      continuation: continuation.toJSON(),
    },
  );
}
