import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { findInProgressLeaves, findStepById, flattenSteps } from "./step-tree.js";
import { findActiveNode } from "../definition.js";

export const PLAN_REWIND_SUPPORTED_STAGES = Object.freeze([
  "impl-review",
  "impl-gate",
  "retro",
  "acceptance-review",
  "final-regression",
]);

export const PLAN_REWIND_REVIEW_PHASES = Object.freeze([
  "draft-questions",
  "draft-coverage",
  "spec",
  "test",
  "impl",
]);

export const PLAN_REWIND_GATE_PHASES = Object.freeze([
  "draft",
  "spec",
  "integration",
]);

export const PLAN_REWIND_EVIDENCE_KINDS = Object.freeze([
  "approval",
  "draft-review",
  "spec-review",
  "plan-gate",
  "scenario-validity",
  "test-review",
  "test-execute",
  "test-result-review",
  "implementation",
  "impl-review",
  "impl-gate",
  "retro",
  "acceptance-review",
  "flow-findings",
  "completion-overrides",
  "final-regression",
]);

export const PLAN_REWIND_LIMITS = Object.freeze({
  maxReasonChars: 500,
  maxPathChars: 1000,
  maxEvidenceFiles: 500,
  maxEvidenceBytes: 268435456,
  hashChunkBytes: 65536,
  maxAuditRecords: 100,
});

const FINALIZE_STAGES = new Set([
  "finalize-commit",
  "finalize-merge",
  "finalize-sync",
  "finalize-cleanup",
]);
const SUPPORTED_STAGE_SET = new Set(PLAN_REWIND_SUPPORTED_STAGES);
const EVIDENCE_KIND_SET = new Set(PLAN_REWIND_EVIDENCE_KINDS);
const RESET_COUNTERS = Object.freeze([
  ...PLAN_REWIND_REVIEW_PHASES.map((phase) => ({ phase, counter: "reviewRetry" })),
  ...PLAN_REWIND_GATE_PHASES.map((phase) => ({ phase, counter: "gateRetry" })),
]);

export class PlanRewindError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PlanRewindError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new PlanRewindError(code, message);
}

function requireString(value, field, maxChars = null) {
  if (typeof value !== "string" || value.trim() === "") {
    fail("PLAN_REWIND_INVALID_REQUEST", `${field} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (maxChars != null && normalized.length > maxChars) {
    fail("PLAN_REWIND_INVALID_REQUEST", `${field} exceeds ${maxChars} characters`);
  }
  return normalized;
}

function requireIso(value, field) {
  const normalized = requireString(value, field);
  const parsed = Date.parse(normalized);
  if (Number.isNaN(parsed)) fail("PLAN_REWIND_INVALID_REQUEST", `${field} must be ISO 8601`);
  return new Date(parsed).toISOString();
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function normalizeEvidencePath(value) {
  if (typeof value !== "string" || value.trim() === "") {
    fail("PLAN_REWIND_INVALID_EVIDENCE", "evidence path must be non-empty");
  }
  const portable = value.replaceAll("\\", "/");
  if (portable.length > PLAN_REWIND_LIMITS.maxPathChars) {
    fail("PLAN_REWIND_INVALID_EVIDENCE", `evidence path exceeds ${PLAN_REWIND_LIMITS.maxPathChars} characters`);
  }
  const normalized = path.posix.normalize(portable);
  if (
    path.posix.isAbsolute(normalized)
    || path.win32.isAbsolute(normalized)
    || normalized === "."
    || normalized === ".."
    || normalized.startsWith("../")
  ) {
    fail("PLAN_REWIND_INVALID_EVIDENCE", "evidence path must stay inside the spec directory");
  }
  if (normalized.length > PLAN_REWIND_LIMITS.maxPathChars) {
    fail("PLAN_REWIND_INVALID_EVIDENCE", `evidence path exceeds ${PLAN_REWIND_LIMITS.maxPathChars} characters`);
  }
  return normalized;
}

export class PlanRewindEvidence {
  constructor(input = {}) {
    this.path = normalizeEvidencePath(input.path);
    if (!Number.isSafeInteger(input.size) || input.size < 0) {
      fail("PLAN_REWIND_INVALID_EVIDENCE", "evidence size must be a non-negative safe integer");
    }
    this.size = input.size;
    this.mtime = requireIso(input.mtime, "evidence mtime");
    if (typeof input.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.sha256)) {
      fail("PLAN_REWIND_INVALID_EVIDENCE", "evidence sha256 must be a lowercase SHA-256 digest");
    }
    this.sha256 = input.sha256;
    Object.freeze(this);
  }

  toJSON() {
    return { path: this.path, size: this.size, mtime: this.mtime, sha256: this.sha256 };
  }
}

export class PlanRewindEvidenceInventory {
  constructor(entries = []) {
    if (!Array.isArray(entries)) fail("PLAN_REWIND_INVALID_EVIDENCE", "evidence entries must be an array");
    if (entries.length > PLAN_REWIND_LIMITS.maxEvidenceFiles) {
      fail("PLAN_REWIND_EVIDENCE_LIMIT", `evidence file count exceeds ${PLAN_REWIND_LIMITS.maxEvidenceFiles}`);
    }
    const normalized = entries.map((entry) => (
      entry instanceof PlanRewindEvidence ? entry : new PlanRewindEvidence(entry)
    ));
    const totalBytes = normalized.reduce((sum, entry) => sum + entry.size, 0);
    if (!Number.isSafeInteger(totalBytes) || totalBytes > PLAN_REWIND_LIMITS.maxEvidenceBytes) {
      fail("PLAN_REWIND_EVIDENCE_LIMIT", `evidence bytes exceed ${PLAN_REWIND_LIMITS.maxEvidenceBytes}`);
    }
    this.entries = Object.freeze(normalized);
    this.totalBytes = totalBytes;
    Object.freeze(this);
  }

  toJSON() {
    return this.entries.map((entry) => entry.toJSON());
  }
}

export class PlanRewindRequest {
  constructor(input = {}) {
    this.runId = requireString(input.runId, "runId", 128);
    if (!Number.isSafeInteger(input.issue) || input.issue < 1) {
      fail("PLAN_REWIND_INVALID_REQUEST", "issue must be a positive safe integer");
    }
    this.issue = input.issue;
    this.spec = requireString(input.spec, "spec", PLAN_REWIND_LIMITS.maxPathChars);
    this.sourceStage = requireString(input.sourceStage, "sourceStage", 100);
    this.destinationStep = requireString(input.destinationStep, "destinationStep", 100);
    try {
      this.reason = requireString(input.reason, "reason", PLAN_REWIND_LIMITS.maxReasonChars);
    } catch (error) {
      if (error instanceof PlanRewindError) {
        throw new PlanRewindError("PLAN_REWIND_INVALID_REASON", error.message);
      }
      throw error;
    }
    this.rewoundAt = requireIso(input.rewoundAt, "rewoundAt");
    this.invalidatedApprovalConfirmedAt = input.invalidatedApprovalConfirmedAt == null
      ? null
      : requireIso(input.invalidatedApprovalConfirmedAt, "invalidatedApprovalConfirmedAt");
    Object.freeze(this);
  }

  toJSON() {
    return {
      runId: this.runId,
      issue: this.issue,
      spec: this.spec,
      sourceStage: this.sourceStage,
      destinationStep: this.destinationStep,
      reason: this.reason,
      rewoundAt: this.rewoundAt,
      invalidatedApprovalConfirmedAt: this.invalidatedApprovalConfirmedAt,
    };
  }
}

export class PlanEvidenceReference {
  constructor(input = {}) {
    if (!EVIDENCE_KIND_SET.has(input.kind)) {
      fail("PLAN_REWIND_INVALID_EVIDENCE", `unknown evidence kind: ${input.kind}`);
    }
    this.kind = input.kind;
    this.createdAt = requireIso(input.createdAt, "evidence createdAt");
    Object.freeze(this);
  }
}

export class PlanRewindRecord {
  constructor(input = {}) {
    const request = input.request instanceof PlanRewindRequest
      ? input.request
      : new PlanRewindRequest(input.request);
    const inventory = input.invalidatedEvidence instanceof PlanRewindEvidenceInventory
      ? input.invalidatedEvidence
      : new PlanRewindEvidenceInventory(input.invalidatedEvidence || []);
    this.reason = request.reason;
    this.target = Object.freeze({ runId: request.runId, issue: request.issue, spec: request.spec });
    this.sourceStage = request.sourceStage;
    this.destinationStep = request.destinationStep;
    this.rewoundAt = request.rewoundAt;
    this.invalidatedApprovalConfirmedAt = request.invalidatedApprovalConfirmedAt;
    this.invalidatedRetryRecovery = clone(input.invalidatedRetryRecovery) ?? null;
    this.reviewRetryResetPhases = Object.freeze([...PLAN_REWIND_REVIEW_PHASES]);
    this.gateRetryResetPhases = Object.freeze([...PLAN_REWIND_GATE_PHASES]);
    this.invalidatedStepIds = Object.freeze([...(input.invalidatedStepIds || [])]);
    this.invalidatedEvidence = Object.freeze(inventory.toJSON());
    Object.freeze(this);
  }

  toJSON() {
    return {
      reason: this.reason,
      target: { ...this.target },
      sourceStage: this.sourceStage,
      destinationStep: this.destinationStep,
      rewoundAt: this.rewoundAt,
      invalidatedApprovalConfirmedAt: this.invalidatedApprovalConfirmedAt,
      invalidatedRetryRecovery: clone(this.invalidatedRetryRecovery),
      reviewRetryResetPhases: [...this.reviewRetryResetPhases],
      gateRetryResetPhases: [...this.gateRetryResetPhases],
      invalidatedStepIds: [...this.invalidatedStepIds],
      invalidatedEvidence: this.invalidatedEvidence.map((entry) => ({ ...entry })),
    };
  }
}

export function validatePlanRewindGuards(input = {}) {
  for (const field of ["expectRunId", "expectIssue", "expectSpec"]) {
    if (input[field] == null || input[field] === "") {
      fail("PLAN_REWIND_MISSING_GUARD", `${field} is required for flow-level plan rewind`);
    }
  }
  return true;
}

function hashFile(file, onHashChunk) {
  const hash = crypto.createHash("sha256");
  const buffer = Buffer.allocUnsafe(PLAN_REWIND_LIMITS.hashChunkBytes);
  const fd = fs.openSync(file, "r");
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) {
        hash.update(buffer.subarray(0, bytesRead));
        if (onHashChunk) onHashChunk(bytesRead);
      }
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

export function capturePlanRewindEvidence(specDir, options = {}) {
  const maxFiles = options.maxFiles ?? PLAN_REWIND_LIMITS.maxEvidenceFiles;
  const maxBytes = options.maxBytes ?? PLAN_REWIND_LIMITS.maxEvidenceBytes;
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1 || maxFiles > PLAN_REWIND_LIMITS.maxEvidenceFiles) {
    fail("PLAN_REWIND_EVIDENCE_LIMIT", `maxFiles must be 1-${PLAN_REWIND_LIMITS.maxEvidenceFiles}`);
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > PLAN_REWIND_LIMITS.maxEvidenceBytes) {
    fail("PLAN_REWIND_EVIDENCE_LIMIT", `maxBytes must be 0-${PLAN_REWIND_LIMITS.maxEvidenceBytes}`);
  }
  const root = path.resolve(specDir);
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    fail("PLAN_REWIND_INVALID_EVIDENCE", "spec directory must be a real directory");
  }
  const files = [];
  function walk(dir) {
    const names = fs.readdirSync(dir).sort();
    for (const name of names) {
      const file = path.join(dir, name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink()) fail("PLAN_REWIND_INVALID_EVIDENCE", `symlink rejected: ${file}`);
      if (stat.isDirectory()) {
        walk(file);
        continue;
      }
      if (!stat.isFile()) fail("PLAN_REWIND_INVALID_EVIDENCE", `non-regular evidence rejected: ${file}`);
      const relative = path.relative(root, file).split(path.sep).join("/");
      if (relative === "flow.json") continue;
      const normalized = normalizeEvidencePath(relative);
      files.push({ file, relative: normalized, stat });
      if (files.length > maxFiles) fail("PLAN_REWIND_EVIDENCE_LIMIT", `evidence file count exceeds ${maxFiles}`);
    }
  }
  walk(root);
  let totalBytes = 0;
  const entries = [];
  for (const item of files) {
    totalBytes += item.stat.size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > maxBytes) {
      fail("PLAN_REWIND_EVIDENCE_LIMIT", `evidence bytes exceed ${maxBytes}`);
    }
    entries.push(new PlanRewindEvidence({
      path: item.relative,
      size: item.stat.size,
      mtime: item.stat.mtime.toISOString(),
      sha256: hashFile(item.file, options.onHashChunk),
    }));
  }
  return new PlanRewindEvidenceInventory(entries).entries;
}

function activeLeaves(state) {
  const parent = findInProgressLeaves(state.steps || []);
  const tasks = (state.tasks || []).flatMap((task) => (
    (task.steps || []).filter((step) => step.status === "in_progress")
  ));
  return [...parent, ...tasks];
}

function baselineComplete(state) {
  return Boolean(
    state.state?.mergeStrategy
    || state.state?.featureBranchSquashedSha
    || state.state?.finalizedAt,
  );
}

function resetLeaf(step, status) {
  step.status = status;
  delete step.startedAt;
  delete step.finishedAt;
  delete step.runtimeLog;
}

function assertIdentity(state, request) {
  if (state.runId !== request.runId || state.issue !== request.issue || state.spec !== request.spec) {
    fail("ACTIVE_FLOW_MISMATCH", "plan rewind target does not match flow state");
  }
}

export function applyPlanRewind(state, rawRequest, rawEvidence = []) {
  const request = rawRequest instanceof PlanRewindRequest
    ? rawRequest
    : new PlanRewindRequest(rawRequest);
  const evidence = rawEvidence instanceof PlanRewindEvidenceInventory
    ? rawEvidence
    : new PlanRewindEvidenceInventory(rawEvidence);
  if (!state || typeof state !== "object") fail("PLAN_REWIND_INVARIANT", "flow state is required");
  assertIdentity(state, request);
  if (state.currentTaskId != null) fail("PLAN_REWIND_TASK_SCOPE", "flow-level plan rewind rejects task-scoped state");
  const beforeActive = activeLeaves(state);
  if (beforeActive.length !== 1) {
    fail("PLAN_REWIND_INVARIANT", `expected exactly one in-progress leaf before rewind, got ${beforeActive.length}`);
  }
  const sourceStage = beforeActive[0].id;
  if (sourceStage !== request.sourceStage) {
    fail("ACTIVE_FLOW_MISMATCH", `active stage ${sourceStage} does not match requested ${request.sourceStage}`);
  }
  if (FINALIZE_STAGES.has(sourceStage)) {
    fail("PLAN_REWIND_FINALIZE_BOUNDARY", `plan rewind rejected at ${sourceStage}`);
  }
  if (baselineComplete(state)) {
    fail("PLAN_REWIND_BASELINE_COMPLETE", "plan rewind rejected after merge or finalize baseline completion");
  }
  if (!SUPPORTED_STAGE_SET.has(sourceStage)) {
    fail("PLAN_REWIND_UNSUPPORTED_STAGE", `plan rewind is not supported from ${sourceStage}`);
  }
  for (const prerequisiteId of ["branch", "prepare-spec"]) {
    const prerequisite = findStepById(state.steps || [], prerequisiteId);
    if (prerequisite?.status !== "done") {
      fail("PLAN_REWIND_INVARIANT", `${prerequisiteId} must be done before plan rewind`);
    }
  }
  if (request.destinationStep !== "draft" || !findStepById(state.steps || [], request.destinationStep)) {
    fail("PLAN_REWIND_INVARIANT", "draft destination is missing from the flow definition state");
  }
  const existingAudit = Array.isArray(state.planRewinds) ? state.planRewinds : [];
  if (existingAudit.length >= PLAN_REWIND_LIMITS.maxAuditRecords) {
    fail("PLAN_REWIND_AUDIT_LIMIT", `plan rewind audit count reached ${PLAN_REWIND_LIMITS.maxAuditRecords}`);
  }

  const next = structuredClone(state);
  const tasksBefore = structuredClone(next.tasks);
  const identityBefore = {
    runId: next.runId,
    issue: next.issue,
    spec: next.spec,
    baseBranch: next.baseBranch,
    featureBranch: next.featureBranch,
    worktree: next.worktree,
    currentTaskId: next.currentTaskId,
  };
  const invalidatedStepIds = [];
  for (const step of flattenSteps(next.steps || [])) {
    if (step.id === "branch" || step.id === "prepare-spec") continue;
    invalidatedStepIds.push(step.id);
    resetLeaf(step, step.id === request.destinationStep ? "in_progress" : "pending");
  }
  if (!Array.isArray(next.metrics)) next.metrics = [];
  for (const { phase, counter } of RESET_COUNTERS) {
    next.metrics.push({
      phase,
      counter,
      delta: 0,
      reset: true,
      taskId: null,
      ts: request.rewoundAt,
    });
  }
  const invalidatedRetryRecovery = clone(next.retryRecovery) ?? null;
  next.retryRecovery = null;
  const record = new PlanRewindRecord({
    request,
    invalidatedStepIds,
    invalidatedRetryRecovery,
    invalidatedEvidence: evidence,
  });
  next.planRewinds = [...existingAudit.map((entry) => clone(entry)), record.toJSON()];

  const afterActive = activeLeaves(next);
  if (afterActive.length !== 1 || afterActive[0].id !== request.destinationStep) {
    fail("PLAN_REWIND_INVARIANT", "rewind candidate must contain exactly one draft in-progress leaf");
  }
  const nextAction = findActiveNode(next);
  if (nextAction?.scope !== "flow" || nextAction.stepId !== request.destinationStep) {
    fail("PLAN_REWIND_INVARIANT", "rewind candidate next action must resolve to flow-level draft");
  }
  if (JSON.stringify(next.tasks) !== JSON.stringify(tasksBefore)) {
    fail("PLAN_REWIND_INVARIANT", "rewind candidate changed task state");
  }
  for (const [field, value] of Object.entries(identityBefore)) {
    if (next[field] !== value) fail("PLAN_REWIND_INVARIANT", `rewind candidate changed ${field}`);
  }
  return next;
}

export function latestPlanRewind(state) {
  const entries = Array.isArray(state?.planRewinds) ? state.planRewinds : [];
  return entries.length > 0 ? entries.at(-1) : null;
}

export function isPlanEvidenceFresh(state, reference) {
  const normalized = reference instanceof PlanEvidenceReference
    ? reference
    : new PlanEvidenceReference(reference);
  const latest = latestPlanRewind(state);
  if (!latest) return true;
  return Date.parse(normalized.createdAt) > Date.parse(latest.rewoundAt);
}

export function isPlanArtifactFresh(state, file, kind) {
  if (!fs.existsSync(file)) return false;
  return isPlanEvidenceFresh(state, new PlanEvidenceReference({
    kind,
    createdAt: fs.statSync(file).mtime.toISOString(),
  }));
}
