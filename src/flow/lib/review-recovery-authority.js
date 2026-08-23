import { countReviewAttempts } from "../definition.js";
import { resolveRecoveryMaxAttempts } from "./retry-recovery.js";

export function assertReviewRecoveryAuthority({ root, flowState, phase, resolvedMax }) {
  return resolveRecoveryMaxAttempts({
    root,
    flowState,
    kind: "review",
    phase,
    attempts: countReviewAttempts(flowState.metrics, phase),
    resolvedMax,
  });
}
