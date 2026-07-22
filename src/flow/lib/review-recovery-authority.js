import { countReviewRetry } from "./run-review.js";
import { resolveRecoveryMaxAttempts } from "./retry-recovery.js";

export function assertReviewRecoveryAuthority({ root, flowState, phase, resolvedMax }) {
  return resolveRecoveryMaxAttempts({
    root,
    flowState,
    kind: "review",
    phase,
    attempts: countReviewRetry(flowState.metrics, phase),
    resolvedMax,
  });
}
