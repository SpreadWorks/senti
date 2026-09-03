import crypto from "node:crypto";
import { CanonicalTaskRequirementMap } from "../../lib/canonical-task-requirement-map.js";
import { canonicalTaskContextKinds } from "./task-context-kinds.js";
import { CurrentTaskSourceSnapshot, captureCurrentTaskSource } from "./task-mutation-lineage.js";

export { CanonicalTaskRequirementMap } from "../../lib/canonical-task-requirement-map.js";
export { canonicalTaskContextKinds } from "./task-context-kinds.js";

const SOURCE_FINGERPRINT = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function requiredDigest(value, field) {
  const digest = requiredText(value, field).toLowerCase();
  if (!SOURCE_FINGERPRINT.test(digest)) throw new Error(`${field} must be a Git or SHA-256 fingerprint`);
  return digest;
}

function json(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
  return value;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function taskDocument(spec, taskId) {
  const task = spec.tasks.find((entry) => entry?.id === taskId) ?? null;
  if (task === null) throw new Error(`canonical current Task is absent from spec: ${taskId}`);
  return Object.freeze(structuredClone(task));
}

/**
 * Worker-facing projection of a CanonicalTaskContext for one Task Step.
 *
 * The action descriptor, materialized Task context artifact, and worker
 * prompt all consume this object's Task input. Source is included only for
 * Steps whose static contract requires it and must match the same source
 * fingerprint that bound the Task context.
 */
export class CanonicalTaskWorkerContextProjection {
  constructor({ context, stepId, source = null } = {}) {
    if (!(context instanceof CanonicalTaskContext)) {
      throw new Error("canonical Task worker context requires a CanonicalTaskContext");
    }
    this.context = context;
    this.stepId = requiredText(stepId, "canonical Task worker Step id");
    this.kinds = canonicalTaskContextKinds(this.stepId);
    const requiresSource = this.kinds.includes("source");
    if (requiresSource && !(source instanceof CurrentTaskSourceSnapshot)) {
      throw new Error(`canonical Task worker context requires current source for ${this.stepId}`);
    }
    if (!requiresSource && source !== null) {
      throw new Error(`canonical Task worker context does not accept source for ${this.stepId}`);
    }
    if (source !== null && source.fingerprint !== context.sourceFingerprint) {
      throw new Error("canonical Task worker source does not match the Task context fingerprint");
    }
    this.source = source;
    this.task = context.readOnlyInput();
    Object.freeze(this);
  }

  toJSON() {
    return Object.freeze({
      kinds: [...this.kinds],
      task: this.task,
      ...(this.source === null ? {} : { source: this.source.toJSON() }),
    });
  }
}

/** A stable current-Task context projected into every worker-facing surface. */
export class CanonicalTaskContext {
  constructor({ state, spec, sourceFingerprint } = {}) {
    const flow = json(state, "canonical Flow state");
    this.runId = requiredText(flow.runId, "canonical Flow runId");
    this.specId = requiredText(flow.specId, "canonical Flow specId");
    this.taskId = requiredText(flow.currentTaskId, "canonical Flow currentTaskId");
    const document = structuredClone(json(spec, "canonical spec"));
    if (!Array.isArray(document.tasks)) throw new Error("canonical spec tasks must be an array");
    this.taskIds = Object.freeze(document.tasks.map((entry, index) => requiredText(entry?.id, `canonical task[${index}].id`)));
    this.task = taskDocument(document, this.taskId);
    this.requirements = new CanonicalTaskRequirementMap(document).forTask(this.taskId);
    if (this.requirements.length === 0) throw new Error(`canonical Task has no mapped Requirements: ${this.taskId}`);
    this.overview = Object.freeze(structuredClone(json(document.overview, "canonical spec overview")));
    this.sourceFingerprint = requiredDigest(sourceFingerprint, "canonical Task source fingerprint");
    this.fingerprint = crypto.createHash("sha256").update(stableJson({
      runId: this.runId,
      specId: this.specId,
      task: this.task,
      requirements: this.requirements,
      overview: this.overview,
      sourceFingerprint: this.sourceFingerprint,
    })).digest("hex");
    Object.freeze(this);
  }

  /** Capture the complete read-only Task boundary before any worker lease or mutation. */
  static capture({ root, flowManager, state, taskId, spec = null, source = null } = {}) {
    if (!flowManager || typeof flowManager.readArtifact !== "function") {
      throw new Error("canonical Task context capture requires FlowManager catalog reads");
    }
    const currentTaskId = requiredText(taskId, "canonical Task context taskId");
    const document = spec ?? (() => {
      const source = flowManager.readArtifact({
        specId: state?.specId,
        logicalKey: "spec.record",
        consumerNodeId: state?.currentNodeId ?? state?.current?.at?.(-1),
      });
      try {
        return JSON.parse(source.bytes.toString("utf8"));
      } catch (cause) {
        throw new Error(`canonical Task spec input is invalid JSON: ${cause.message}`);
      }
    })();
    const currentSource = source ?? captureCurrentTaskSource({ root, flowManager, state, taskId: currentTaskId });
    return new CanonicalTaskContext({
      state: { runId: state?.runId, specId: state?.specId, currentTaskId },
      spec: document,
      sourceFingerprint: currentSource.fingerprint,
    });
  }

  readOnlyInput() {
    return Object.freeze({
      task: structuredClone(this.task),
      requirements: structuredClone(this.requirements),
      overview: structuredClone(this.overview),
      fingerprint: this.fingerprint,
      lineage: Object.freeze({
        runId: this.runId,
        specId: this.specId,
        taskId: this.taskId,
        taskIds: [...this.taskIds],
        sourceFingerprint: this.sourceFingerprint,
      }),
    });
  }

  projectWorkerContext({ stepId, source = null } = {}) {
    return new CanonicalTaskWorkerContextProjection({ context: this, stepId, source });
  }
}
