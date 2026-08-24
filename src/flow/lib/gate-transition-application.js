/**
 * Non-policy Gate transition consumers.
 *
 * Persistence, command admission, and next-action projection accept only the
 * sealed decision selected by definition.js. They never inspect Gate result,
 * failure, retry, or recovery facts to choose another route.
 */
import {
  GateTransitionDecision,
  resolveGateTransition,
} from "../definition.js";

const PROJECTION_TOKEN = Symbol("gate-transition-action-projection");

export class GateTransitionActionProjection {
  constructor(token, decision) {
    if (token !== PROJECTION_TOKEN || !(decision instanceof GateTransitionDecision)) {
      throw new Error("Gate action projections require a definition decision");
    }
    this.phase = decision.facts.phase;
    this.scope = decision.facts.scope;
    this.stepId = decision.facts.target.stepId;
    this.operation = decision.disposition.operation;
    this.reason = decision.disposition.reason;
    this.advance = decision.advance?.operation === "advance";
    Object.freeze(this);
  }

  toJSON() {
    return {
      phase: this.phase,
      scope: this.scope,
      stepId: this.stepId,
      operation: this.operation,
      reason: this.reason,
      advance: this.advance,
    };
  }
}

/** Apply exactly the definition-owned plan; the adapter cannot select a route. */
export function applyGateTransitionDecision(adapter, decision) {
  if (adapter === null || typeof adapter !== "object" || Array.isArray(adapter)) {
    throw new Error("gate transition persistence adapter must be an object");
  }
  if (!(decision instanceof GateTransitionDecision)) {
    throw new Error("gate transition persistence requires a definition decision");
  }
  if (typeof adapter.applyStepUpdate !== "function") {
    throw new Error("gate transition persistence adapter.applyStepUpdate is required");
  }
  for (const update of decision.plan.updates) adapter.applyStepUpdate(update, decision);
  if (decision.plan.incrementRetry) {
    if (typeof adapter.incrementRetry !== "function") {
      throw new Error("gate transition retry plan requires adapter.incrementRetry");
    }
    adapter.incrementRetry(decision.facts.phase, decision);
  }
}

/** Re-read facts before direct execution and reject a stale selected decision. */
export function admitGateTransition({ facts, decision } = {}) {
  if (!(decision instanceof GateTransitionDecision)) {
    throw new Error("gate admission requires a definition decision");
  }
  const current = resolveGateTransition(facts);
  if (JSON.stringify(current.toJSON()) !== JSON.stringify(decision.toJSON())) {
    throw new Error("gate transition admission rejected a stale or bypassed decision");
  }
  return current;
}

/** Project a selected decision without interpreting Gate semantics. */
export function projectGateTransitionDecision(decision) {
  return new GateTransitionActionProjection(PROJECTION_TOKEN, decision);
}
