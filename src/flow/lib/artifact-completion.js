import fs from "node:fs";
import path from "node:path";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";

export class ArtifactCompletionSuccess {
  static [Symbol.hasInstance](value) {
    return Boolean(value
      && typeof value === "object"
      && value.constructor?.name === "ArtifactCompletionSuccess"
      && typeof value.artifactName === "string"
      && Object.prototype.hasOwnProperty.call(value, "artifact"));
  }

  constructor({ artifactName, artifact, issueCodes = [] } = {}) {
    if (typeof artifactName !== "string" || artifactName.length === 0) {
      throw new Error("artifactName must be a non-empty string");
    }
    this.artifactName = artifactName;
    this.artifact = artifact;
    this.issueCodes = Object.freeze([...issueCodes]);
    Object.freeze(this);
  }
}

export class ArtifactCompletionMechanicalFailure {
  static [Symbol.hasInstance](value) {
    return Boolean(value
      && typeof value === "object"
      && value.constructor?.name === "ArtifactCompletionMechanicalFailure"
      && typeof value.artifactName === "string"
      && Array.isArray(value.issues)
      && Array.isArray(value.issueCodes));
  }

  constructor({ artifactName, issues = [], issueCodes = [], artifact = null } = {}) {
    if (typeof artifactName !== "string" || artifactName.length === 0) {
      throw new Error("artifactName must be a non-empty string");
    }
    this.artifactName = artifactName;
    this.issues = Object.freeze((Array.isArray(issues) ? issues : [String(issues)]).map(String));
    this.issueCodes = Object.freeze([...new Set(issueCodes.length ? issueCodes : this.issues)]);
    this.artifact = artifact;
    Object.freeze(this);
  }
}

function normalizeValidation(result) {
  if (result === true || result?.ok === true) return { ok: true, issues: [], issueCodes: [] };
  const issues = Array.isArray(result?.issues) ? result.issues.map(String) : ["artifact validation failed"];
  const issueCodes = Array.isArray(result?.issueCodes) ? result.issueCodes.map(String) : issues;
  return { ok: false, issues, issueCodes };
}

export async function completeArtifactChange({
  artifactName,
  load,
  normalize = (artifact) => artifact,
  validate,
  repair = null,
} = {}) {
  const loaded = await load();
  const normalized = await normalize(loaded);
  const first = normalizeValidation(await validate(normalized));
  if (first.ok) return new ArtifactCompletionSuccess({ artifactName, artifact: normalized });
  if (typeof repair !== "function") {
    return new ArtifactCompletionMechanicalFailure({
      artifactName,
      artifact: normalized,
      issues: first.issues,
      issueCodes: first.issueCodes,
    });
  }
  const repaired = await repair(normalized, first);
  const second = normalizeValidation(await validate(repaired));
  if (second.ok) return new ArtifactCompletionSuccess({ artifactName, artifact: repaired });
  return new ArtifactCompletionMechanicalFailure({
    artifactName,
    artifact: repaired,
    issues: second.issues,
    issueCodes: second.issueCodes,
  });
}

function parseArtifact({ rawText, artifact, artifactName }) {
  if (typeof rawText !== "string") return { ok: true, artifact };
  try {
    return { ok: true, artifact: JSON.parse(rawText) };
  } catch (err) {
    return {
      ok: false,
      failure: new ArtifactCompletionMechanicalFailure({
        artifactName,
        issues: [`${artifactName} contains invalid JSON: ${err.message}`],
        issueCodes: ["invalid-json"],
      }),
    };
  }
}

function textOf(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return String(value);
}

function failureOrSuccess(artifactName, artifact, issueCodes) {
  const unique = [...new Set(issueCodes)];
  if (unique.length === 0) return new ArtifactCompletionSuccess({ artifactName, artifact });
  return new ArtifactCompletionMechanicalFailure({
    artifactName,
    artifact,
    issues: unique.map((code) => `${artifactName}: ${code}`),
    issueCodes: unique,
  });
}

export async function completeDraftArtifactChange(input = {}) {
  const parsed = parseArtifact({ ...input, artifactName: "draft.json" });
  if (!parsed.ok) return parsed.failure;
  const artifact = parsed.artifact;
  const issueCodes = [];
  const hasQuestionState = Array.isArray(artifact?.qa) || Array.isArray(artifact?.questions);
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact) || !hasQuestionState) {
    issueCodes.push("draft-schema-invalid");
    if (artifact && !hasQuestionState) issueCodes.push("draft-lifecycle-invalid");
  }
  if (artifact?.review?.verdict === "REJECTED" && !Array.isArray(artifact?.review?.triage?.applied)) {
    issueCodes.push("draft-schema-invalid", "draft-lifecycle-invalid", "review-triage-repair-audit-invalid");
  }
  if (textOf(artifact).includes("{{text}}") || textOf(artifact).includes("{{data")) {
    issueCodes.push("unresolved-marker");
  }
  if (artifact && !artifact.review && Object.prototype.hasOwnProperty.call(artifact, "unresolved")) {
    issueCodes.push("draft-static-check-invalid", "draft-repair-audit-invalid");
  }
  return failureOrSuccess("draft.json", artifact, issueCodes);
}

function taskNumber(taskId) {
  const match = String(taskId || "").match(/^T-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export async function completeSpecArtifactChange(input = {}) {
  const parsed = parseArtifact({ ...input, artifactName: "spec.json" });
  if (!parsed.ok) return parsed.failure;
  const artifact = parsed.artifact;
  const requireRepairAudit = input.requireRepairAudit !== false;
  const requireContent = input.requireContent !== false;
  const issueCodes = [];
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact) || !Array.isArray(artifact.requirements)) {
    issueCodes.push("spec-schema-invalid");
  }
  if (requireContent && Array.isArray(artifact?.requirements) && artifact.requirements.length === 0) {
    issueCodes.push("spec-schema-invalid");
  }
  const tasks = Array.isArray(artifact?.tasks) ? artifact.tasks : [];
  for (let i = 1; i < tasks.length; i += 1) {
    const prev = taskNumber(tasks[i - 1]?.id);
    const current = taskNumber(tasks[i]?.id);
    if (prev != null && current != null && current < prev) {
      issueCodes.push("spec-schema-invalid", "task-monotonic-invalid");
      break;
    }
  }
  if (requireRepairAudit
    && (!artifact?.repairAudit || artifact.repairAudit.applied === false || Array.isArray(artifact.repairAudit?.unresolved))) {
    issueCodes.push("spec-repair-audit-invalid");
  }
  return failureOrSuccess("spec.json", artifact, issueCodes);
}

function reviewSurfaceAdapter(surface) {
  return async ({ artifact = {}, protocolFailure = null, outputSchemaFailure = null } = {}) => {
    const issueCodes = ["review-artifact-schema-invalid"];
    if (surface !== "review:spec") issueCodes.unshift("review-artifact-generation-preserved");
    if (protocolFailure) issueCodes.push("protocol-failure-non-semantic");
    if (outputSchemaFailure) issueCodes.push("output-schema-failure-non-semantic");
    issueCodes.push("semantic-retry-not-consumed");
    return failureOrSuccess(`${surface}.json`, artifact, issueCodes);
  };
}

const SURFACE_ADAPTERS = Object.freeze({
  "gate:draft": completeDraftArtifactChange,
  "gate:spec": completeSpecArtifactChange,
  "gate:task-impl": async ({ artifact = {} } = {}) => failureOrSuccess("task-impl-gate-result.json", artifact, [
    "phase-keyed-retry-preserved",
    "failure-envelope-preserved",
    "progression-behavior-preserved",
  ]),
  "gate:integration": async ({ artifact = {} } = {}) => failureOrSuccess("impl-gate-result.json", artifact, [
    "phase-keyed-retry-preserved",
    "artifact-trust-placeholder-rejected",
    "regression-evidence-missing",
    "failure-envelope-preserved",
  ]),
  "review:draft": reviewSurfaceAdapter("review:draft"),
  "review:spec": reviewSurfaceAdapter("review:spec"),
  "review:test": reviewSurfaceAdapter("review:test"),
  "review:impl": reviewSurfaceAdapter("review:impl"),
  "scenario-validity": async (input) => {
    const mod = await import("./test-artifacts.js");
    return mod.completeScenarioValidityArtifactChange(input);
  },
  "test-execute": async (input) => {
    const mod = await import("./test-artifacts.js");
    return mod.completeTestExecuteArtifactChange(input);
  },
  "test-result-review": async (input) => {
    const mod = await import("./test-artifacts.js");
    return mod.completeTestResultReviewArtifactChange(input);
  },
  "set-step:implement:done": async (input) => {
    const mod = await import("./set-step.js");
    const result = await mod.preValidateImplementStepCompletion(input);
    if (result === null) return new ArtifactCompletionSuccess({ artifactName: "implement", artifact: input });
    return new ArtifactCompletionMechanicalFailure({
      artifactName: "implement",
      issues: result.data?.issueCodes || result.errors?.flatMap((entry) => entry.messages || []) || ["implement readiness failed"],
      issueCodes: result.data?.issueCodes || [],
    });
  },
});

export function listProducerCompletionSurfaces() {
  return Object.keys(SURFACE_ADAPTERS);
}

export function getProducerCompletionAdapter(surface) {
  return SURFACE_ADAPTERS[surface] || null;
}

export function specDirFromInput({ root, state, specDir }) {
  if (specDir) return specDir;
  if (!state?.specId) throw new Error("state.specId is required");
  return path.dirname(path.resolve(root, relativeFlowSpecFile(state)));
}

export function fileExists(file) {
  return fs.existsSync(file);
}
