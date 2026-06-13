import fs from "node:fs";
import path from "node:path";
import { resolveSpecDir } from "../../lib/spec-json.js";

export const FLOW_FINDINGS_FILE = "flow-findings.json";
export const MAX_FLOW_FINDINGS = 200;
export const MAX_SOURCE_REF_CHARS = 300;
export const MAX_MIRROR_FIELD_CHARS = 1000;
export const MAX_SOURCE_ARTIFACT_READ_BYTES = 1024 * 1024;
export const ACCEPTANCE_FINAL_DISPOSITIONS = Object.freeze([
  "fixed",
  "not_needed",
  "false_positive",
  "pre_existing",
  "still_open",
  "blocking",
]);

const ACCEPTANCE_FINAL_DISPOSITION_SET = new Set(ACCEPTANCE_FINAL_DISPOSITIONS);
const FORBIDDEN_DETAIL_FIELDS = Object.freeze(["summary", "reason", "details", "detail", "body", "message"]);

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (value.length > MAX_SOURCE_REF_CHARS) {
    throw new Error(`${field} exceeds ${MAX_SOURCE_REF_CHARS} characters`);
  }
  return value;
}

export function normalizeSourceArtifactPath(value, field = "sourceArtifact") {
  const source = requireString(value, field).split("\\").join("/");
  if (path.posix.isAbsolute(source) || path.win32.isAbsolute(source)) {
    throw new Error(`${field} must be relative to the spec directory`);
  }
  const normalized = path.posix.normalize(source);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${field} must stay inside the spec directory`);
  }
  return normalized;
}

function isInsideDirectory(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveSourceArtifactPath(specDir, relPath) {
  const normalized = normalizeSourceArtifactPath(relPath);
  const file = path.resolve(specDir, normalized);
  if (!isInsideDirectory(path.resolve(specDir), file)) {
    throw new Error("sourceArtifact must stay inside the spec directory");
  }
  return file;
}

function resolveExistingSourceArtifactPath(specDir, relPath) {
  const file = resolveSourceArtifactPath(specDir, relPath);
  if (!fs.existsSync(file)) return null;
  const specReal = fs.realpathSync(specDir);
  const fileReal = fs.realpathSync(file);
  if (!isInsideDirectory(specReal, fileReal)) return null;
  return fileReal;
}

function requireInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== "boolean") throw new Error(`${field} must be a boolean`);
  return value;
}

export function validateFinalDisposition(value, field = "finalDisposition") {
  if (value === null) return null;
  if (typeof value !== "string" || !ACCEPTANCE_FINAL_DISPOSITION_SET.has(value)) {
    throw new Error(`${field} must be one of ${ACCEPTANCE_FINAL_DISPOSITIONS.join(", ")} or null`);
  }
  if (value.length > MAX_MIRROR_FIELD_CHARS) throw new Error(`${field} exceeds ${MAX_MIRROR_FIELD_CHARS} characters`);
  return value;
}

function rejectCopiedDetail(input = {}) {
  for (const field of FORBIDDEN_DETAIL_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      throw new Error(`flow finding must not copy full finding detail field: ${field}`);
    }
  }
}

export class FlowFinding {
  constructor(input = {}) {
    rejectCopiedDetail(input);
    this.findingId = requireString(input.findingId, "findingId");
    this.sourceStep = requireString(input.sourceStep, "sourceStep");
    this.sourceArtifact = normalizeSourceArtifactPath(input.sourceArtifact, "sourceArtifact");
    this.sourceFindingId = requireString(input.sourceFindingId, "sourceFindingId");
    this.retryExhausted = requireBoolean(input.retryExhausted, "retryExhausted");
    this.attempts = requireInteger(input.attempts, "attempts");
    this.round = requireInteger(input.round, "round");
    this.completionKind = requireString(input.completionKind, "completionKind");
    if (this.completionKind !== "deferred") throw new Error("completionKind must be deferred");
    this.finalDisposition = validateFinalDisposition(
      Object.prototype.hasOwnProperty.call(input, "finalDisposition") ? input.finalDisposition : null,
    );
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      sourceStep: this.sourceStep,
      sourceArtifact: this.sourceArtifact,
      sourceFindingId: this.sourceFindingId,
      retryExhausted: this.retryExhausted,
      attempts: this.attempts,
      round: this.round,
      completionKind: this.completionKind,
      finalDisposition: this.finalDisposition,
    };
  }
}

export class FlowFindingsArtifact {
  constructor(input = {}) {
    const entries = Array.isArray(input.entries) ? input.entries : [];
    if (entries.length > MAX_FLOW_FINDINGS) {
      throw new Error(`flow findings entry count exceeds ${MAX_FLOW_FINDINGS}`);
    }
    this.version = 1;
    this.entries = Object.freeze(entries.map((entry) => (
      entry instanceof FlowFinding ? entry : new FlowFinding(entry)
    )));
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      entries: this.entries.map((entry) => entry.toJSON()),
    };
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

export function flowFindingsPath(specDir) {
  return path.join(specDir, FLOW_FINDINGS_FILE);
}

export function readFlowFindingsArtifact(specDir) {
  const file = flowFindingsPath(specDir);
  if (!fs.existsSync(file)) return new FlowFindingsArtifact({ entries: [] });
  return new FlowFindingsArtifact(readJson(file));
}

export function writeFlowFindingsArtifact(specDir, artifact) {
  const normalized = artifact instanceof FlowFindingsArtifact ? artifact : new FlowFindingsArtifact(artifact);
  const file = flowFindingsPath(specDir);
  writeJson(file, normalized.toJSON());
  return file;
}

export function specDirFromFlowState(root, flowState) {
  if (!flowState?.spec) throw new Error("flowState.spec is required");
  return resolveSpecDir(path.resolve(root, flowState.spec));
}

function nextFindingId(existing) {
  return `DF-${existing.entries.length + 1}`;
}

function nextRound(existing) {
  const rounds = existing.entries.map((entry) => Number(entry.round)).filter(Number.isInteger);
  return rounds.length === 0 ? 1 : Math.max(...rounds) + 1;
}

export function appendDeferredFlowFinding({
  root,
  flowState,
  sourceStep,
  sourceArtifact,
  sourceFindingId,
  attempts,
  round = null,
  finalDisposition = null,
}) {
  const specDir = specDirFromFlowState(root, flowState);
  const existing = readFlowFindingsArtifact(specDir);
  const entry = new FlowFinding({
    findingId: nextFindingId(existing),
    sourceStep,
    sourceArtifact,
    sourceFindingId,
    retryExhausted: true,
    attempts,
    round: round ?? nextRound(existing),
    completionKind: "deferred",
    finalDisposition,
  });
  const next = new FlowFindingsArtifact({ entries: [...existing.entries, entry] });
  writeFlowFindingsArtifact(specDir, next);
  return entry;
}

export function sourceArtifactExists(specDir, relPath) {
  const file = resolveExistingSourceArtifactPath(specDir, relPath);
  if (!file) return false;
  const stat = fs.statSync(file);
  return stat.isFile() && stat.size <= MAX_SOURCE_ARTIFACT_READ_BYTES;
}

export function readBoundedSourceArtifact(specDir, relPath) {
  const file = resolveExistingSourceArtifactPath(specDir, relPath);
  if (!file) return null;
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > MAX_SOURCE_ARTIFACT_READ_BYTES) return null;
  return readJson(file);
}

export function buildDeferredFindingsSummary({ specDir }) {
  const artifact = readFlowFindingsArtifact(specDir);
  const sourceSteps = [];
  const seen = new Set();
  for (const entry of artifact.entries) {
    if (seen.has(entry.sourceStep)) continue;
    seen.add(entry.sourceStep);
    sourceSteps.push(entry.sourceStep);
  }
  return {
    count: artifact.entries.length,
    sourceSteps,
    artifactPath: FLOW_FINDINGS_FILE,
  };
}

export function mirrorFinalDispositions(specDir, deferredFindings) {
  const artifact = readFlowFindingsArtifact(specDir);
  const byId = new Map((deferredFindings || []).map((finding) => [finding.findingId, finding.finalDisposition]));
  const entries = artifact.entries.map((entry) => new FlowFinding({
    ...entry.toJSON(),
    finalDisposition: byId.has(entry.findingId) ? byId.get(entry.findingId) : entry.finalDisposition,
  }));
  writeFlowFindingsArtifact(specDir, new FlowFindingsArtifact({ entries }));
}
