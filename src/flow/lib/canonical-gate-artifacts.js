/**
 * Version-1 gate persistence boundary.
 *
 * Gate evaluation keeps its existing prompt/result shape.  This module is
 * the only translation from that ephemeral result into producer-owned V1
 * artifacts, so no gate path guesses a legacy `*-gate-result.json` sibling.
 */

import {
  CanonicalCommandAttemptArtifactHistory,
  CanonicalCommandResultArtifact,
  CanonicalCommandResultPublication,
  attachCanonicalCommandResultArtifact,
  attachCanonicalCommandResultPublications,
} from "./canonical-command-result.js";
import { renderTaskMarkdown } from "../../spec/commands/render.js";

const GATE_PHASES = new Set(["draft", "spec", "task-spec", "task-impl", "integration"]);

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function jsonObject(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be a JSON object`);
  }
  return value;
}

function canonicalState(state) {
  if (state?.schemaRevision !== 3 || typeof state.specId !== "string" || state.specId === "") {
    throw new Error("canonical gate requires a Version-1 Flow state");
  }
  return state;
}

function canonicalPhase(value) {
  const phase = requiredText(value, "canonical gate phase");
  if (!GATE_PHASES.has(phase)) throw new Error(`unsupported canonical gate phase: ${phase}`);
  return phase;
}

function taskId(value) {
  return value == null ? null : requiredText(value, "canonical gate taskId");
}

function gateNodeId(phase, activeTaskId = null) {
  if (phase === "draft") return "draft-gate";
  if (phase === "spec" || phase === "task-spec") return "spec-gate";
  if (phase === "integration") return "impl-gate";
  return activeTaskId === null ? "impl-gate" : `${activeTaskId}-gate`;
}

function gateLogicalKeys(phase, activeTaskId) {
  if (phase === "draft") return Object.freeze({ result: "draft.gate", source: "draft.gate.source", parameters: {} });
  if (phase === "spec" || phase === "task-spec") return Object.freeze({ result: "spec.gate", source: "spec.gate.source", parameters: {} });
  if (phase === "integration" || activeTaskId === null) {
    return Object.freeze({ result: "impl.gate", source: "impl.gate.source", parameters: {} });
  }
  return Object.freeze({
    result: "task.gate",
    source: "task.gate.source",
    parameters: Object.freeze({ taskId: activeTaskId }),
  });
}

function sourcePayload(result, phase, activeTaskId) {
  const artifacts = jsonObject(result?.artifacts || {}, "canonical gate result artifacts");
  return Object.freeze({
    version: 1,
    phase,
    ...(activeTaskId === null ? {} : { taskId: activeTaskId }),
    generatedAt: new Date().toISOString(),
    result: result.result || "fail",
    evaluations: Array.isArray(artifacts.evaluations) ? structuredClone(artifacts.evaluations) : [],
    observations: structuredClone(artifacts.nextAction?.diagnosis?.observations || []),
    issues: Array.isArray(artifacts.issues) ? [...artifacts.issues] : [],
    reasons: Array.isArray(artifacts.reasons) ? structuredClone(artifacts.reasons) : [],
    failureKind: artifacts.failureKind || null,
    ...(artifacts.failureCode == null ? {} : { failureCode: artifacts.failureCode }),
  });
}

/**
 * Catalog-only reader for V1 gate inputs.  Gate consumers obtain opaque
 * bytes from FlowManager; only this boundary parses the established JSON
 * contracts and never derives a Version directory.
 */
export class CanonicalGateInputStore {
  constructor({ flowManager, state, nodeId } = {}) {
    if (!flowManager || typeof flowManager.readArtifact !== "function") {
      throw new Error("canonical gate input store requires FlowManager.readArtifact");
    }
    this.flowManager = flowManager;
    this.state = canonicalState(state);
    this.nodeId = requiredText(nodeId, "canonical gate input nodeId");
    Object.freeze(this);
  }

  readJson(logicalKey, { parameters = {}, optional = false, consumerNodeId = this.nodeId } = {}) {
    const resolved = this.flowManager.readArtifact({
      specId: this.state.specId,
      logicalKey,
      parameters,
      consumerNodeId,
      optional,
    });
    if (resolved === null) return null;
    try {
      return Object.freeze(JSON.parse(resolved.bytes.toString("utf8")));
    } catch (error) {
      throw new Error(`canonical ${logicalKey} must be JSON: ${error.message}`);
    }
  }

  spec() { return jsonObject(this.readJson("spec.record"), "canonical spec.json"); }
  issueLog() {
    // A fresh Flow has no issue facts until the first producer records one.
    // Treat that catalog absence as the canonical empty log, not as a reason
    // to synthesize a root file before a gate actually needs to write it.
    return jsonObject(this.readJson("issue.log", { optional: true }) ?? { entries: [] }, "canonical issue-log.json");
  }
  draft() { return jsonObject(this.readJson("draft"), "canonical draft"); }

  task(activeTaskId = this.state.currentTaskId) {
    const id = taskId(activeTaskId);
    if (id === null) throw new Error("canonical task gate requires an active Task");
    const task = this.state.tasks?.find((entry) => entry.id === id) ?? null;
    if (task === null) throw new Error(`canonical gate Task is absent: ${id}`);
    return Object.freeze({ id, document: Object.freeze(structuredClone(task)), markdown: renderTaskMarkdown(task) });
  }

  attemptResult(logicalKey, { parameters = {}, consumerNodeId = this.nodeId, optional = false } = {}) {
    const resolved = this.flowManager.readArtifact({
      specId: this.state.specId,
      logicalKey,
      parameters,
      consumerNodeId,
      optional,
    });
    if (resolved === null) return null;
    const history = CanonicalCommandAttemptArtifactHistory.fromBytes({ logicalKey, bytes: resolved.bytes });
    return Object.freeze({ attempt: history.current.attempt, payload: history.current.payload });
  }

  /**
   * Read the active gate producer's own result history. This is intentionally
   * distinct from a consumer read: recovery verifies the failed producer
   * Attempt without expanding the result artifact's downstream allowlist.
   */
  activeAttemptResult(logicalKey, { parameters = {}, optional = false } = {}) {
    const resolved = this.flowManager.readProducerArtifact({
      specId: this.state.specId,
      nodeId: this.nodeId,
      logicalKey,
      parameters,
      optional,
    });
    if (resolved === null) return null;
    const history = CanonicalCommandAttemptArtifactHistory.fromBytes({ logicalKey, bytes: resolved.bytes });
    return Object.freeze({ attempt: history.current.attempt, payload: history.current.payload });
  }
}

/**
 * Attaches a normal gate result to the active Attempt.  The registry then
 * confirms it in the same Store transaction as the Activity and catalog.
 */
export class CanonicalGatePromotion {
  constructor({ state, phase, nodeId = null } = {}) {
    this.state = canonicalState(state);
    this.phase = canonicalPhase(phase);
    this.taskId = taskId(this.state.currentTaskId);
    this.nodeId = nodeId == null ? gateNodeId(this.phase, this.taskId) : requiredText(nodeId, "canonical gate nodeId");
    if (this.state.currentNodeId !== this.nodeId) {
      throw new Error(`canonical gate requires active Attempt for ${this.nodeId}`);
    }
    this.keys = gateLogicalKeys(this.phase, this.taskId);
    Object.freeze(this);
  }

  promote(result) {
    jsonObject(result, "canonical gate result");
    result.artifacts ||= {};
    result.artifacts.phase = this.phase;
    if (this.taskId !== null) result.artifacts.taskId = this.taskId;
    attachCanonicalCommandResultArtifact(result, new CanonicalCommandResultArtifact({
      logicalKey: this.keys.result,
      payload: result,
    }));
    // Source artifacts are failure evidence used for retry/deferral.  A PASS
    // is fully represented by its producer result history and deliberately
    // does not create a duplicate "source" view.
    if (result.result === "fail" && result.artifacts.failureKind === "ai_semantic_fail") {
      attachCanonicalCommandResultPublications(result, [new CanonicalCommandResultPublication({
        logicalKey: this.keys.source,
        parameters: this.keys.parameters,
        mediaType: "application/json",
        payload: sourcePayload(result, this.phase, this.taskId),
      })]);
    }
    return result;
  }
}

export function canonicalGateNodeId({ phase, taskId = null } = {}) {
  return gateNodeId(canonicalPhase(phase), taskId);
}
