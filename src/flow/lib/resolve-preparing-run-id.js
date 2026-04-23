/**
 * src/flow/lib/resolve-preparing-run-id.js
 *
 * Shared helper: resolve a preparing-flow target from an optional --run-id.
 *
 * Resolution rules:
 *   - explicitRunId given: validate shape and existence; return the id or a
 *     structured fail envelope if invalid / unknown.
 *   - no explicitRunId: auto-detect when exactly one preparing flow exists;
 *     return null runId when zero exist; fail when multiple exist.
 *
 * Per-caller differences are limited to the envelope's `type`, `key`, and the
 * error code returned for the zero-preparing case. `set auto` treats "no
 * active flow and no preparing flow" as a hard error (NO_FLOW), whereas
 * `run auto-check` treats it as "no preparing target to persist to" and
 * returns `runId: null` so the command completes without persistence.
 */

import { Envelope } from "../../lib/flow-envelope.js";

export function resolvePreparingRunId(flowManager, explicitRunId, opts) {
  const type = opts?.type ?? "run";
  const key = opts?.key ?? "auto-check";
  const zeroPreparingAsFail = !!opts?.zeroPreparingAsFail;
  const ids = flowManager.listPreparingFlows();

  if (explicitRunId) {
    if (typeof explicitRunId !== "string" || !explicitRunId.trim()) {
      return {
        fail: Envelope.fail(type, key, "INVALID_USAGE", "--run-id must be a non-empty string"),
      };
    }
    if (!ids.includes(explicitRunId)) {
      return {
        fail: Envelope.fail(
          type,
          key,
          "PREPARING_FLOW_NOT_FOUND",
          `preparing flow not found: ${explicitRunId}`,
        ),
      };
    }
    return { runId: explicitRunId };
  }

  if (ids.length === 1) return { runId: ids[0] };
  if (ids.length === 0) {
    if (zeroPreparingAsFail) {
      return {
        fail: Envelope.fail(type, key, "NO_FLOW", "no active flow and no preparing flow found"),
      };
    }
    return { runId: null };
  }
  return {
    fail: Envelope.fail(
      type,
      key,
      "MULTIPLE_PREPARING_FLOWS",
      `multiple preparing flows found; pass --run-id <id> (candidates: ${ids.join(", ")})`,
    ),
  };
}
