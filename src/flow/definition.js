/**
 * src/flow/definition.js
 *
 * Single source of truth for the Spec-Driven Development flow structure.
 *
 * Every node carries the attributes that other modules previously derived
 * from context-rules.json, registry hooks, hardcoded constants, or prompt
 * literals. Adding / reordering steps is done here; consumers derive
 * behaviour from this data structure instead of maintaining parallel maps.
 *
 * Max depth: 3 (root list → branch → leaf). Traversal helpers enforce this.
 */

import { createHash } from "node:crypto";

import {
  CurrentFlowDefinition,
  DefinitionDraftDisposition,
  DefinitionReviewDisposition,
  DefinitionFailurePolicy,
  FlowDefinitionNode as CurrentFlowDefinitionNode,
  NodeContract as CurrentFlowNodeContract,
} from "./lib/current-flow-state.js";
import { draftReviewRouteForKey, draftReviewRouteForRetryPhase } from "./lib/draft-review-routes.js";
import {
  flattenSteps,
  findFirstPendingLeaf,
} from "./lib/step-tree.js";
import { nonblockingRouteFor } from "./lib/nonblocking-route.js";
import { TaskStepIdentity } from "./lib/task-step-identity.js";
import { DefinitionFailureOwnership } from "./lib/definition-failure-ownership.js";
import { ReviewTransitionFacts } from "./lib/review-transition-facts.js";
import { DraftTransitionFacts } from "./lib/draft-transition-facts.js";
import {
  flowReviewRouteForPhase,
  reviewPhaseForFlowStepId,
} from "./lib/review-route.js";

import {
  GateAttemptIdentity,
  GateCatalogPublication,
  GateFailureCategory,
  GateLineage,
  GateRecoveryEvidence,
  GateRetryMetrics,
  GateProducerOwnership,
  GateTargetBinding,
  GateTransitionFacts,
} from "./lib/gate-transition.js";
import {
  NonGateAttemptIdentity,
  NonGateCatalogPublication,
  NonGateCompletionFacts,
  NonGateLineage,
  NonGateProducerOwnership,
  NonGateRepairPublication,
  NonGateRecoveryEvidence,
  NonGateRetryMetrics,
  NonGateSourcePublication,
  NonGateStepFacts,
  NonGateTargetBinding,
  NonGateTransitionFacts,
} from "./lib/non-gate-transition.js";

// Facts are read by a focused boundary, but every Gate policy value and the
// only resolver live in this definition module. Commands, registry hooks,
// persistence, and next-action must consume this API instead of selecting a
// route themselves.
export {
  GateAttemptIdentity,
  GateCatalogPublication,
  GateFailureCategory,
  GateLineage,
  GateRecoveryEvidence,
  GateRetryMetrics,
  GateProducerOwnership,
  GateTargetBinding,
  GateTransitionFacts,
  NonGateAttemptIdentity,
  NonGateCatalogPublication,
  NonGateCompletionFacts,
  NonGateLineage,
  NonGateProducerOwnership,
  NonGateRepairPublication,
  NonGateRecoveryEvidence,
  NonGateRetryMetrics,
  NonGateSourcePublication,
  NonGateStepFacts,
  NonGateTargetBinding,
  NonGateTransitionFacts,
};

const MAX_DEPTH = 3;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

class ScalarMaxAttempts {
  constructor(value) {
    if (!isPositiveInteger(value)) {
      throw new Error("invalid maxAttempts: expected a positive integer");
    }
    this.value = value;
    Object.freeze(this);
  }

  resolve() {
    return this.value;
  }
}

class ModeMaxAttempts {
  constructor(value) {
    if (!isPlainObject(value)) {
      throw new Error("invalid maxAttempts: expected exactly own auto/manual keys");
    }
    const keys = Object.keys(value);
    if (
      keys.length !== 2
      || !Object.hasOwn(value, "auto")
      || !Object.hasOwn(value, "manual")
    ) {
      throw new Error("invalid maxAttempts: expected exactly own auto/manual keys");
    }
    if (!isPositiveInteger(value.auto) || !isPositiveInteger(value.manual)) {
      throw new Error("invalid maxAttempts: auto/manual must be positive integers");
    }
    this.auto = value.auto;
    this.manual = value.manual;
    Object.freeze(this);
  }

  resolve(context = {}) {
    return context.autoApprove === true ? this.auto : this.manual;
  }
}

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function createMaxAttempts(value) {
  if (typeof value === "number") return new ScalarMaxAttempts(value);
  return new ModeMaxAttempts(value);
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function requireStepList(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must be a non-empty array`);
  }
  return Object.freeze(value.map((step) => requireString(step, field)));
}

const GATE_DISPOSITIONS = new Set([
  "pass", "retry", "repair", "defer", "external-blocked", "blocked", "recovery", "advance",
]);
const GATE_TRANSITION_TOKEN = Symbol("definition-gate-transition");

export class GateTransitionDisposition {
  constructor(token, { operation, reason = null } = {}) {
    if (token !== GATE_TRANSITION_TOKEN) {
      throw new Error("Gate dispositions are created only by the definition resolver");
    }
    this.operation = requireString(operation, "gate disposition operation");
    if (!GATE_DISPOSITIONS.has(this.operation)) throw new Error("gate disposition operation is invalid");
    this.reason = reason == null ? null : requireString(reason, "gate disposition reason");
    Object.freeze(this);
  }

  toJSON() { return { operation: this.operation, reason: this.reason }; }
}

class GateDisposition extends GateTransitionDisposition {
  constructor(token, operation, reason = null) { super(token, { operation, reason }); }
}

export class GatePassDisposition extends GateDisposition {
  constructor(token) { super(token, "pass"); }
}
export class GateRetryDisposition extends GateDisposition {
  constructor(token) { super(token, "retry"); }
}
export class GateRepairDisposition extends GateDisposition {
  constructor(token) { super(token, "repair"); }
}
export class GateDeferDisposition extends GateDisposition {
  constructor(token) { super(token, "defer"); }
}
export class GateExternalBlockedDisposition extends GateDisposition {
  constructor(token, reason) { super(token, "external-blocked", reason); }
}
export class GateBlockedDisposition extends GateDisposition {
  constructor(token, reason) { super(token, "blocked", reason); }
}
export class GateRecoveryDisposition extends GateDisposition {
  constructor(token) { super(token, "recovery"); }
}
export class GateAdvanceDisposition extends GateDisposition {
  constructor(token) { super(token, "advance"); }
}

export class GateStepUpdate {
  constructor({ stepId, status } = {}) {
    this.stepId = requireString(stepId, "gate step update stepId");
    this.status = requireString(status, "gate step update status");
    if (!["in_progress", "done"].includes(this.status)) {
      throw new Error("gate step update status is invalid");
    }
    Object.freeze(this);
  }

  toJSON() { return { stepId: this.stepId, status: this.status }; }
}

export class GateStepUpdatePlan {
  constructor(token, { updates, incrementRetry = false } = {}) {
    if (token !== GATE_TRANSITION_TOKEN) {
      throw new Error("Gate step update plans are created only by the definition resolver");
    }
    if (!Array.isArray(updates) || updates.some((entry) => !(entry instanceof GateStepUpdate))) {
      throw new Error("gate step update plan requires typed updates");
    }
    if (typeof incrementRetry !== "boolean") throw new Error("gate step update incrementRetry must be boolean");
    this.updates = Object.freeze([...updates]);
    this.incrementRetry = incrementRetry;
    Object.freeze(this);
  }

  toJSON() {
    return {
      updates: this.updates.map((entry) => entry.toJSON()),
      incrementRetry: this.incrementRetry,
    };
  }
}

export class GateTransitionDecision {
  constructor(token, { facts, disposition, advance = null, plan } = {}) {
    if (token !== GATE_TRANSITION_TOKEN) {
      throw new Error("Gate transition decisions are created only by definition resolver");
    }
    if (!(facts instanceof GateTransitionFacts)) throw new Error("gate decision requires typed facts");
    if (!(disposition instanceof GateTransitionDisposition)) throw new Error("gate decision requires typed disposition");
    if (advance !== null && !(advance instanceof GateAdvanceDisposition)) {
      throw new Error("gate decision advance must be typed");
    }
    if (!(plan instanceof GateStepUpdatePlan)) throw new Error("gate decision requires typed plan");
    this.facts = facts;
    this.disposition = disposition;
    this.advance = advance;
    this.plan = plan;
    Object.freeze(this);
  }

  toJSON() {
    return {
      facts: this.facts.toJSON(),
      disposition: this.disposition.toJSON(),
      advance: this.advance?.toJSON() ?? null,
      plan: this.plan.toJSON(),
    };
  }
}

function gateActivePlan(facts, { incrementRetry = false } = {}) {
  return new GateStepUpdatePlan(GATE_TRANSITION_TOKEN, {
    updates: [new GateStepUpdate({ stepId: facts.target.stepId, status: "in_progress" })],
    incrementRetry,
  });
}

function gateSettledPlan(facts) {
  return new GateStepUpdatePlan(GATE_TRANSITION_TOKEN, {
    updates: [new GateStepUpdate({ stepId: facts.target.stepId, status: "done" })],
  });
}

/**
 * The definition's phase-neutral Gate policy. Phase migrations may add their
 * own facts, but execution and projection layers cannot choose a disposition.
 */
export function resolveGateTransition(facts) {
  if (!(facts instanceof GateTransitionFacts)) {
    throw new Error("resolveGateTransition requires GateTransitionFacts");
  }
  if (facts.integrityFailure !== null) {
    return new GateTransitionDecision(GATE_TRANSITION_TOKEN, {
      facts,
      disposition: new GateBlockedDisposition(GATE_TRANSITION_TOKEN, facts.integrityFailure),
      plan: gateActivePlan(facts),
    });
  }
  if (facts.result === "pass") {
    return new GateTransitionDecision(GATE_TRANSITION_TOKEN, {
      facts,
      disposition: new GatePassDisposition(GATE_TRANSITION_TOKEN),
      advance: new GateAdvanceDisposition(GATE_TRANSITION_TOKEN),
      plan: gateSettledPlan(facts),
    });
  }
  if (facts.result === "recovered" || facts.recoveryEvidence.kind === "recovered") {
    return new GateTransitionDecision(GATE_TRANSITION_TOKEN, {
      facts,
      disposition: new GateRecoveryDisposition(GATE_TRANSITION_TOKEN),
      plan: gateActivePlan(facts),
    });
  }
  if (facts.failure.category === "tooling") {
    return new GateTransitionDecision(GATE_TRANSITION_TOKEN, {
      facts,
      disposition: new GateExternalBlockedDisposition(
        GATE_TRANSITION_TOKEN,
        facts.failure.code || "tooling_failure",
      ),
      plan: gateActivePlan(facts),
    });
  }
  if (!facts.retry.exhausted) {
    return new GateTransitionDecision(GATE_TRANSITION_TOKEN, {
      facts,
      disposition: new GateRetryDisposition(GATE_TRANSITION_TOKEN),
      plan: gateActivePlan(facts, { incrementRetry: true }),
    });
  }
  if (facts.recoveryEvidence.kind === "repair") {
    return new GateTransitionDecision(GATE_TRANSITION_TOKEN, {
      facts,
      disposition: new GateRepairDisposition(GATE_TRANSITION_TOKEN),
      plan: gateActivePlan(facts),
    });
  }
  if (facts.recoveryEvidence.kind === "defer") {
    return new GateTransitionDecision(GATE_TRANSITION_TOKEN, {
      facts,
      disposition: new GateDeferDisposition(GATE_TRANSITION_TOKEN),
      plan: gateSettledPlan(facts),
    });
  }
  return new GateTransitionDecision(GATE_TRANSITION_TOKEN, {
    facts,
    disposition: new GateBlockedDisposition(GATE_TRANSITION_TOKEN, "retry_exhausted"),
    plan: gateActivePlan(facts),
  });
}

// Non-Gate transition policy is intentionally independent from the temporary
// Gate migration path above.  A Step contributes typed evidence, while this
// reducer alone selects the disposition, plan and stable Action identity.
const NON_GATE_TRANSITION_TOKEN = Symbol("definition-non-gate-transition");
const NON_GATE_OPERATIONS = new Set([
  "advance", "keep-in-progress", "await-user-input", "retry", "repair",
  "record-and-proceed", "external-blocked", "blocked", "park",
]);

export class NonGateTransitionDisposition {
  constructor(token, { operation, reason = null } = {}) {
    if (token !== NON_GATE_TRANSITION_TOKEN) {
      throw new Error("non-Gate dispositions are created only by the definition resolver");
    }
    this.operation = requireString(operation, "non-Gate disposition operation");
    if (!NON_GATE_OPERATIONS.has(this.operation)) throw new Error("non-Gate disposition operation is invalid");
    this.reason = reason == null ? null : requireString(reason, "non-Gate disposition reason");
    Object.freeze(this);
  }

  toJSON() { return { operation: this.operation, reason: this.reason }; }
}

class NonGateDisposition extends NonGateTransitionDisposition {
  constructor(token, operation, reason = null) { super(token, { operation, reason }); }
}

export class NonGateAdvanceDisposition extends NonGateDisposition { constructor(token) { super(token, "advance"); } }
export class NonGateKeepInProgressDisposition extends NonGateDisposition { constructor(token) { super(token, "keep-in-progress"); } }
export class NonGateAwaitUserInputDisposition extends NonGateDisposition { constructor(token) { super(token, "await-user-input"); } }
export class NonGateRetryDisposition extends NonGateDisposition { constructor(token) { super(token, "retry"); } }
export class NonGateRepairDisposition extends NonGateDisposition { constructor(token) { super(token, "repair"); } }
export class NonGateRecordAndProceedDisposition extends NonGateDisposition { constructor(token) { super(token, "record-and-proceed"); } }
export class NonGateExternalBlockedDisposition extends NonGateDisposition { constructor(token, reason) { super(token, "external-blocked", reason); } }
export class NonGateBlockedDisposition extends NonGateDisposition { constructor(token, reason) { super(token, "blocked", reason); } }
export class NonGateParkDisposition extends NonGateDisposition { constructor(token, reason = null) { super(token, "park", reason); } }

/**
 * A Step-specific Definition returns this declaration after interpreting its
 * own typed facts.  It is deliberately not a transition plan: only the
 * common Definition reducer below mints a sealed decision, plan and Action.
 */
export class NonGateTransitionSelection {
  constructor({ operation, reason = null, actions = [] } = {}) {
    this.operation = requireString(operation, "non-Gate selection operation");
    if (!NON_GATE_OPERATIONS.has(this.operation)) throw new Error("non-Gate selection operation is invalid");
    this.reason = reason == null ? null : requireString(reason, "non-Gate selection reason");
    if (!Array.isArray(actions) || actions.some((action) => (
      !(action instanceof NonGateStepAction)
      || !Object.isFrozen(action)
      || action.apply === NonGateStepAction.prototype.apply
      || action.toJSON === NonGateStepAction.prototype.toJSON
    ))) {
      throw new Error("non-Gate selection actions must be typed Step actions");
    }
    this.actions = Object.freeze([...actions]);
    Object.freeze(this);
  }
}

/** Extension base for Step-specific persistence actions selected by Definition. */
export class NonGateStepAction {
  constructor() {
    if (new.target === NonGateStepAction) throw new Error("non-Gate Step actions require a dedicated subclass");
  }

  apply() { throw new Error("non-Gate Step action subclasses must implement apply()"); }
  toJSON() { throw new Error("non-Gate Step action subclasses must implement toJSON()"); }
}

/**
 * Extension boundary for a non-Gate Step's Definition-owned policy.  A
 * producer supplies only its typed facts; this Definition selects a semantic
 * disposition, and the shared reducer remains the sole plan authority.
 */
export class NonGateStepDefinition {
  constructor({ stepId, factsType, select } = {}) {
    this.stepId = requireString(stepId, "non-Gate Step Definition stepId");
    if (typeof factsType !== "function" || !(factsType.prototype instanceof NonGateStepFacts)) {
      throw new Error("non-Gate Step Definition factsType must extend NonGateStepFacts");
    }
    if (typeof select !== "function") throw new Error("non-Gate Step Definition select must be a function");
    this.factsType = factsType;
    this.select = select;
    Object.freeze(this);
  }

  selectionFor(facts) {
    if (!(facts instanceof NonGateTransitionFacts) || facts.stepId !== this.stepId) {
      throw new Error("non-Gate Step Definition does not own these facts");
    }
    if (!(facts.stepFacts instanceof this.factsType)) {
      throw new Error("non-Gate Step Definition received incompatible typed Step facts");
    }
    const selection = this.select(facts.stepFacts, facts);
    if (!(selection instanceof NonGateTransitionSelection)) {
      throw new Error("non-Gate Step Definition must return NonGateTransitionSelection");
    }
    return selection;
  }
}

/** Stable Action identity; it intentionally contains no clock or caller data. */
export class NonGateActionIdentity {
  constructor(token, { runId, specId, stepId, attempt, catalogFingerprint, factsFingerprint, selectedFingerprint, operation } = {}) {
    if (token !== NON_GATE_TRANSITION_TOKEN) {
      throw new Error("non-Gate Action identities are created only by the definition resolver");
    }
    this.runId = requireString(runId, "non-Gate Action runId");
    this.specId = requireString(specId, "non-Gate Action specId");
    this.stepId = requireString(stepId, "non-Gate Action stepId");
    this.attempt = attempt instanceof NonGateAttemptIdentity ? attempt : new NonGateAttemptIdentity(attempt);
    this.catalogFingerprint = requireString(catalogFingerprint, "non-Gate Action catalog fingerprint");
    this.factsFingerprint = requireString(factsFingerprint, "non-Gate Action facts fingerprint");
    this.selectedFingerprint = requireString(selectedFingerprint, "non-Gate Action selected fingerprint");
    this.operation = requireString(operation, "non-Gate Action operation");
    if (!NON_GATE_OPERATIONS.has(this.operation)) throw new Error("non-Gate Action operation is invalid");
    Object.freeze(this);
  }

  matches(other) {
    return other instanceof NonGateActionIdentity
      && this.runId === other.runId
      && this.specId === other.specId
      && this.stepId === other.stepId
      && this.attempt.matches(other.attempt)
      && this.catalogFingerprint === other.catalogFingerprint
      && this.factsFingerprint === other.factsFingerprint
      && this.selectedFingerprint === other.selectedFingerprint
      && this.operation === other.operation;
  }

  toJSON() {
    return {
      runId: this.runId, specId: this.specId, stepId: this.stepId,
      attempt: this.attempt.toJSON(), catalogFingerprint: this.catalogFingerprint,
      factsFingerprint: this.factsFingerprint, operation: this.operation,
      selectedFingerprint: this.selectedFingerprint,
    };
  }
}

export class NonGateTransitionAction {
  constructor(token, { identity } = {}) {
    if (token !== NON_GATE_TRANSITION_TOKEN || !(identity instanceof NonGateActionIdentity)) {
      throw new Error("non-Gate Actions are created only by the definition resolver");
    }
    this.identity = identity;
    Object.freeze(this);
  }

  toJSON() { return { identity: this.identity.toJSON() }; }
}

export class NonGateStepUpdate {
  constructor({ stepId, status } = {}) {
    this.stepId = requireString(stepId, "non-Gate step update stepId");
    this.status = requireString(status, "non-Gate step update status");
    if (!["in_progress", "done"].includes(this.status)) throw new Error("non-Gate step update status is invalid");
    Object.freeze(this);
  }

  toJSON() { return { stepId: this.stepId, status: this.status }; }
}

/** Typed plan effect; adapters apply it but cannot replace it with a route. */
export class NonGateSetStepStatusAction extends NonGateStepAction {
  constructor(token, { update } = {}) {
    super();
    if (token !== NON_GATE_TRANSITION_TOKEN || !(update instanceof NonGateStepUpdate)) throw new Error("non-Gate status action requires a definition update");
    this.update = update;
    Object.freeze(this);
  }
  apply(adapter, plan) { return adapter.setStepStatus(this.update, plan); }
  toJSON() { return { action: "set-step-status", update: this.update.toJSON() }; }
}

export class NonGateIncrementRetryAction extends NonGateStepAction {
  constructor(token, { stepId } = {}) {
    super();
    if (token !== NON_GATE_TRANSITION_TOKEN) throw new Error("non-Gate retry action requires the definition resolver");
    this.stepId = requireString(stepId, "non-Gate retry action stepId");
    Object.freeze(this);
  }
  apply(adapter, plan) { return adapter.incrementRetry(this.stepId, plan); }
  toJSON() { return { action: "increment-retry", stepId: this.stepId }; }
}

/** Sealed typed authority consumed by persistence and command admission only. */
export class NonGateTransitionPlan {
  constructor(token, { action, actions } = {}) {
    if (token !== NON_GATE_TRANSITION_TOKEN) {
      throw new Error("non-Gate transition plans are created only by the definition resolver");
    }
    if (!(action instanceof NonGateTransitionAction)) throw new Error("non-Gate plan requires a typed Action");
    if (!Array.isArray(actions) || actions.some((entry) => !(entry instanceof NonGateStepAction))) {
      throw new Error("non-Gate plan requires typed actions");
    }
    this.action = action;
    this.actions = Object.freeze([...actions]);
    Object.freeze(this);
  }

  toJSON() {
    return {
      action: this.action.toJSON(), actions: this.actions.map((entry) => entry.toJSON()),
    };
  }
}

export class NonGateTransitionDecision {
  constructor(token, { facts, disposition, plan } = {}) {
    if (token !== NON_GATE_TRANSITION_TOKEN) {
      throw new Error("non-Gate transition decisions are created only by the definition resolver");
    }
    if (!(facts instanceof NonGateTransitionFacts)) throw new Error("non-Gate decision requires typed facts");
    if (!(disposition instanceof NonGateTransitionDisposition)) throw new Error("non-Gate decision requires typed disposition");
    if (!(plan instanceof NonGateTransitionPlan)) throw new Error("non-Gate decision requires typed plan");
    if (plan.action.identity.operation !== disposition.operation) throw new Error("non-Gate plan Action does not match disposition");
    this.facts = facts;
    this.disposition = disposition;
    this.plan = plan;
    Object.freeze(this);
  }

  toJSON() { return { facts: this.facts.toJSON(), disposition: this.disposition.toJSON(), plan: this.plan.toJSON() }; }
}

function nonGatePlan(facts, disposition, { status = "in_progress", incrementRetry = false, stepActions = [] } = {}) {
  const update = new NonGateStepUpdate({ stepId: facts.stepId, status });
  const actions = [
    new NonGateSetStepStatusAction(NON_GATE_TRANSITION_TOKEN, { update }),
    ...(incrementRetry ? [new NonGateIncrementRetryAction(NON_GATE_TRANSITION_TOKEN, { stepId: facts.stepId })] : []),
    ...stepActions,
  ];
  const identity = new NonGateActionIdentity(NON_GATE_TRANSITION_TOKEN, {
    runId: facts.runId,
    specId: facts.specId,
    stepId: facts.stepId,
    attempt: facts.currentAttempt,
    catalogFingerprint: facts.catalogPublication.fingerprint,
    factsFingerprint: nonGateFactsFingerprint(facts),
    selectedFingerprint: createHash("sha256").update(stableJson({ disposition: disposition.toJSON(), actions: actions.map((entry) => entry.toJSON()) })).digest("hex"),
    operation: disposition.operation,
  });
  return new NonGateTransitionPlan(NON_GATE_TRANSITION_TOKEN, {
    action: new NonGateTransitionAction(NON_GATE_TRANSITION_TOKEN, { identity }),
    actions,
  });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function nonGateFactsFingerprint(facts) {
  return createHash("sha256").update(stableJson(facts.toJSON())).digest("hex");
}

function nonGateDecision(facts, disposition, options) {
  return new NonGateTransitionDecision(NON_GATE_TRANSITION_TOKEN, {
    facts,
    disposition,
    plan: nonGatePlan(facts, disposition, options),
  });
}

/** Deterministic, phase-neutral reducer for all non-Gate Step facts. */
export function resolveNonGateTransition(facts, stepDefinition) {
  if (!(facts instanceof NonGateTransitionFacts)) {
    throw new Error("resolveNonGateTransition requires NonGateTransitionFacts");
  }
  if (!(stepDefinition instanceof NonGateStepDefinition)) {
    throw new Error("resolveNonGateTransition requires a typed Step Definition");
  }
  if (facts.integrityFailure !== null) {
    return nonGateDecision(facts, new NonGateBlockedDisposition(NON_GATE_TRANSITION_TOKEN, facts.integrityFailure));
  }
  if (facts.completion.partial) {
    return nonGateDecision(facts, new NonGateBlockedDisposition(NON_GATE_TRANSITION_TOKEN, "partial_completion"));
  }
  const selection = stepDefinition.selectionFor(facts);
  const selectedDecision = (disposition, options = {}) => nonGateDecision(facts, disposition, {
    ...options,
    stepActions: selection.actions,
  });
  if (selection.operation === "advance") {
    if (!facts.completion.completed) return selectedDecision(new NonGateBlockedDisposition(NON_GATE_TRANSITION_TOKEN, "completion_unconfirmed"));
    return selectedDecision(new NonGateAdvanceDisposition(NON_GATE_TRANSITION_TOKEN), { status: "done" });
  }
  if (selection.operation === "keep-in-progress") return selectedDecision(new NonGateKeepInProgressDisposition(NON_GATE_TRANSITION_TOKEN));
  if (selection.operation === "await-user-input") return selectedDecision(new NonGateAwaitUserInputDisposition(NON_GATE_TRANSITION_TOKEN));
  if (selection.operation === "retry") {
    if (facts.retry.exhausted) return selectedDecision(new NonGateBlockedDisposition(NON_GATE_TRANSITION_TOKEN, "retry_exhausted"));
    return selectedDecision(new NonGateRetryDisposition(NON_GATE_TRANSITION_TOKEN), { incrementRetry: true });
  }
  if (selection.operation === "repair") return selectedDecision(new NonGateRepairDisposition(NON_GATE_TRANSITION_TOKEN));
  if (selection.operation === "record-and-proceed") {
    return selectedDecision(new NonGateRecordAndProceedDisposition(NON_GATE_TRANSITION_TOKEN), { status: "done" });
  }
  if (selection.operation === "external-blocked") {
    return selectedDecision(new NonGateExternalBlockedDisposition(NON_GATE_TRANSITION_TOKEN, selection.reason || "external_blocked"));
  }
  if (selection.operation === "park") {
    return selectedDecision(new NonGateParkDisposition(NON_GATE_TRANSITION_TOKEN, selection.reason), { status: "done" });
  }
  return selectedDecision(new NonGateBlockedDisposition(NON_GATE_TRANSITION_TOKEN, selection.reason || "blocked"));
}

const STEP_STATUSES = new Set(["pending", "in_progress", "done", "skipped"]);

export class SetStepStatus {
  constructor({ step, status, suppressAutoPromotion = false }) {
    this.step = requireString(step, "step");
    this.status = requireString(status, "status");
    if (!STEP_STATUSES.has(this.status)) throw new Error(`invalid status: ${this.status}`);
    if (typeof suppressAutoPromotion !== "boolean") {
      throw new Error("suppressAutoPromotion must be boolean");
    }
    this.suppressAutoPromotion = suppressAutoPromotion;
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.setStepStatus(this.step, this.status, this);
  }

  forStep(step) {
    const scopedStep = requireString(step, "step");
    if (scopedStep === this.step) return this;
    return new SetStepStatus({
      step: scopedStep,
      status: this.status,
      suppressAutoPromotion: this.suppressAutoPromotion,
    });
  }
}

/** Definition-selected post-confirmation mutation; adapters may only apply it. */
export class PromoteDraftQuestionAndKeepRefineActive {
  constructor({ questionId, questionRevision, digest, byteLength }) {
    this.questionId = requireString(questionId, "draft promotion questionId");
    if (!Number.isSafeInteger(questionRevision) || questionRevision < 0) throw new Error("draft promotion questionRevision is invalid");
    this.questionRevision = questionRevision;
    this.digest = requireString(digest, "draft promotion digest");
    if (!/^[a-f0-9]{64}$/.test(this.digest)) throw new Error("draft promotion digest is invalid");
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) throw new Error("draft promotion byteLength is invalid");
    this.byteLength = byteLength;
    Object.freeze(this);
  }
  apply(adapter) { return adapter.promoteDraftQuestionAndKeepRefineActive(this); }
}

const DEFINITION_LIFECYCLE_PLAN_TOKEN = Symbol("definition-lifecycle-plan");

export class DefinitionLifecyclePlan {
  constructor(token, { event, currentStepId, actions }) {
    if (token !== DEFINITION_LIFECYCLE_PLAN_TOKEN) {
      throw new Error("DefinitionLifecyclePlan is created only by the definition resolver");
    }
    if (!Array.isArray(actions)) throw new Error("actions must be an array");
    const lifecycleActions = [...actions];
    const hasStepTransition = lifecycleActions.some((action) => action instanceof SetStepStatus);
    this.event = requireString(event, "event");
    this.currentStepId = currentStepId == null && !hasStepTransition
      ? null
      : requireString(currentStepId, "currentStepId");
    this.actions = Object.freeze(lifecycleActions);
    Object.freeze(this);
  }

  allows(action) {
    return this.actions.includes(action);
  }

  forStepAlias({ sourceStep, targetStep }) {
    const source = requireString(sourceStep, "sourceStep");
    const target = requireString(targetStep, "targetStep");
    if (source === target) return this;
    const actions = this.actions.map((action) => (
      action instanceof SetStepStatus && action.step === source
        ? action.forStep(target)
        : action
    ));
    const currentStepId = this.currentStepId === source ? target : this.currentStepId;
    if (currentStepId === this.currentStepId && actions.every((action, index) => action === this.actions[index])) {
      return this;
    }
    return new DefinitionLifecyclePlan(DEFINITION_LIFECYCLE_PLAN_TOKEN, {
      event: this.event,
      currentStepId,
      actions,
    });
  }
}

export class KeepInProgress {
  constructor({ step }) {
    this.step = requireString(step, "step");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.keepInProgress(this.step);
  }
}

export class IncrementMetric {
  constructor({ phase, counter }) {
    this.phase = requireString(phase, "phase");
    this.counter = requireString(counter, "counter");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.incrementMetric(this.phase, this.counter);
  }
}

/** Persist a non-terminal current Review result selected by definition lifecycle. */
export class PersistReviewResult {
  constructor() {
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.persistReviewResult();
  }
}

export class AppendIssueLog {
  constructor({ source }) {
    this.source = requireString(source, "source");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.appendIssueLog(this.source);
  }
}

export class ExecuteSideEffects {
  constructor() {
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.executeSideEffects();
  }
}

export class SkipSteps {
  constructor({ steps }) {
    this.steps = requireStepList(steps, "steps");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.skipSteps([...this.steps]);
  }
}

export class ResetSteps {
  constructor({ steps }) {
    this.steps = requireStepList(steps, "steps");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.resetSteps([...this.steps]);
  }
}

export class RunLifecycleHook {
  constructor({ module, handler, args = null }) {
    this.module = requireString(module, "module");
    this.handler = requireString(handler, "handler");
    this.args = args == null ? null : Object.freeze({ ...args });
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.runLifecycleHook(this.module, this.handler, this.args);
  }
}

export class BeginOutboxEffect {
  constructor({ step }) {
    this.step = requireString(step, "step");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.beginOutboxEffect(this.step);
  }
}

export class CompleteOutboxEffect {
  constructor({ step }) {
    this.step = requireString(step, "step");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.completeOutboxEffect(this.step);
  }
}

export class FailOutboxEffect {
  constructor({ step }) {
    this.step = requireString(step, "step");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.failOutboxEffect(this.step);
  }
}

export function applyLifecycleActions(adapter, actions) {
  for (const action of actions) action.apply(adapter);
}

const FINALIZE_SUCCESS_STATUSES = new Set(["done", "completed", "skipped"]);
const IMPL_REVIEW_RESET_RANGE = Object.freeze([
  "test-execute",
  "test-result-review",
  "impl-review",
  "impl-triage",
  "impl-repair",
  "impl-gate",
  "retro",
  "acceptance-review",
  "acceptance-decision",
  "final-regression",
  "report",
  "finalize-commit",
  "finalize-merge",
  "finalize-sync",
  "finalize-cleanup",
]);
const REJECTED_IMPL_REVIEW_RESET_STEPS = Object.freeze([
  "impl-repair",
  "impl-gate",
]);

export function countReviewAttempts(metrics, phase) {
  if (!Array.isArray(metrics)) return 0;
  let count = 0;
  for (const entry of metrics) {
    if (entry?.phase !== phase || entry?.counter !== "reviewRetry" || entry?.taskId != null) continue;
    count = entry.reset === true ? 0 : count + (entry.delta ?? 1);
  }
  return count;
}

/**
 * The definition owns the only policy that turns persisted review facts into
 * a recovery route. Readers may establish whether canonical evidence exists;
 * they must not choose between repair and an exhausted retry disposition.
 */
export function resolveReviewTransition({
  stepId,
  flowState,
  facts,
} = {}) {
  const phase = stepId === "task-review" ? "impl" : reviewPhaseForFlowStepId(stepId);
  if (phase === null || !(facts instanceof ReviewTransitionFacts)) return null;
  if (facts.phase !== phase) throw new Error("review transition facts phase does not match step");
  if (flowState?.policy?.nonblocking?.enabled === true) return null;
  if (facts.toolingOutcome) {
    return new DefinitionReviewDisposition({ operation: "external-blocked", phase });
  }
  if (facts.verdict !== "REJECTED") {
    return null;
  }
  const maxAttempts = resolveMaxAttempts({ scope: facts.scope, stepId, context: flowState }) ?? 1;
  const attempts = facts.scope === "task"
    ? facts.attemptCount
    : countReviewAttempts(flowState?.metrics, phase);
  if (!Number.isSafeInteger(attempts) || attempts < 0) {
    throw new Error("review transition facts have no usable attempt count");
  }
  if (attempts < maxAttempts) {
    if (facts.scope === "flow" && phase === "test") {
      return new DefinitionReviewDisposition({
        operation: facts.repairEvidence.available ? "repair-test-review" : "repair-evidence-blocked",
        phase,
      });
    }
    return new DefinitionReviewDisposition({ operation: "retry", phase });
  }
  if (facts.deferralEvidence.available) {
    return new DefinitionReviewDisposition({
      operation: "defer",
      phase,
      attempts,
      maxAttempts,
      sourceFingerprints: facts.deferralEvidence.sourceFingerprints,
    });
  }
  if (attempts >= maxAttempts) {
    return new DefinitionReviewDisposition({ operation: "blocked", phase, attempts, maxAttempts });
  }
  return null;
}

/**
 * Decide whether draft refinement may execute or must yield one canonical
 * user-decision question. Artifact reading and directive rendering live in
 * other layers; this is the sole transition-policy owner.
 */
export class DraftQuestionPromotionPlan {
  constructor({ questionId, questionRevision } = {}) {
    this.questionId = requireString(questionId, "draft question promotion questionId");
    if (!Number.isSafeInteger(questionRevision) || questionRevision < 0) {
      throw new Error("draft question promotion questionRevision is invalid");
    }
    this.questionRevision = questionRevision;
    Object.freeze(this);
  }
  toJSON() { return { operation: "promote-candidate", questionId: this.questionId, questionRevision: this.questionRevision }; }
  apply(ledger) { return ledger.transitionCandidate(this.questionId, this.questionRevision); }
}

class ResolveDraftQuestionPlan {
  constructor({ questionId, questionRevision } = {}) {
    this.questionId = requireString(questionId, "draft question resolution questionId");
    if (!Number.isSafeInteger(questionRevision) || questionRevision < 0) throw new Error("draft question resolution questionRevision is invalid");
    this.questionRevision = questionRevision;
  }
}

export class AnswerDraftQuestionPlan extends ResolveDraftQuestionPlan {
  constructor({ questionId, questionRevision, answer, why, considered = "" } = {}) {
    super({ questionId, questionRevision });
    this.answer = answer;
    this.why = why;
    this.considered = considered;
    Object.freeze(this);
  }

  apply(ledger) {
    return ledger.answer(this.questionId, this.questionRevision, {
      answer: this.answer,
      why: this.why,
      considered: this.considered,
    });
  }
}

export class DiscardDraftQuestionPlan extends ResolveDraftQuestionPlan {
  constructor({ questionId, questionRevision, reason } = {}) {
    super({ questionId, questionRevision });
    this.reason = reason;
    Object.freeze(this);
  }

  apply(ledger) {
    return ledger.discard(this.questionId, this.questionRevision, this.reason);
  }
}

/** Definition owns admission and action selection for direct draft answers. */
export function resolveDraftQuestionResolution({ intent, questionId, questionRevision, facts, flowState, answer = null, why = null, considered = "", reason = null } = {}) {
  if (!(facts instanceof DraftTransitionFacts)) return null;
  const disposition = resolveDraftTransition({ stepId: "draft-refine", flowState, facts });
  if (disposition?.operation !== "await-user-answer" || disposition.questionId !== questionId || disposition.questionRevision !== questionRevision) return null;
  return intent === "answer"
    ? new AnswerDraftQuestionPlan({ questionId, questionRevision, answer, why, considered })
    : intent === "discard"
      ? new DiscardDraftQuestionPlan({ questionId, questionRevision, reason })
      : null;
}

/** The only creator of a candidate-to-user-boundary transition plan. */
export function resolveDraftQuestionPromotion({ facts } = {}) {
  if (!(facts instanceof DraftTransitionFacts) || facts.candidateQuestion === null) return null;
  return new DraftQuestionPromotionPlan({
    questionId: facts.candidateQuestion.id,
    questionRevision: facts.candidateQuestion.revision,
  });
}

export function resolveDraftTransition({ stepId, flowState, facts } = {}) {
  if (stepId !== "draft-refine" || !(facts instanceof DraftTransitionFacts)) return null;
  if (flowState?.autoApprove === true || facts.nextQuestion === null) {
    return new DefinitionDraftDisposition({ operation: "execute-refine" });
  }
  return new DefinitionDraftDisposition({
    operation: "await-user-answer",
    questionId: facts.nextQuestion.id,
    question: facts.nextQuestion.question,
    questionRevision: facts.nextQuestion.revision,
  });
}

/** Definition-owned completion statuses for an exhausted deferred Review. */
export function resolveReviewDeferralLifecycle({ scope, stepId, disposition } = {}) {
  if (!(disposition instanceof DefinitionReviewDisposition) || disposition.operation !== "defer") return [];
  if (scope === "task") return [];
  if (scope !== "flow") throw new Error("review deferral lifecycle scope is invalid");
  const phase = reviewPhaseForFlowStepId(stepId);
  if (phase === null || phase !== disposition.phase) {
    throw new Error("review deferral lifecycle does not match the definition disposition");
  }
  const actions = [new SetStepStatus({ step: stepId, status: "done" })];
  if (phase === "impl") {
    actions.push(
      new SetStepStatus({ step: "impl-triage", status: "done" }),
      new SetStepStatus({ step: "impl-repair", status: "done" }),
    );
  }
  return actions;
}

/** Compatibility projection for review command envelopes; it is not routing authority. */
export function resolveReviewResultNextStep({ phase, verdict, retryPhase = null, next = null, failNext = null } = {}) {
  if (!["PASS", "ADVISORY", "REJECTED"].includes(verdict)) {
    throw new Error(`unknown review verdict: ${verdict}`);
  }
  if (phase !== "draft") {
    return verdict === "PASS" || verdict === "ADVISORY" ? next : failNext;
  }
  const route = draftReviewRouteForRetryPhase(retryPhase || "draft-questions");
  if (!route) throw new Error(`unknown draft review retry phase: ${retryPhase}`);
  return verdict === "PASS" ? route.passNextStepId : route.triageStepId;
}
function isFinalizeSuccess(result) {
  return FINALIZE_SUCCESS_STATUSES.has(String(result?.status || result?.data?.status || ""));
}

function gateStepIdForPhase(phase) {
  return Object.fromEntries(collectGatePhaseEntries())[phase] || "spec-gate";
}

function draftReviewRouteForInput(input = {}) {
  const retryPhase = input.result?.artifacts?.retryPhase
    || (String(input.phase || "").startsWith("draft-") ? input.phase : null);
  return draftReviewRouteForRetryPhase(retryPhase || "draft-questions");
}

/**
 * Review result persistence records the current result before lifecycle
 * actions run. Definition therefore projects this result as the next metric
 * entry and retains an exhausted rejected flow Review for guarded settlement.
 */
function rejectedFlowReviewReachesExhaustion(input, phase, stepId) {
  if (input.result?.artifacts?.verdict !== "REJECTED") return false;
  if (input.result?.artifacts?.taskId != null) return false;
  const maxAttempts = resolveMaxAttempts({ scope: "flow", stepId, context: input.flowState }) ?? 1;
  return countReviewAttempts(input.flowState?.metrics, phase) + 1 >= maxAttempts;
}

function reviewStepIdForInput(input = {}) {
  const phase = input.result?.artifacts?.phase || input.phase;
  if (phase === "draft" || phase === "draft-questions" || phase === "draft-coverage") {
    return draftReviewRouteForInput(input).reviewStepId;
  }
  return flowReviewRouteForPhase(phase)?.reviewStepId || input.currentStepId || null;
}

export function resolveRuntimeStep(input = {}) {
  const command = input.command || input.action;
  if (command === "run-review") return reviewStepIdForInput(input);
  if (command === "run-gate") return gateStepIdForPhase(input.phase || input.result?.artifacts?.phase);
  if (command === "report") return "report";
  if (String(command || "").startsWith("finalize-")) return command;
  return input.currentStepId || null;
}

function resolveDraftReviewLifecycle(input) {
  const route = draftReviewRouteForInput(input);
  const verdict = input.result?.artifacts?.verdict;
  const actions = [new IncrementMetric({ phase: route.retryPhase, counter: "reviewRetry" })];
  if (!["PASS", "ADVISORY", "REJECTED"].includes(verdict)) return actions;
  if (rejectedFlowReviewReachesExhaustion(input, route.retryPhase, route.reviewStepId)) {
    return [new PersistReviewResult(), ...actions];
  }
  actions.push(new SetStepStatus({ step: route.reviewStepId, status: "done" }));
  if (verdict === "PASS") {
    actions.push(new SetStepStatus({ step: route.triageStepId, status: "done" }));
    actions.push(new SetStepStatus({ step: route.repairStepId, status: "done" }));
  }
  return actions;
}

function resolvePlanReviewLifecycle(input) {
  const phase = input.result?.artifacts?.phase || input.phase;
  const verdict = input.result?.artifacts?.verdict;
  const toolingOutcome = input.result?.artifacts?.toolingOutcome;
  if (phase === "draft" || phase === "draft-questions" || phase === "draft-coverage") {
    const route = nonblockingRouteFor(draftReviewRouteForInput(input).reviewStepId);
    if (input.flowState?.policy?.nonblocking?.enabled === true && route && (verdict === "REJECTED" || toolingOutcome)) {
      return [];
    }
    return resolveDraftReviewLifecycle(input);
  }
  const actions = [];
  // Tooling observations also need their typed ExternalBlocked persistence;
  // the persistence adapter deliberately does not consume semantic budget.
  const recordRetry = true;
  if (phase === "spec") {
    if (input.flowState?.policy?.nonblocking?.enabled === true && (verdict === "REJECTED" || toolingOutcome)) return [];
    if (rejectedFlowReviewReachesExhaustion(input, phase, "spec-review")) {
      return [
        new PersistReviewResult(),
        new IncrementMetric({ phase, counter: "reviewRetry" }),
      ];
    } else if (verdict === "PASS" || verdict === "ADVISORY") {
      actions.push(
        new SetStepStatus({ step: "spec-review", status: "done" }),
        new SetStepStatus({ step: "spec-triage", status: "done" }),
        new SetStepStatus({ step: "spec-repair", status: "done" }),
      );
    } else if (verdict === "REJECTED") {
      actions.push(new SetStepStatus({ step: "spec-review", status: "done" }));
    }
    if (recordRetry) actions.unshift(new IncrementMetric({ phase, counter: "reviewRetry" }));
    return actions;
  }
  if (phase === "test") {
    if (input.flowState?.policy?.nonblocking?.enabled === true && (verdict === "REJECTED" || toolingOutcome)) {
      // A test-review advisory decision must create the same durable
      // acceptance handoff as retry exhaustion before it can advance.
      return actions;
    }
    if (verdict === "PASS" || verdict === "ADVISORY") {
      actions.push(new SetStepStatus({ step: "test-review", status: "done" }));
    } else if (toolingOutcome) {
      actions.push(new AppendIssueLog({ source: "test-review-tooling-failure" }));
    }
    if (recordRetry) actions.unshift(new IncrementMetric({ phase, counter: "reviewRetry" }));
    return actions;
  }
  if (recordRetry) actions.push(new IncrementMetric({ phase, counter: "reviewRetry" }));
  return actions;
}

function resolveImplReviewLifecycle(input) {
  const artifacts = input.result?.artifacts;
  const flowScoped = artifacts?.phase === "impl" && artifacts?.taskId == null;
  if (input.result?.artifacts?.deferred === true) {
    if (!flowScoped) return [];
    return [
      new SetStepStatus({ step: "impl-triage", status: "done" }),
      new SetStepStatus({ step: "impl-repair", status: "done" }),
    ];
  }
  const verdict = input.result?.artifacts?.verdict;
  const toolingOutcome = input.result?.artifacts?.toolingOutcome;
  const proposalCount = input.result?.artifacts?.proposalCount ?? 0;
  const actions = [];
  if (input.flowState?.policy?.nonblocking?.enabled === true && input.result?.artifacts?.phase === "impl" && (
    verdict === "REJECTED" || toolingOutcome
  )) {
    // Evidence stays authoritative; the agent records repair/retry/continue
    // through the guarded nonblocking decision command.
    return actions;
  }
  if (input.result?.artifacts?.phase === "impl") {
    if (toolingOutcome) {
      actions.push(new IncrementMetric({ phase: "impl", counter: "reviewRetry" }));
      return actions;
    }
    if (!flowScoped) {
      if (verdict === "PASS" || verdict === "ADVISORY") {
        actions.push(new SetStepStatus({ step: input.currentStepId || "impl-review", status: "done" }));
      }
      actions.unshift(new IncrementMetric({ phase: "impl", counter: "reviewRetry" }));
      return actions;
    }
    if (flowScoped && rejectedFlowReviewReachesExhaustion(
      input,
      "impl",
      input.currentStepId || "impl-review",
    )) {
      return [
        new PersistReviewResult(),
        new IncrementMetric({ phase: "impl", counter: "reviewRetry" }),
      ];
    }
    if (verdict === "PASS" || verdict === "ADVISORY") {
      actions.push(
        new SetStepStatus({ step: input.currentStepId || "impl-review", status: "done" }),
        new SetStepStatus({ step: "impl-triage", status: "done" }),
        new SetStepStatus({ step: "impl-repair", status: "done" }),
        new SetStepStatus({ step: "impl-gate", status: "in_progress" }),
      );
    } else if (flowScoped && verdict === "REJECTED") {
      actions.push(
        new ResetSteps({ steps: REJECTED_IMPL_REVIEW_RESET_STEPS }),
        new SetStepStatus({ step: input.currentStepId || "impl-review", status: "done" }),
        new SetStepStatus({ step: "impl-triage", status: "in_progress" }),
      );
    }
    actions.unshift(new IncrementMetric({ phase: "impl", counter: "reviewRetry" }));
    return actions;
  }
  if (!input.dryRun && proposalCount > 0) {
    actions.push(new ResetSteps({ steps: IMPL_REVIEW_RESET_RANGE }));
    return actions;
  }
  actions.push(new SetStepStatus({ step: input.currentStepId || "impl-review", status: "done" }));
  return actions;
}

function resolveReviewLifecycle(input) {
  if (input.result?.artifacts?.deferred === true) return [];
  if (input.phase === "draft" || input.phase === "spec" || input.phase === "test") {
    return resolvePlanReviewLifecycle(input);
  }
  return resolveImplReviewLifecycle(input);
}

function resolveGateLifecycle(input) {
  const phase = input.result?.artifacts?.phase || input.phase;
  const active = findActiveNode(input.flowState || {});
  const taskStep = TaskStepIdentity.fromStateNode(input.flowState, active?.stepId);
  const step = phase === "task-impl" && taskStep?.definitionId === "task-gate"
    ? taskStep.nodeId
    : gateStepIdForPhase(phase);
  if (input.event === "gate:pre") {
    return [new SetStepStatus({ step, status: "in_progress" })];
  }
  if (input.result?.artifacts?.deferred === true) return [];
  if (input.flowState?.policy?.nonblocking?.enabled === true && input.result?.result !== "pass" && nonblockingRouteFor(step)) {
    return [];
  }
  const actions = [];
  if (input.result?.result === "pass") {
    actions.push(new SetStepStatus({ step, status: "done" }));
    actions.push(new IncrementMetric({ phase, counter: "gateRetry" }));
    actions.push(new ExecuteSideEffects());
  } else {
    actions.push(new SetStepStatus({ step, status: "in_progress" }));
    actions.push(new IncrementMetric({ phase, counter: "gateRetry" }));
    actions.push(new AppendIssueLog({ source: "gate-result" }));
  }
  return actions;
}

function finalizeMergeMetadataPreflightAction() {
  return new RunLifecycleHook({
    module: "finalize",
    handler: "assertFinalizeMergeMetadataMutationSafe",
  });
}

function resolveFinalizeLifecycle(input) {
  const command = input.command || input.currentStepId || input.targetStepId;
  if (input.event === "finalize:interrupted" && command === "finalize-sync") {
    return [new SetStepStatus({ step: command, status: "skipped" })];
  }
  if (input.event === "finalize:pre") {
    const actions = [];
    if (command === "finalize-merge") {
      actions.push(finalizeMergeMetadataPreflightAction());
    } else if (command === "finalize-sync") {
      actions.push(new RunLifecycleHook({ module: "finalize", handler: "resolveMainRepoFlowManager" }));
    }
    if (command === "finalize-merge") {
      actions.push(new RunLifecycleHook({
        module: "finalize",
        handler: "prepareFinalizeMerge",
        args: { steps: ["finalize-sync", "finalize-cleanup"] },
      }));
      // Record the idempotency key before RunFinalizeMergeCommand can start
      // the merge. The post lifecycle begins the same identity again after
      // authority switches to main, which is how the pending entry is carried
      // into main's flow state without a clean-path metadata-only commit.
      actions.push(new BeginOutboxEffect({ step: command }));
    } else {
      actions.push(new BeginOutboxEffect({ step: command }));
    }
    return actions;
  }
  if (input.event === "finalize:onError") {
    const actions = [];
    if (command === "finalize-merge") {
      actions.push(finalizeMergeMetadataPreflightAction());
    } else if (command === "finalize-sync") {
      actions.push(new RunLifecycleHook({ module: "finalize", handler: "resolveMainRepoFlowManager" }));
    } else if (command === "finalize-cleanup") {
      actions.push(new RunLifecycleHook({ module: "finalize", handler: "resolveCleanupOutboxFlowManager" }));
    }
    if (command === "finalize-merge") {
      actions.push(new FailOutboxEffect({ step: command }));
      actions.push(new SkipSteps({ steps: ["finalize-sync", "finalize-cleanup"] }));
    } else {
      actions.push(new FailOutboxEffect({ step: command }));
      if (command === "finalize-sync") {
        actions.push(new SetStepStatus({ step: command, status: "skipped" }));
      }
    }
    actions.push(new RunLifecycleHook({ module: "finalize", handler: "finalizeOnError", args: { command } }));
    if (command === "finalize-merge") {
      actions.push(new RunLifecycleHook({
        module: "finalize",
        handler: "commitFinalizeMergeConflictMetadata",
      }));
    }
    return actions;
  }
  if (!isFinalizeSuccess(input.result)) return [new FailOutboxEffect({ step: command })];
  const actions = [];
  if (command === "finalize-merge" || command === "finalize-sync" || command === "finalize-cleanup") {
    actions.push(new RunLifecycleHook({
      module: "finalize",
      handler: "resolveMainRepoFlowManager",
      args: command === "finalize-merge" ? { unlessPr: true } : null,
    }));
  }
  if (command === "finalize-merge") {
    actions.push(
      new BeginOutboxEffect({ step: command }),
      new RunLifecycleHook({ module: "finalize", handler: "ensureFinalizeMergeInProgress" }),
      new RunLifecycleHook({ module: "finalize", handler: "recordMergeOutcome" }),
      new RunLifecycleHook({
        module: "finalize",
        handler: "resetSkippedDownstreamSteps",
        args: { steps: ["finalize-sync", "finalize-cleanup"] },
      }),
    );
  }
  actions.push(new SetStepStatus({
    step: command,
    status: "done",
    // A retried merge restores its downstream leaves for the next normal
    // command; it does not begin finalize-sync as part of merge completion.
    suppressAutoPromotion: command === "finalize-merge",
  }));
  actions.push(new CompleteOutboxEffect({ step: command }));
  return actions;
}

function resolveReportLifecycle(input) {
  if (input.event === "report:pre") return [new BeginOutboxEffect({ step: "report" })];
  if (input.event === "report:onError") return [new FailOutboxEffect({ step: "report" })];
  if (input.result?.result !== "ok") return [new FailOutboxEffect({ step: "report" })];
  return [
    new SetStepStatus({ step: "report", status: "done" }),
    new CompleteOutboxEffect({ step: "report" }),
  ];
}

function resolveAcceptanceReviewLifecycle(input) {
  if (input.event !== "acceptance-review:post") return [];
  // A mechanically blocked review deliberately retains its active Attempt:
  // it is evidence for a later retry/recovery, not a completed acceptance.
  if (input.result?.verdict === "blocked") return [];
  return [new SetStepStatus({ step: "acceptance-review", status: "done" })];
}

function resolveLifecycleForNode(node, input = {}) {
  if (input.event === "acceptance-review:post" || node.id === "acceptance-review") {
    return resolveAcceptanceReviewLifecycle(input);
  }
  if (input.event === "review:post" || node.action === "run-review") return resolveReviewLifecycle(input);
  if (input.event === "gate:post" || node.action === "run-gate") return resolveGateLifecycle(input);
  if (String(input.event || "").startsWith("report:") || node.action === "run-report") {
    return resolveReportLifecycle(input);
  }
  if (String(input.event || "").startsWith("finalize:") || String(node.action || "").startsWith("run-finalize-")) {
    return resolveFinalizeLifecycle(input);
  }
  return [];
}

export function resolveLifecycle(input = {}) {
  if (input.event === "set-step:impl-triage") {
    return [
      new SetStepStatus({ step: "impl-repair", status: "done" }),
      new SetStepStatus({ step: "impl-gate", status: "in_progress" }),
    ];
  }
  if ([
    "gate:defer",
    "gate:phase-inference",
    "review:defer",
    "finalize-cleanup:complete",
    "definition:keep-in-progress",
    "definition:skip-steps",
    "test-execute:post",
    "scenario-validity:post",
    "test-result-review:post",
    "retro:post",
    "final-regression:post",
  ].includes(input.event)) {
    return [new SetStepStatus({ step: input.targetStepId, status: input.status })];
  }
  const stepId = input.currentStepId || resolveRuntimeStep(input);
  const taskStep = TaskStepIdentity.fromStateNode(input.flowState, stepId);
  const definitionStepId = taskStep?.definitionId ?? stepId;
  const node = definitionStepId ? (getFlowNode(definitionStepId) || getTaskNode(definitionStepId)) : null;
  if (!node) return [];
  const actions = node.resolveLifecycle({
    ...input,
    currentStepId: definitionStepId,
  });
  if (taskStep === null) return actions;
  return actions.map((action) => (
    action instanceof SetStepStatus && action.step === definitionStepId
      ? action.forStep(taskStep.nodeId)
      : action
  ));
}

export function resolveLifecyclePlan(input = {}) {
  let actions = resolveLifecycle(input);
  const currentStepId = input.currentStepId || resolveRuntimeStep(input) || input.targetStepId || null;
  if (
    input.event === "draft-refine:confirm"
    && input.flowState?.autoApprove !== true
    && input.draftTransitionFacts instanceof DraftTransitionFacts
    && input.draftTransitionFacts.candidateQuestion !== null
    && input.draftTransitionFacts.nextQuestion === null
  ) {
    const candidate = input.draftTransitionFacts.candidateQuestion;
    const baseline = input.draftCatalogBaseline;
    if (!baseline || typeof baseline.digest !== "string" || !Number.isSafeInteger(baseline.byteLength)) {
      throw new Error("draft-refine promotion requires a catalog baseline");
    }
    actions = [new PromoteDraftQuestionAndKeepRefineActive({
      questionId: candidate.id,
      questionRevision: candidate.revision,
      digest: baseline.digest,
      byteLength: baseline.byteLength,
    })];
  }
  if (input.settleInProgressAsDone === true) {
    actions = actions.map((action) => (
      action instanceof SetStepStatus
        && action.step === currentStepId
        && action.status === "in_progress"
        ? new SetStepStatus({ step: action.step, status: "done" })
        : action
    ));
  }
  return new DefinitionLifecyclePlan(DEFINITION_LIFECYCLE_PLAN_TOKEN, {
    event: input.event,
    currentStepId,
    actions,
  });
}

export class FlowExecutionCommand {
  constructor(subcommand, ...args) {
    const tokens = [subcommand, ...args];
    if (tokens.some((token) => (
      typeof token !== "string" || token.trim() === "" || /\s/.test(token)
    ))) {
      throw new Error("flow execution command tokens must be non-empty strings without whitespace");
    }
    this.subcommand = subcommand;
    this.args = Object.freeze([...args]);
    this.tokens = Object.freeze(["sennel", "flow", "run", ...tokens]);
    Object.freeze(this);
  }

  toString() {
    return this.tokens.join(" ");
  }

  runArguments() {
    return [...this.tokens.slice(3)];
  }
}

/** The one authority permitted to terminally handle a parent command failure. */
export const DEFINITION_FAILURE_OWNERS = Object.freeze([
  DefinitionFailureOwnership.dispatcherPrimary(),
  DefinitionFailureOwnership.commandPrimaryWithDispatcherFallback(),
  DefinitionFailureOwnership.commandExclusive(),
  DefinitionFailureOwnership.lifecycleOutbox(),
]);

class FlowNode {
  constructor({
    id,
    label,
    action,
    instructionsKey,
    contextKinds = [],
    outputSchemaRef = null,
    requiresApproval = false,
    autoApproveChoiceId = null,
    skippable = false,
    maxAttempts = 1,
    toolingMaxAttempts = null,
    fallbacks = null,
    children = null,
    sideEffects = null,
    gatePhase = null,
    failurePolicy = null,
    failureTargetId = null,
    definitionLifecycleOwned = false,
    executionCommand = null,
    failureOwnership = null,
  }) {
    this.id = id;
    this.label = label;
    this.action = action;
    this.instructionsKey = instructionsKey;
    this.contextKinds = Object.freeze([...contextKinds]);
    this.outputSchemaRef = outputSchemaRef;
    this.requiresApproval = requiresApproval;
    if (autoApproveChoiceId !== null && (requiresApproval !== true || autoApproveChoiceId !== "1")) {
      throw new Error("autoApproveChoiceId must be choice id=1 on an approval-required step");
    }
    this.autoApproveChoiceId = autoApproveChoiceId;
    this.skippable = skippable;
    this.maxAttempts = createMaxAttempts(maxAttempts);
    this.toolingMaxAttempts = toolingMaxAttempts == null ? null : createMaxAttempts(toolingMaxAttempts);
    this.fallbacks = fallbacks ? Object.freeze([...fallbacks]) : null;
    this.children = children ? Object.freeze(children.map((c) => Object.freeze(c))) : null;
    this.sideEffects = sideEffects ? Object.freeze([...sideEffects]) : null;
    this.gatePhase = gatePhase ? Object.freeze([...gatePhase]) : null;
    this.definitionLifecycleOwned = definitionLifecycleOwned === true;
    if (this.definitionLifecycleOwned && !this.action.startsWith("run-")) {
      throw new Error(`definition lifecycle-owned action must start with run-: ${this.action}`);
    }
    if (
      this.definitionLifecycleOwned
      && !(executionCommand instanceof FlowExecutionCommand)
    ) {
      throw new Error(`definition lifecycle-owned step must declare executionCommand: ${this.id}`);
    }
    if (!this.definitionLifecycleOwned && executionCommand !== null) {
      throw new Error(`only definition lifecycle-owned steps may declare executionCommand: ${this.id}`);
    }
    this.executionCommand = executionCommand;
    this.failureOwnership = failureOwnership === null
      ? null
      : DefinitionFailureOwnership.from(failureOwnership);
    if (this.definitionLifecycleOwned && !(this.failureOwnership instanceof DefinitionFailureOwnership)) {
      throw new Error(`definition lifecycle-owned step must declare failureOwnership: ${this.id}`);
    }
    if (!this.definitionLifecycleOwned && this.failureOwnership !== null) {
      throw new Error(`only definition lifecycle-owned steps may declare failureOwnership: ${this.id}`);
    }
    if (failurePolicy === null && failureTargetId !== null) {
      throw new Error(`failureTargetId requires a failurePolicy: ${this.id}`);
    }
    const parsedFailurePolicy = failurePolicy === null
      ? null
      : new DefinitionFailurePolicy(failurePolicy, { targetNodeId: failureTargetId });
    this.failurePolicy = parsedFailurePolicy?.value ?? null;
    this.failureTargetId = parsedFailurePolicy?.targetNodeId ?? null;
  }

  get isBranch() { return this.children != null; }
  get isLeaf() { return this.children == null; }

  resolveMaxAttempts(context = {}) {
    return this.maxAttempts.resolve(context);
  }

  resolveToolingMaxAttempts(context = {}) {
    return this.toolingMaxAttempts?.resolve(context) ?? null;
  }

  resolveLifecycle(input = {}) {
    return resolveLifecycleForNode(this, input);
  }
}

const DRAFT_QUESTIONS_ROUTE = draftReviewRouteForKey("questions");
const DRAFT_COVERAGE_ROUTE = draftReviewRouteForKey("coverage");
const DRAFT_REVIEW_ROUTE_EXPECTATIONS = Object.freeze([
  Object.freeze({
    route: DRAFT_QUESTIONS_ROUTE,
    triageStepId: "draft-questions-triage",
    repairStepId: "draft-questions-repair",
  }),
  Object.freeze({
    route: DRAFT_COVERAGE_ROUTE,
    triageStepId: "draft-coverage-triage",
    repairStepId: "draft-coverage-repair",
  }),
]);
for (const expectation of DRAFT_REVIEW_ROUTE_EXPECTATIONS) {
  if (
    expectation.route.triageStepId !== expectation.triageStepId
    || expectation.route.repairStepId !== expectation.repairStepId
  ) {
    throw new Error(`draft review route mismatch: ${expectation.triageStepId}`);
  }
}
const PLAN_REVIEW_MAX_ATTEMPTS_BY_ID = Object.freeze({
  "draft-questions-review": Object.freeze({ auto: 1, manual: 1 }),
  "draft-coverage-review": Object.freeze({ auto: 1, manual: 1 }),
  "spec-review": Object.freeze({ auto: 4, manual: 4 }),
  "test-review": Object.freeze({ auto: 5, manual: 5 }),
});

function createPlanReviewNode({ id, label, contextKinds, executionCommand }) {
  const maxAttempts = PLAN_REVIEW_MAX_ATTEMPTS_BY_ID[id];
  return new FlowNode({
    id,
    label,
    action: "run-review",
    instructionsKey: `plan.${id}`,
    contextKinds,
    outputSchemaRef: "next-action/review.schema.json",
    maxAttempts,
    toolingMaxAttempts: 1,
    failurePolicy: "retry",
    definitionLifecycleOwned: true,
    executionCommand,
    failureOwnership: DefinitionFailureOwnership.commandPrimaryWithDispatcherFallback(),
  });
}

function createDraftReviewLeafNode({ id, label }) {
  return new FlowNode({
    id,
    label,
    action: "write-draft",
    instructionsKey: `plan.${id}`,
    contextKinds: ["draft", "issue", "guardrail"],
    outputSchemaRef: "next-action/worker-artifact-handoff.schema.json",
    maxAttempts: 1,
  });
}

function createDraftReviewRouteNodes(route) {
  return [
    createDraftReviewLeafNode({
      id: route.triageStepId,
      label: `${route.label} triage`,
    }),
    createDraftReviewLeafNode({
      id: route.repairStepId,
      label: `${route.label} repair`,
    }),
  ];
}

// ── FLOW_DEFINITION ─────────────────────────────────────────────────────────

const FLOW_DEFINITION = Object.freeze([
  new FlowNode({
    id: "plan",
    label: "Plan",
    children: [
      new FlowNode({
        id: "branch",
        label: "Branch",
        action: "create-branch",
        instructionsKey: "plan.branch",
        contextKinds: [],
        skippable: true,
      }),
      new FlowNode({
        id: "prepare-spec",
        label: "Prepare spec",
        action: "prepare-spec",
        instructionsKey: "plan.prepare-spec",
        contextKinds: [],
      }),
      new FlowNode({
        id: "draft",
        label: "Draft",
        action: "write-draft",
        instructionsKey: "plan.draft",
        contextKinds: ["issue", "guardrail", "project_overview"],
        outputSchemaRef: "next-action/worker-artifact-handoff.schema.json",
        maxAttempts: 1,
      }),
      createPlanReviewNode({
        id: "draft-questions-review",
        label: "Review (draft questions)",
        contextKinds: ["draft", "issue"],
        executionCommand: new FlowExecutionCommand("review", "--phase", "draft"),
      }),
      ...createDraftReviewRouteNodes(DRAFT_QUESTIONS_ROUTE),
      new FlowNode({
        id: "draft-refine",
        label: "Draft refine",
        action: "write-draft",
        instructionsKey: "plan.draft-refine",
        contextKinds: ["draft", "issue", "guardrail", "project_overview"],
        outputSchemaRef: "next-action/worker-artifact-handoff.schema.json",
        maxAttempts: 1,
      }),
      createPlanReviewNode({
        id: "draft-coverage-review",
        label: "Review (draft coverage)",
        contextKinds: ["draft", "issue"],
        executionCommand: new FlowExecutionCommand("review", "--phase", "draft"),
      }),
      ...createDraftReviewRouteNodes(DRAFT_COVERAGE_ROUTE),
      new FlowNode({
        id: "draft-gate",
        label: "Gate (draft)",
        action: "run-gate",
        instructionsKey: "plan.draft-gate",
        contextKinds: ["draft", "guardrail"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 5,
        gatePhase: ["draft"],
        failurePolicy: "block",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("gate"),
        failureOwnership: DefinitionFailureOwnership.commandPrimaryWithDispatcherFallback(),
      }),
      new FlowNode({
        id: "spec",
        label: "Spec",
        action: "write-spec",
        instructionsKey: "plan.spec",
        contextKinds: ["draft", "guardrail"],
        outputSchemaRef: "next-action/worker-artifact-handoff.schema.json",
      }),
      createPlanReviewNode({
        id: "spec-review",
        label: "Review (spec)",
        contextKinds: ["spec", "guardrail"],
        executionCommand: new FlowExecutionCommand("review", "--phase", "spec"),
      }),
      new FlowNode({
        id: "spec-triage",
        label: "Spec review triage",
        action: "write-spec",
        instructionsKey: "plan.spec-triage",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/worker-artifact-handoff.schema.json",
        maxAttempts: 1,
      }),
      new FlowNode({
        id: "spec-repair",
        label: "Spec repair",
        action: "write-spec",
        instructionsKey: "plan.spec-repair",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/worker-artifact-handoff.schema.json",
        maxAttempts: 1,
      }),
      new FlowNode({
        id: "spec-gate",
        label: "Gate (spec)",
        action: "run-gate",
        instructionsKey: "plan.spec-gate",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 5,
        gatePhase: ["spec", "task-spec"],
        failurePolicy: "block",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("gate"),
        failureOwnership: DefinitionFailureOwnership.commandPrimaryWithDispatcherFallback(),
      }),
      new FlowNode({
        id: "approval",
        label: "Approval",
        action: "await-approval",
        instructionsKey: "plan.approval",
        contextKinds: ["spec"],
        outputSchemaRef: "next-action/approval.schema.json",
        requiresApproval: true,
        autoApproveChoiceId: "1",
        sideEffects: ["syncSpecTasks"],
      }),
      new FlowNode({
        id: "test",
        label: "Test",
        action: "write-tests",
        instructionsKey: "plan.test",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/worker-artifact-handoff.schema.json",
      }),
      new FlowNode({
        id: "scenario-validity",
        label: "Scenario Validity",
        action: "run-scenario-validity",
        instructionsKey: "plan.scenario-validity",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/scenario-validity.schema.json",
        maxAttempts: 3,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("scenario-validity"),
        failureOwnership: DefinitionFailureOwnership.dispatcherPrimary(),
      }),
      createPlanReviewNode({
        id: "test-review",
        label: "Review (test)",
        contextKinds: ["spec", "guardrail"],
        executionCommand: new FlowExecutionCommand("review", "--phase", "test"),
      }),
    ],
  }),

  new FlowNode({
    id: "impl",
    label: "Implementation",
    children: [
      new FlowNode({
        id: "implement",
        label: "Implement",
        action: "run-impl",
        instructionsKey: "impl.implement",
        contextKinds: ["spec", "test", "overview"],
        outputSchemaRef: "next-action/impl.schema.json",
        maxAttempts: 3,
      }),
      new FlowNode({
        id: "test-execute",
        label: "Test Execute",
        action: "run-test-execute",
        instructionsKey: "impl.test-execute",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/test-execute.schema.json",
        maxAttempts: 3,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("test-execute"),
        failureOwnership: DefinitionFailureOwnership.dispatcherPrimary(),
      }),
      new FlowNode({
        id: "test-result-review",
        label: "Test Result Review",
        action: "run-test-result-review",
        instructionsKey: "impl.test-result-review",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/test-result-review.schema.json",
        maxAttempts: 3,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("test-result-review"),
        failureOwnership: DefinitionFailureOwnership.dispatcherPrimary(),
      }),
      new FlowNode({
        id: "impl-review",
        label: "Review",
        action: "run-review",
        instructionsKey: "impl.impl-review",
        contextKinds: ["spec", "diff", "testlog"],
        outputSchemaRef: "next-action/review.schema.json",
        maxAttempts: 4,
        toolingMaxAttempts: 1,
        failurePolicy: "retry",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("review", "--phase", "impl"),
        failureOwnership: DefinitionFailureOwnership.commandPrimaryWithDispatcherFallback(),
      }),
      new FlowNode({
        id: "impl-triage",
        label: "Implementation review triage",
        action: "write-impl-triage",
        instructionsKey: "impl.impl-triage",
        contextKinds: ["spec", "diff"],
        outputSchemaRef: "next-action/impl.schema.json",
        maxAttempts: 1,
      }),
      new FlowNode({
        id: "impl-repair",
        label: "Implementation repair",
        action: "run-impl-repair",
        instructionsKey: "impl.impl-repair",
        contextKinds: ["spec", "diff"],
        outputSchemaRef: "next-action/impl.schema.json",
        maxAttempts: 3,
      }),
      new FlowNode({
        id: "impl-gate",
        label: "Gate (impl)",
        action: "run-gate",
        instructionsKey: "impl.impl-gate",
        contextKinds: ["spec", "diff", "testlog"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 5,
        sideEffects: [],
        gatePhase: ["integration", "task-impl"],
        failurePolicy: "block",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("gate"),
        failureOwnership: DefinitionFailureOwnership.commandPrimaryWithDispatcherFallback(),
      }),
      new FlowNode({
        id: "retro",
        label: "Retrospective",
        action: "run-retro",
        instructionsKey: "impl.retro",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/retro.schema.json",
        maxAttempts: 2,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("retro"),
        failureOwnership: DefinitionFailureOwnership.dispatcherPrimary(),
      }),
      new FlowNode({
        id: "acceptance-review",
        label: "Acceptance Review",
        action: "run-acceptance-review",
        instructionsKey: "impl.acceptance-review",
        contextKinds: ["spec", "diff", "test", "issue-log", "retro", "report"],
        outputSchemaRef: "next-action/acceptance-review.schema.json",
        maxAttempts: 1,
        sideEffects: ["promoteFinalRegression"],
        failurePolicy: "amend-spec",
        failureTargetId: "spec",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("acceptance-review"),
        failureOwnership: DefinitionFailureOwnership.commandPrimaryWithDispatcherFallback(),
      }),
      new FlowNode({
        id: "acceptance-decision",
        label: "Acceptance decision",
        action: "set-acceptance-decision",
        instructionsKey: "impl.acceptance-decision",
        contextKinds: ["spec", "diff", "test"],
        outputSchemaRef: "next-action/acceptance-review.schema.json",
        // This is a guarded, tokenless user-decision scene.  Its typed
        // await_user_decision directive is assembled by get-next-action;
        // it must never receive an approval token or autoApprove treatment.
        maxAttempts: 1,
      }),
      new FlowNode({
        id: "final-regression",
        label: "Final Regression",
        action: "run-final-regression",
        instructionsKey: "impl.final-regression",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/final-regression.schema.json",
        maxAttempts: 2,
        failurePolicy: "retry",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("final-regression"),
        failureOwnership: DefinitionFailureOwnership.commandPrimaryWithDispatcherFallback(),
      }),
      new FlowNode({
        id: "report",
        label: "Report",
        action: "run-report",
        instructionsKey: "impl.report",
        contextKinds: ["spec", "diff", "test", "issue-log", "retro"],
        outputSchemaRef: "next-action/report.schema.json",
        maxAttempts: 2,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("report"),
        failureOwnership: DefinitionFailureOwnership.lifecycleOutbox(),
      }),
      new FlowNode({
        id: "finalize",
        label: "Finalize",
        children: [
          new FlowNode({
            id: "finalize-commit",
            label: "Commit",
            action: "run-finalize-commit",
            instructionsKey: "impl.finalize-commit",
            contextKinds: ["spec", "diff"],
            outputSchemaRef: "next-action/finalize.schema.json",
            requiresApproval: true,
            autoApproveChoiceId: "1",
            definitionLifecycleOwned: true,
            executionCommand: new FlowExecutionCommand("finalize-commit"),
            failureOwnership: DefinitionFailureOwnership.lifecycleOutbox(),
          }),
          new FlowNode({
            id: "finalize-merge",
            label: "Merge",
            action: "run-finalize-merge",
            instructionsKey: "impl.finalize-merge",
            contextKinds: ["spec", "diff"],
            outputSchemaRef: "next-action/finalize.schema.json",
            definitionLifecycleOwned: true,
            executionCommand: new FlowExecutionCommand("finalize-merge"),
            failureOwnership: DefinitionFailureOwnership.lifecycleOutbox(),
          }),
          new FlowNode({
            id: "finalize-sync",
            label: "Sync",
            action: "run-finalize-sync",
            instructionsKey: "impl.finalize-sync",
            contextKinds: ["spec"],
            outputSchemaRef: "next-action/finalize.schema.json",
            // An interrupted sync has no durable worker result to retry. The
            // recovery path records its failed outbox Activity, then skips
            // this leaf so cleanup can retain the persisted evidence.
            skippable: true,
            definitionLifecycleOwned: true,
            executionCommand: new FlowExecutionCommand("finalize-sync"),
            failureOwnership: DefinitionFailureOwnership.lifecycleOutbox(),
          }),
          new FlowNode({
            id: "finalize-cleanup",
            label: "Cleanup",
            action: "run-finalize-cleanup",
            instructionsKey: "impl.finalize-cleanup",
            contextKinds: ["spec"],
            outputSchemaRef: "next-action/finalize.schema.json",
            definitionLifecycleOwned: true,
            executionCommand: new FlowExecutionCommand("finalize-cleanup"),
            failureOwnership: DefinitionFailureOwnership.lifecycleOutbox(),
          }),
        ],
      }),
    ],
  }),
]);

// ── TASK_DEFINITION ─────────────────────────────────────────────────────────

const TASK_DEFINITION = Object.freeze([
  new FlowNode({
    id: "task-impl",
    label: "Task impl",
    action: "run-impl",
    instructionsKey: "task.task-impl",
    contextKinds: ["task_spec", "related_summary", "overview"],
    outputSchemaRef: "next-action/impl.schema.json",
  }),
  new FlowNode({
    id: "task-review",
    label: "Task review",
    action: "run-review",
    instructionsKey: "task.task-review",
    contextKinds: ["task_spec", "diff", "testlog"],
    outputSchemaRef: "next-action/review.schema.json",
    maxAttempts: 4,
    toolingMaxAttempts: 1,
    failurePolicy: "retry",
    definitionLifecycleOwned: true,
    executionCommand: new FlowExecutionCommand("review", "--phase", "impl"),
    failureOwnership: DefinitionFailureOwnership.commandPrimaryWithDispatcherFallback(),
  }),
  new FlowNode({
    id: "task-gate",
    label: "Task gate",
    action: "run-gate",
    instructionsKey: "impl.impl-gate",
    contextKinds: ["task_spec", "guardrail"],
    outputSchemaRef: "next-action/gate.schema.json",
    maxAttempts: 5,
    sideEffects: ["mergeOverview"],
    failurePolicy: "block",
    definitionLifecycleOwned: true,
    executionCommand: new FlowExecutionCommand("gate"),
    failureOwnership: DefinitionFailureOwnership.commandPrimaryWithDispatcherFallback(),
  }),
]);

// ── Gate-phase collection ───────────────────────────────────────────────────

/**
 * Collect [phase, stepId] pairs from all gate nodes across FLOW_DEFINITION
 * and TASK_DEFINITION. Order follows definition order.
 */
export function collectGatePhaseEntries() {
  const entries = [];
  function walk(nodes, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.children) {
        walk(node.children, depth + 1);
      } else if (node.gatePhase) {
        for (const phase of node.gatePhase) {
          entries.push([phase, node.id]);
        }
      }
    }
  }
  walk(FLOW_DEFINITION, 1);
  walk(TASK_DEFINITION, 1);
  return entries;
}

export function collectFlowLeafIds() {
  return collectLeafIds(FLOW_DEFINITION);
}

export function flowLeafIdsBetween(startId, endId) {
  const ids = collectFlowLeafIds();
  const start = ids.indexOf(startId);
  const end = ids.indexOf(endId);
  if (start < 0 || end < start) throw new Error(`flow definition range not found: ${startId}..${endId}`);
  return ids.slice(start, end + 1);
}

export function collectTaskLeafIds() {
  return collectLeafIds(TASK_DEFINITION);
}

export function deriveFlowPhaseMap() {
  return derivePhaseMap(FLOW_DEFINITION);
}

export function getFlowDefinitionOrder() {
  return collectFlowLeafIds();
}

export function getTaskDefinitionOrder() {
  return collectTaskLeafIds();
}

export function collectFlowNodes() {
  return [...FLOW_DEFINITION];
}

export function collectTaskNodes() {
  return [...TASK_DEFINITION];
}

/**
 * Produce the explicit input contract for the next-generation state model.
 *
 * This is intentionally an adapter, not a converter: it reads the production
 * definition only and never reads or rewrites the currently deployed
 * flow.json.  The migration work can therefore select this contract without a
 * legacy-schema fallback or a double-write bridge.
 */
export function buildCurrentFlowDefinition() {
  // These leaves are bypassable only by the typed nonblocking continuation
  // Activity, whose evidence-bound decision is recorded in the same ledger.
  // Normal lifecycle callers still have no generic skip transition API.
  const advisorySkippable = new Set([
    "branch",
    "draft-questions-triage", "draft-questions-repair",
    "draft-coverage-triage", "draft-coverage-repair",
    "spec-triage", "spec-repair", "impl-triage", "impl-repair",
    "acceptance-decision",
  ]);
  // These two leaves may be bypassed only by the fixed,
  // evidence-consuming preimplementation bootstrap Activity.  The reachable
  // states remain part of the definition so journal replay can validate that
  // Activity without accepting an unmodelled persistence exception.
  const preimplementationBootstrapSkippable = new Set(["scenario-validity", "test-review"]);
  const existingImplementationCompletion = new Set(["implement"]);
  const finalizationRouteLeaves = new Set(["finalize-sync", "finalize-cleanup"]);
  const transitionsFor = ({ skippable = false, triageNoRepair = false, preimplementationBootstrap = false, existingImplementation = false, finalizationRoute = false, failurePolicy = null } = {}) => [
    "pending:in_progress",
    "in_progress:done",
    ...(skippable ? ["in_progress:skipped"] : []),
    // The impl-repair leaf may be skipped only by the typed all-reject
    // implementation-triage Activity. It can be pending on the normal
    // review route or invalidated on the acceptance-repair route.
    ...(triageNoRepair ? ["pending:skipped", "invalidated:skipped"] : []),
    ...(preimplementationBootstrap ? ["pending:skipped", "in_progress:skipped"] : []),
    ...(existingImplementation ? ["pending:done"] : []),
    // These suffix leaves are skipped/reset only by the typed
    // finalization-downstream Activity while finalize-merge is active.  The
    // definition still declares their reachable states so replay validation
    // remains an authority check rather than a persistence exception.
    ...(finalizationRoute ? ["pending:skipped", "skipped:pending"] : []),
    ...(["retry", "record"].includes(failurePolicy)
      ? ["in_progress:failed", "failed:in_progress", "failed:invalidated"]
      : []),
    "done:in_progress",
    "skipped:in_progress",
    "invalidated:in_progress",
    "pending:invalidated",
    "in_progress:invalidated",
    "done:invalidated",
    "skipped:invalidated",
  ];
  const transitionContract = (node) => new CurrentFlowNodeContract({
    // Existing maxAttempts counts the initial Attempt.  The next-generation
    // contract keeps only retry budgets, so it subtracts that initial work.
    semanticRetryLimit: node.resolveMaxAttempts({ autoApprove: false }) - 1,
    // null remains an explicit zero-budget tooling policy in NodeContract.
    toolingRetryLimit: node.resolveToolingMaxAttempts({ autoApprove: false }),
    transitions: transitionsFor({
      ...node,
      triageNoRepair: node.id === "impl-repair",
      skippable: node.skippable === true || advisorySkippable.has(node.id),
      preimplementationBootstrap: preimplementationBootstrapSkippable.has(node.id),
      existingImplementation: existingImplementationCompletion.has(node.id),
      finalizationRoute: finalizationRouteLeaves.has(node.id),
    }),
    // Context requirements stay definition-owned. Current Attempt claims may
    // cover them as completed operations or typed incomplete operations, but
    // never copy the contract into flow.json.
    resourceContract: { required: node.contextKinds, authority: "definition" },
  });
  const actionMetadata = (node, sourceScopes) => ({
    action: node.action ?? null,
    instructionsKey: node.instructionsKey ?? null,
    contextKinds: [...node.contextKinds],
    outputSchemaRef: node.outputSchemaRef ?? null,
    requiresApproval: node.requiresApproval === true,
    autoApproveChoiceId: node.autoApproveChoiceId ?? null,
    maxAttempts: node.resolveMaxAttempts({ autoApprove: false }),
    sideEffects: node.sideEffects ? [...node.sideEffects] : null,
    failurePolicy: new DefinitionFailurePolicy(node.failurePolicy ?? "block", {
      targetNodeId: node.failureTargetId ?? null,
    }),
    executionCommand: node.executionCommand?.toString() ?? null,
    failureOwnership: node.failureOwnership,
    artifactAuthority: { sourceScopes },
  });
  const adapt = (node, kind = "step", sourceScopes = ["all_tasks", "flow"]) => new CurrentFlowDefinitionNode({
    kind,
    id: node.id,
    key: node.instructionsKey || node.id,
    contract: transitionContract(node),
    steps: (node.children || []).map((child) => adapt(child, "step", sourceScopes)),
    action: node.children ? null : actionMetadata(node, sourceScopes),
  });
  return new CurrentFlowDefinition({
    root: new CurrentFlowDefinitionNode({
      kind: "flow",
      id: "flow",
      key: "flow",
      contract: new CurrentFlowNodeContract({
        semanticRetryLimit: 0,
        toolingRetryLimit: null,
        resourceContract: { required: [], authority: "definition" },
        transitions: transitionsFor(),
      }),
      steps: FLOW_DEFINITION.map((node) => adapt(node)),
    }),
    taskTemplate: new CurrentFlowDefinitionNode({
      kind: "task",
      id: "task",
      key: "task",
      contract: new CurrentFlowNodeContract({
        semanticRetryLimit: 0,
        toolingRetryLimit: null,
        resourceContract: { required: [], authority: "definition" },
        transitions: transitionsFor(),
      }),
      steps: TASK_DEFINITION.map((node) => adapt(node, "step", ["same_task", "flow"])),
    }),
    dynamicTaskContainerId: "impl",
    dynamicTaskInsertionAfterId: "implement",
  });
}

export function getFlowNode(id) {
  return resolveNodeFor(FLOW_DEFINITION, id);
}

export function getTaskNode(id) {
  return resolveNodeFor(TASK_DEFINITION, id);
}

export function resolveMaxAttempts({ scope = "flow", stepId, context = {} }) {
  const node = scope === "task" ? getTaskNode(stepId) : getFlowNode(stepId);
  return node?.resolveMaxAttempts(context) ?? null;
}

export function resolveToolingMaxAttempts({ scope = "flow", stepId, context = {} }) {
  const node = scope === "task" ? getTaskNode(stepId) : getFlowNode(stepId);
  return node?.resolveToolingMaxAttempts(context) ?? null;
}

export function resolveSideEffects({ scope = "flow", stepId }) {
  const node = scope === "task" ? getTaskNode(stepId) : getFlowNode(stepId);
  return node?.sideEffects ? [...node.sideEffects] : null;
}

export function isDefinitionLifecycleOwnedStep({ scope = "flow", stepId }) {
  const node = scope === "task" ? getTaskNode(stepId) : getFlowNode(stepId);
  return node?.definitionLifecycleOwned === true;
}

/**
 * Resolve the definition-owned command for a leaf that mutates canonical Flow
 * state.  The returned value keeps argv tokenized; callers must never recover
 * a command by parsing a human-readable instruction string.
 */
export function resolveDispatcherOwnedFlowAction({ scope = "flow", stepId }) {
  const node = scope === "task" ? getTaskNode(stepId) : getFlowNode(stepId);
  if (node?.definitionLifecycleOwned !== true) return null;
  return Object.freeze({
    action: node.action,
    executionCommand: node.executionCommand,
  });
}

export function deriveFlowPrereqs(targetId) {
  return derivePrereqs(FLOW_DEFINITION, targetId);
}

export function getFlowBranchLeafIds(parentId) {
  const parent = getFlowNode(parentId);
  if (!parent?.children) return [];
  return flattenSteps(parent.children).map((step) => step.id);
}

// ── Traversal helpers ───────────────────────────────────────────────────────

function assertDepth(depth) {
  if (depth > MAX_DEPTH) {
    throw new Error(`definition depth exceeds maximum (${MAX_DEPTH})`);
  }
}

/**
 * Collect all leaf node IDs from a definition tree in document order.
 */
export function collectLeafIds(definition) {
  const ids = [];
  function walk(nodes, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.children) {
        walk(node.children, depth + 1);
      } else {
        ids.push(node.id);
      }
    }
  }
  walk(definition, 1);
  return ids;
}

/**
 * Derive a phase map (leaf id → branch id) from a definition tree.
 */
export function derivePhaseMap(definition) {
  const map = {};
  function walk(nodes, parentId, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.children) {
        walk(node.children, node.id, depth + 1);
      } else {
        map[node.id] = parentId;
      }
    }
  }
  walk(definition, null, 1);
  return map;
}

/**
 * Look up a node by id (any depth) in the definition tree.
 */
export function resolveNodeFor(definition, id) {
  function walk(nodes, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = walk(node.children, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(definition, 1);
}

/**
 * Find the currently active (in_progress) leaf in a nested steps structure,
 * matching against the definition tree for navigation.
 *
 * Returns `{ scope: "flow"|"task", taskId, stepId }` or null.
 */
export function findActiveNode({ steps, tasks, currentTaskId }) {
  if (currentTaskId != null && Array.isArray(tasks)) {
    const task = tasks.find((t) => t.id === currentTaskId);
    if (task && Array.isArray(task.steps)) {
      const step = findLatestInProgressLeaf(task.steps, TASK_DEFINITION);
      if (step) return { scope: "task", taskId: currentTaskId, stepId: step.id };
    }
  }
  const step = findLatestInProgressLeaf(steps, FLOW_DEFINITION);
  if (step) return { scope: "flow", taskId: null, stepId: step.id };
  return null;
}

export function taskIdForResolvedStep(activeNode, targetStepId) {
  return activeNode?.stepId === targetStepId ? activeNode.taskId : null;
}

const MAX_IN_PROGRESS_STEP_SCAN = 500;
const DEFINITION_ORDER_CACHE = new WeakMap();

function scanLatestInProgressLeaf(steps, order, state, depth = 1) {
  assertDepth(depth);
  if (!Array.isArray(steps)) return state;
  for (const s of steps) {
    state.scanned += 1;
    if (state.scanned > MAX_IN_PROGRESS_STEP_SCAN) {
      throw new Error(`too many flow steps while resolving active step (max ${MAX_IN_PROGRESS_STEP_SCAN})`);
    }
    if (s.children) {
      scanLatestInProgressLeaf(s.children, order, state, depth + 1);
      continue;
    }
    if (s.status === "in_progress") {
      if (!order.has(s.id)) {
        if (!state.unknownStep) state.unknownStep = s;
        continue;
      }
      const index = order.get(s.id);
      if (!state.step || index >= state.index) {
        state.step = s;
        state.index = index;
      }
    }
  }
  return state;
}

function orderMapForDefinition(definition) {
  let order = DEFINITION_ORDER_CACHE.get(definition);
  if (!order) {
    order = new Map(collectLeafIds(definition).map((id, idx) => [id, idx]));
    DEFINITION_ORDER_CACHE.set(definition, order);
  }
  return order;
}

export function findLatestInProgressLeaf(steps, definition = FLOW_DEFINITION) {
  const order = orderMapForDefinition(definition);
  const selected = scanLatestInProgressLeaf(
    steps,
    order,
    { step: null, unknownStep: null, index: -1, scanned: 0 },
  );
  return selected.unknownStep || selected.step;
}

/**
 * Derive the next action envelope fields from the definition for a given step.
 *
 * Returns definition-owned action metadata, including the declared executionCommand,
 * for the step identified by `scope` ("flow" or "task") and `stepId`.
 */
export function deriveNextAction({ scope = "flow", stepId, context = {} }) {
  const def = scope === "task" ? TASK_DEFINITION : FLOW_DEFINITION;
  const node = resolveNodeFor(def, stepId);
  if (!node) return null;
  return {
    action: node.action,
    instructionsKey: node.instructionsKey,
    contextKinds: [...node.contextKinds],
    outputSchemaRef: node.outputSchemaRef,
    requiresApproval: node.requiresApproval,
    autoApproveChoiceId: node.autoApproveChoiceId,
    maxAttempts: node.resolveMaxAttempts(context),
    sideEffects: node.sideEffects ? [...node.sideEffects] : null,
    failurePolicy: node.failurePolicy,
    executionCommand: node.executionCommand?.toString() ?? null,
  };
}

/**
 * Build initial nested steps from the definition tree.
 * Branch nodes get `{ id, status: "pending", children: [...] }`;
 * leaf nodes get `{ id, status: "pending" }`.
 *
 * The first leaf is promoted to "in_progress".
 */
export function buildInitialNestedSteps(definition = FLOW_DEFINITION) {
  function buildNode(node) {
    if (node.children) {
      return { id: node.id, status: "pending", children: node.children.map(buildNode) };
    }
    return { id: node.id, status: "pending" };
  }
  const steps = definition.map(buildNode);
  const firstLeaf = findFirstPendingLeaf(steps);
  if (firstLeaf) firstLeaf.status = "in_progress";
  return steps;
}

/**
 * Build initial task-level steps from TASK_DEFINITION.
 */
export function buildInitialTaskSteps() {
  return TASK_DEFINITION.map((node) => ({ id: node.id, status: "pending" }));
}

/**
 * Derive prerequisite step ids for a given target step from the definition.
 * Prerequisites are all leaf steps in branches that appear before the target's
 * branch in the definition.
 */
export function derivePrereqs(definition, targetId) {
  const targetBranchIdx = findBranchIndexForLeaf(definition, targetId);
  if (targetBranchIdx < 0) return [];

  const prereqs = [];
  for (let i = 0; i < targetBranchIdx; i++) {
    const branch = definition[i];
    if (branch.children) {
      const lastLeaf = getLastLeaf(branch.children);
      if (lastLeaf) prereqs.push(lastLeaf.id);
    }
  }
  return prereqs;
}

function findBranchIndexForLeaf(definition, leafId) {
  for (let i = 0; i < definition.length; i++) {
    const branch = definition[i];
    if (branch.id === leafId) return i;
    if (branch.children && resolveNodeFor([branch], leafId)) return i;
  }
  return -1;
}

function getLastLeaf(nodes) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.children) {
      const found = getLastLeaf(n.children);
      if (found) return found;
    } else {
      return n;
    }
  }
  return null;
}

/**
 * Check if a step is a branch containing a leaf with the given id.
 * Returns the branch node or null.
 */
export function findBranchForLeaf(definition, leafId) {
  for (const branch of definition) {
    if (branch.children && resolveNodeFor([branch], leafId)) return branch;
  }
  return null;
}

export { FlowNode };
