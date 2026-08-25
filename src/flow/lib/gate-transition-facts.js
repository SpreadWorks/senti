/**
 * Canonical, read-only Gate transition facts.
 *
 * This is deliberately the one place that translates a Version-1 Attempt,
 * catalog publication, and gate result history into the input accepted by
 * definition.js.  Commands must not reconstruct any of these identities
 * from their invocation arguments or process-local state.
 */
import { GateFailureCategory, GateTransitionFacts } from "./gate-transition.js";
import { CanonicalCommandAttemptArtifactHistory } from "./canonical-command-result.js";
import { canonicalGateNodeId } from "./canonical-gate-artifacts.js";
import { inspectCanonicalPlanGateRepair } from "./plan-gate-repair.js";

function required(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function gateKeys(phase, taskId) {
  if (phase === "draft") return { result: "draft.gate", source: "draft.gate.source", parameters: {} };
  if (phase === "spec" || phase === "task-spec") return { result: "spec.gate", source: "spec.gate.source", parameters: {} };
  if (phase === "task-impl" && taskId !== null) {
    return { result: "task.gate", source: "task.gate.source", parameters: { taskId } };
  }
  return { result: "impl.gate", source: "impl.gate.source", parameters: {} };
}

function scopeFor(phase, taskId) {
  return phase === "task-impl" && taskId !== null ? "task" : "flow";
}

function resultFailure(payload, attempt) {
  if (payload?.result !== "fail") return null;
  const artifactCategory = payload?.artifacts?.gateTransitionFailureCategory ?? null;
  const attemptCategory = attempt?.failure === null || attempt?.failure === undefined
    ? null
    : { category: attempt.failure.category, code: attempt.failure.code };
  // A Gate observation and its active Attempt are one canonical failure
  // record. During post-publication admission the result supplies the fact;
  // after failure recording the Attempt supplies the same fact. If both are
  // present they must agree, so an old or rewritten artifact cannot change a
  // semantic decision.
  if (artifactCategory === null && attemptCategory === null) {
    throw new Error("canonical failed Gate observation has no failure classification");
  }
  const artifact = artifactCategory === null ? null : new GateFailureCategory(artifactCategory);
  const attemptFailure = attemptCategory === null ? null : new GateFailureCategory(attemptCategory);
  if (artifact !== null && attemptFailure !== null
    && (artifact.category !== attemptFailure.category || artifact.code !== attemptFailure.code)) {
    throw new Error("canonical Gate result and current Attempt failure classification disagree");
  }
  return (artifact ?? attemptFailure).toJSON();
}

function currentGateActivity({ flowManager, state, nodeId, attempt }) {
  const matches = flowManager.activityLedger(state.specId).filter((activity) => (
    activity.nodeId === nodeId
    && activity.attemptId === attempt.id
    && activity.sequence === attempt.sequence
  ));
  // Publication's activity is canonical proof of the exact producer. An
  // Attempt may have a start Activity too, so select the catalog-associated
  // activity below rather than relying on chronology.
  return matches;
}

/**
 * Return null when the current Gate Attempt has not published a result yet.
 * All malformed, stale, or mismatched evidence throws: callers must reject
 * rather than turn an unavailable publication into a guessed transition.
 */
export function readCurrentGateTransitionFacts({ flowManager, flowState, phase } = {}) {
  if (!flowManager || typeof flowManager.canonicalState !== "function"
    || typeof flowManager.loadReadOnly !== "function"
    || typeof flowManager.readProducerArtifact !== "function"
    || typeof flowManager.activityLedger !== "function") {
    throw new Error("canonical Gate transition facts require FlowManager catalog APIs");
  }
  const specId = required(flowState?.specId, "gate Flow specId");
  const currentView = flowManager.loadReadOnly(specId);
  const state = flowManager.canonicalState(specId);
  if (state === null || state.current === null || state.attempt === null) return null;
  if (currentView?.runId !== state.runId || currentView?.specId !== state.specId) {
    throw new Error("canonical Gate projected state does not match its persisted identity");
  }
  const taskId = currentView.currentTaskId ?? null;
  const nodeId = canonicalGateNodeId({ phase: required(phase, "gate phase"), taskId });
  if (state.current.at(-1) !== nodeId || state.attempt.nodeId !== nodeId) return null;
  const attempt = state.attempt;
  const keys = gateKeys(phase, taskId);
  const resultSource = flowManager.readProducerArtifact({
    specId: state.specId, nodeId, logicalKey: keys.result, parameters: keys.parameters, optional: true,
  });
  if (resultSource === null) return null;
  const history = CanonicalCommandAttemptArtifactHistory.fromBytes({ logicalKey: keys.result, bytes: resultSource.bytes });
  if (history.current.attempt < attempt.sequence) return null;
  if (history.current.attempt !== attempt.sequence) {
    throw new Error("gate result history does not belong to the current Attempt sequence");
  }
  const payload = history.current.payload;
  if (payload?.result !== "pass" && payload?.result !== "fail" && payload?.result !== "recovered") {
    throw new Error("canonical Gate result is invalid");
  }
  const persistedPhase = required(payload?.artifacts?.phase, "canonical Gate result phase");
  if ((persistedPhase === "task-impl") !== (taskId !== null)) {
    throw new Error("canonical Gate result phase does not match its persisted Task scope");
  }
  if (canonicalGateNodeId({ phase: persistedPhase, taskId }) !== nodeId) {
    throw new Error("canonical Gate result phase does not own the active gate node");
  }
  const activities = currentGateActivity({ flowManager, state, nodeId, attempt });
  const publication = activities.find((activity) => activity.id === resultSource.descriptor.activityId) ?? null;
  if (publication === null) throw new Error("gate catalog publication is not owned by the current Attempt");
  if (publication.transition?.operation !== "publish_artifacts"
    && publication.transition?.operation !== "fail_attempt"
    && publication.transition?.operation !== "confirm_attempt") {
    throw new Error("gate catalog publication has an invalid producer Activity");
  }
  const failure = resultFailure(payload, attempt);
  let sourceFingerprint = resultSource.descriptor.hash;
  let sourceRevisionFingerprint = null;
  let canonicalRevisionFingerprint = null;
  const resultRevision = payload?.artifacts?.gateTransitionLineage;
  if (failure?.category === "semantic") {
    const source = flowManager.readProducerArtifact({
      specId: state.specId, nodeId, logicalKey: keys.source, parameters: keys.parameters, optional: true,
    });
    // A source artifact is an additional semantic lineage witness when the
    // producer published one. Its absence does not replace the current
    // Attempt/result binding, which is already canonical and immutable.
    if (source !== null) {
    const sourceActivity = activities.find((activity) => activity.id === source.descriptor.activityId) ?? null;
    if (sourceActivity === null) throw new Error("gate source publication is not owned by the current Attempt");
    const sourcePayload = JSON.parse(source.bytes.toString("utf8"));
    if (sourcePayload?.phase !== persistedPhase || sourcePayload?.result !== "fail") {
      throw new Error("gate source artifact does not match the canonical Gate result");
    }
    if (JSON.stringify(sourcePayload.failureCategory) !== JSON.stringify(failure)) {
      throw new Error("gate source failure category does not match the canonical Gate result");
    }
    if (typeof resultRevision !== "string" || resultRevision.length !== 64
      || sourcePayload?.lineage !== resultRevision) {
      throw new Error("gate source and canonical result lineage binding is unavailable or mismatched");
    }
    sourceFingerprint = source.descriptor.hash;
    sourceRevisionFingerprint = sourcePayload.lineage;
    canonicalRevisionFingerprint = resultRevision;
    }
  }
  const contract = state.definition.contractForNode(state.findNode(nodeId));
  const failureCategory = failure?.category ?? "semantic";
  // Consumption is persisted on the Attempt that is being evaluated.  It
  // counts retries that have already started; the failed observation itself
  // must not be added a second time here.  Thus a limit of four permits the
  // initial evaluation plus four replacement Attempts, and the fifth failed
  // evaluation (consumption=4) is the one that settles.
  const used = failureCategory === "semantic"
    ? attempt.consumption.semantic
    : attempt.consumption.tooling;
  const maximum = failureCategory === "semantic"
    ? contract.semanticRetryLimit
    : (contract.toolingRetryLimit ?? 0);
  // GateRetryMetrics intentionally requires a positive maximum. Tooling
  // failures are terminal at the common boundary; a zero tooling budget is
  // represented by one exhausted slot rather than an invented retry.
  const retry = { used, maximum: Math.max(1, maximum) };
  // A repair receipt is observation evidence, never a route decision.  It is
  // intentionally read from the same current Attempt and catalog lineage as
  // the Gate result; Definition decides whether that evidence can be used.
  const repairEvidence = payload.result === "fail" && failureCategory === "semantic"
    ? inspectCanonicalPlanGateRepair({ flowManager, state })
    : null;
  return new GateTransitionFacts({
    phase: persistedPhase,
    scope: scopeFor(persistedPhase, taskId),
    producer: {
      runId: state.runId, specId: state.specId, activityId: publication.id, phase: persistedPhase,
      scope: scopeFor(persistedPhase, taskId), taskId, stepId: nodeId,
    },
    target: { runId: state.runId, specId: state.specId, taskId, stepId: nodeId, attempt: { id: attempt.id, sequence: attempt.sequence } },
    currentAttempt: { id: attempt.id, sequence: attempt.sequence },
    catalogPublication: {
      attemptId: attempt.id, sequence: attempt.sequence, producerActivityId: publication.id,
      artifactId: resultSource.relativePath, fingerprint: resultSource.descriptor.hash,
    },
    result: payload.result,
    failure,
    retry,
    lineage: {
      sourceAttempt: { id: attempt.id, sequence: attempt.sequence },
      canonicalAttempt: { id: attempt.id, sequence: attempt.sequence },
      sourceFingerprint,
      canonicalFingerprint: resultSource.descriptor.hash,
      sourceRevisionFingerprint,
      canonicalRevisionFingerprint,
    },
    recoveryEvidence: payload.result === "recovered"
      ? { kind: "recovered", attempt: { id: attempt.id, sequence: attempt.sequence }, fingerprint: resultSource.descriptor.hash }
      : repairEvidence !== null
        ? { kind: "repair", attempt: { id: attempt.id, sequence: attempt.sequence }, fingerprint: resultSource.descriptor.hash }
      : { kind: "none" },
  });
}
