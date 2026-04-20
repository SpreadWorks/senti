/**
 * src/flow/lib/gate-step.js
 *
 * Single source of truth for mapping a gate phase to its flow step id.
 * Imported by run-gate.js and registry.js to avoid duplicate branching.
 */

export function resolveGateStepId(phase) {
  if (phase === "draft") return "gate-draft";
  if (phase === "task-impl" || phase === "integration") return "gate-impl";
  return "gate";
}
