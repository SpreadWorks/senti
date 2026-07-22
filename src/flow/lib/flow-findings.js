import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { latestPlanRewind } from "./plan-rewind.js";

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

function requireMirrorString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (value.length > MAX_MIRROR_FIELD_CHARS) {
    throw new Error(`${field} exceeds ${MAX_MIRROR_FIELD_CHARS} characters`);
  }
  return value.trim();
}

function requireFindingFingerprint(value, field = "fingerprint") {
  const fingerprint = requireString(value, field).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error(`${field} must be a lowercase SHA-256 string`);
  }
  return fingerprint;
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
    this.runId = input.runId == null ? null : requireString(input.runId, "runId");
    this.fingerprint = requireFindingFingerprint(input.fingerprint);
    this.disposition = requireString(input.disposition, "disposition");
    if (this.disposition !== "deferred") throw new Error("disposition must be deferred");
    this.rationale = requireMirrorString(input.rationale, "rationale");
    this.retryExhausted = requireBoolean(input.retryExhausted, "retryExhausted");
    this.attempts = requireInteger(input.attempts, "attempts");
    this.round = requireInteger(input.round, "round");
    this.completionKind = requireString(input.completionKind, "completionKind");
    if (this.completionKind !== "deferred") throw new Error("completionKind must be deferred");
    this.finalDisposition = validateFinalDisposition(
      Object.prototype.hasOwnProperty.call(input, "finalDisposition") ? input.finalDisposition : null,
    );
    this.planRewindAt = input.planRewindAt == null
      ? null
      : requireString(input.planRewindAt, "planRewindAt");
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      sourceStep: this.sourceStep,
      sourceArtifact: this.sourceArtifact,
      sourceFindingId: this.sourceFindingId,
      runId: this.runId,
      fingerprint: this.fingerprint,
      disposition: this.disposition,
      rationale: this.rationale,
      retryExhausted: this.retryExhausted,
      attempts: this.attempts,
      round: this.round,
      completionKind: this.completionKind,
      finalDisposition: this.finalDisposition,
      ...(this.planRewindAt && { planRewindAt: this.planRewindAt }),
    };
  }
}

export class FlowFindingsArtifact {
  constructor(input = {}) {
    if (input.version != null && input.version !== 2) {
      throw new Error("flow findings version must be 2");
    }
    const entries = Array.isArray(input.entries) ? input.entries : [];
    if (entries.length > MAX_FLOW_FINDINGS) {
      throw new Error(`flow findings entry count exceeds ${MAX_FLOW_FINDINGS}`);
    }
    this.version = 2;
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

export function readFlowFindingsArtifact(specDir, { flowState = null } = {}) {
  const file = flowFindingsPath(specDir);
  if (!fs.existsSync(file)) return new FlowFindingsArtifact({ entries: [] });
  const artifact = new FlowFindingsArtifact(readJson(file));
  if (flowState === null) return artifact;
  const expectedRunId = flowState?.runId == null ? null : String(flowState.runId).trim();
  const rewind = latestPlanRewind(flowState);
  return new FlowFindingsArtifact({
    entries: artifact.entries.filter((entry) => (
      entry.runId === expectedRunId
      && entry.planRewindAt === (rewind?.rewoundAt ?? null)
    )),
  });
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
  fingerprint,
  rationale,
  attempts,
  round = null,
  finalDisposition = null,
}) {
  const specDir = specDirFromFlowState(root, flowState);
  const existing = readFlowFindingsArtifact(specDir);
  const planRewindAt = latestPlanRewind(flowState)?.rewoundAt ?? null;
  const normalizedSourceArtifact = normalizeSourceArtifactPath(sourceArtifact);
  const normalizedFingerprint = requireFindingFingerprint(fingerprint);
  const runId = flowState?.runId == null ? null : requireString(flowState.runId, "flowState.runId");
  const existingIndex = existing.entries.findIndex((entry) => (
    entry.fingerprint === normalizedFingerprint
      && entry.runId === runId
      && entry.planRewindAt === planRewindAt
  ));
  if (existingIndex >= 0) {
    const current = existing.entries[existingIndex];
    const entry = new FlowFinding({
      ...current.toJSON(),
      retryExhausted: true,
      attempts,
      round: round ?? attempts,
      completionKind: "deferred",
      disposition: "deferred",
      rationale: requireMirrorString(rationale, "rationale"),
      runId,
      finalDisposition: current.finalDisposition ?? finalDisposition,
      planRewindAt,
    });
    const entries = existing.entries.map((item, index) => (index === existingIndex ? entry : item));
    writeFlowFindingsArtifact(specDir, new FlowFindingsArtifact({ entries }));
    return entry;
  }
  const entry = new FlowFinding({
    findingId: nextFindingId(existing),
    sourceStep,
    sourceArtifact: normalizedSourceArtifact,
    sourceFindingId,
    fingerprint: normalizedFingerprint,
    disposition: "deferred",
    rationale: requireMirrorString(rationale, "rationale"),
    runId,
    retryExhausted: true,
    attempts,
    round: round ?? nextRound(existing),
    completionKind: "deferred",
    finalDisposition,
    planRewindAt,
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

export function buildDeferredFindingsSummary({ specDir, flowState = null }) {
  const artifact = readFlowFindingsArtifact(specDir, { flowState });
  const sourceSteps = [];
  const seen = new Set();
  for (const entry of artifact.entries) {
    if (seen.has(entry.sourceStep)) continue;
    seen.add(entry.sourceStep);
    sourceSteps.push(entry.sourceStep);
  }
  const latestReviewRecords = new Map();
  for (const record of flowState?.reviewConvergence?.records || []) {
    latestReviewRecords.set(`${record.phase}:${record.taskId ?? ""}`, record);
  }
  const fingerprints = new Set(artifact.entries.map((entry) => entry.fingerprint));
  const reviewHandoffs = [...latestReviewRecords.values()].flatMap((record) => (
    Array.isArray(record.handoffFindings) ? record.handoffFindings : []
  )).filter((finding) => {
    if (fingerprints.has(finding.fingerprint)) return false;
    fingerprints.add(finding.fingerprint);
    return true;
  });
  for (const finding of reviewHandoffs) {
    const sourceStep = finding.sourceStep || "review";
    if (seen.has(sourceStep)) continue;
    seen.add(sourceStep);
    sourceSteps.push(sourceStep);
  }
  return {
    count: artifact.entries.length + reviewHandoffs.length,
    sourceSteps,
    artifactPath: FLOW_FINDINGS_FILE,
  };
}

function failedEvaluations(artifact) {
  return Array.isArray(artifact?.evaluations)
    ? artifact.evaluations.filter((entry) => entry?.result === "fail")
    : [];
}

function blockingObservations(artifact) {
  const observations = artifact?.nextAction?.diagnosis?.observations || artifact?.observations || [];
  return Array.isArray(observations)
    ? observations.filter((entry) => entry?.severity === "blocking" || entry?.severity == null)
    : [];
}

function reviewBlockingFindings(artifact, sourceStep) {
  const candidates = [
    ...(sourceStep === "spec-review" ? [artifact?.blocking] : []),
    artifact?.blockingFindings,
    artifact?.findings,
    artifact?.comments,
    artifact?.proposals,
    artifact?.advisoryFindings,
  ];
  return candidates.find(Array.isArray) || [];
}

function sourceFindingsForArtifact(artifact, sourceStep) {
  const evaluations = failedEvaluations(artifact);
  if (evaluations.length > 0) return evaluations;
  const review = reviewBlockingFindings(artifact, sourceStep);
  if (review.length > 0) return review;
  return blockingObservations(artifact);
}

export function findSourceFinding(artifact, sourceStep, sourceFindingId) {
  return sourceFindingsForArtifact(artifact, sourceStep).find((finding, index) => (
    stableSourceFindingId(sourceStep, finding, index) === sourceFindingId
  )) || null;
}

function stableSourceFindingId(sourceStep, finding, index) {
  return finding?.sourceFindingId
    || finding?.findingId
    || finding?.id
    || finding?.proposalId
    || finding?.guardrail_id
    || `${sourceStep}:${index + 1}`;
}

function sourceFindingFingerprint(sourceStep, finding) {
  if (typeof finding?.fingerprint === "string" && /^[a-f0-9]{64}$/.test(finding.fingerprint)) {
    return finding.fingerprint;
  }
  const canonical = JSON.stringify({
    sourceStep,
    requirementId: String(finding?.requirementId || finding?.guardrail_id || "").trim(),
    category: String(finding?.category || finding?.failureMode || finding?.failureKind || "").trim(),
    file: String(finding?.file || finding?.location?.file || "").trim().replace(/\\/g, "/"),
    issue: String(finding?.issue || finding?.reason || finding?.title || "").trim(),
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function sourceFindingRationale(finding) {
  return String(
    finding?.rationale
      || finding?.reason
      || finding?.whyBlocking
      || finding?.issue
      || finding?.title
      || "Retry exhaustion deferred this finding for bounded final disposition.",
  ).trim();
}

export function deferExhaustedSemanticFindings({
  root,
  flowState,
  sourceStep,
  sourceArtifact,
  attempts,
  fingerprints = null,
} = {}) {
  const specDir = specDirFromFlowState(root, flowState);
  const artifact = readBoundedSourceArtifact(specDir, sourceArtifact);
  const selectedFingerprints = fingerprints instanceof Set ? fingerprints : null;
  const sourceFindings = sourceFindingsForArtifact(artifact, sourceStep).filter((finding) => (
    selectedFingerprints === null || selectedFingerprints.has(finding?.fingerprint)
  ));
  const byFingerprint = new Map();
  sourceFindings.forEach((finding, index) => {
    const fingerprint = sourceFindingFingerprint(sourceStep, finding);
    if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, { finding, index });
  });
  const deferred = [...byFingerprint].map(([fingerprint, { finding, index }]) => appendDeferredFlowFinding({
    root,
    flowState,
    sourceStep,
    sourceArtifact,
    sourceFindingId: stableSourceFindingId(sourceStep, finding, index),
    fingerprint,
    rationale: sourceFindingRationale(finding),
    attempts,
    round: attempts,
    finalDisposition: "still_open",
  }));
  return {
    completed: true,
    blockedByRetryExhaustionOnly: false,
    deferred,
  };
}

export function resolveRetryExhaustionForFlowStep({
  sourceArtifact,
} = {}) {
  return {
    stepDisposition: "continue",
    retryExhaustionOnlyStop: false,
    deferredTo: FLOW_FINDINGS_FILE,
    sourceArtifact,
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
