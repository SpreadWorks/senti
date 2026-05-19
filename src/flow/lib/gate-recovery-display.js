/**
 * src/flow/lib/gate-recovery-display.js
 *
 * Selects the gate phase whose retry exhaustion should be surfaced in
 * next-action/status. Some gate steps map to multiple phases; the display must
 * point at the phase that actually consumed its retry budget.
 */

import { FLOW_DEFINITION, resolveNodeFor } from "../definition.js";
import { resolveGatePhaseFromState } from "./gate-step.js";
import { countGateRetry } from "./run-gate.js";
import { resolveRecoveryMaxAttempts } from "./retry-recovery.js";

export class GateRecoveryDisplayPhase {
  constructor({ phase, attempts, max }) {
    this.phase = phase;
    this.attempts = attempts;
    this.max = max;
  }
}

export function resolveGateRecoveryDisplayPhase({ flowState, stepId, maxAttempts }) {
  const phases = resolveNodeFor(FLOW_DEFINITION, stepId)?.gatePhase;
  const gatePhases = Array.isArray(phases) ? phases : [];
  for (const phase of gatePhases) {
    const attempts = countGateRetry(flowState.metrics, phase);
    const max = resolveRecoveryMaxAttempts({
      flowState,
      kind: "gate",
      phase,
      attempts,
      resolvedMax: maxAttempts,
    });
    if (attempts >= max) {
      return new GateRecoveryDisplayPhase({ phase, attempts, max });
    }
  }

  const fallbackPhase = resolveGatePhaseFromState(flowState)?.phase;
  if (!fallbackPhase) return null;
  const attempts = countGateRetry(flowState.metrics, fallbackPhase);
  const max = resolveRecoveryMaxAttempts({
    flowState,
    kind: "gate",
    phase: fallbackPhase,
    attempts,
    resolvedMax: maxAttempts,
  });
  return new GateRecoveryDisplayPhase({ phase: fallbackPhase, attempts, max });
}
