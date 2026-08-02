/**
 * src/flow/lib/retry-recovery.js
 *
 * Audited retry recovery domain model and persistence helpers.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { AtomicJsonFile } from "../../lib/atomic-json-file.js";
import { listChangedFilesDetailed } from "../../lib/git-helpers.js";
import { ProcessIdentitySource } from "../../lib/process-identity.js";
import { ProcessOwnedLock, RealDirectoryAuthority } from "../../lib/process-owned-lock.js";
import { flowStateSpecLocation, relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { IssueLogStore } from "./issue-log-store.js";
import { RuntimeModuleIdentity } from "./runtime-module-identity.js";
import { assessTaskGateRepairEvidence } from "./task-gate-recovery-evidence.js";
import { RetryTargetRoute } from "./retry-target-route.js";

export const RECOVERY_REASON_MIN_LENGTH = 20;
export const RECOVERY_REASON_MAX_LENGTH = 500;
export const RECOVERY_ARTIFACT_FILE = "retry-recovery.json";
export const RECOVERY_TRANSACTION_FILE = ".retry-recovery.transaction.json";

const RECOVERY_ARTIFACT_VERSION = 1;
const PERMITTED_REEVALUATION_COUNT = 1;
const MAX_CHANGED_PATHS = 50;
const MAX_PATH_LENGTH = 300;
const MAX_FINGERPRINT_FILES = 500;
const MAX_RECOVERY_BASELINES_PER_TARGET = 10;
const VALID_ACTIONS = Object.freeze(["reset"]);
const VALID_KINDS = Object.freeze(["gate", "review"]);
const GATE_RECOVERABLE_PHASES = Object.freeze(["draft", "spec", "task-impl", "integration"]);
const REVIEW_RECOVERABLE_PHASES = Object.freeze([
  "draft-questions",
  "draft-coverage",
  "spec",
  "test",
  "impl",
]);
const REVIEW_INPUT_PHASES = Object.freeze([
  "draft",
  "draft-questions",
  "draft-coverage",
  "draft-questions-review",
  "draft-coverage-review",
  "spec",
  "test",
  "impl",
]);
const GATE_EVALUATOR_IDENTITY = new RuntimeModuleIdentity({
  key: "gate-evaluator",
  moduleUrl: new URL("./run-gate.js", import.meta.url),
});

const PUBLIC_RECOVERY_ENTRY_KEYS = Object.freeze([
  "id", "kind", "phase", "canonicalPhase", "reason", "changedEvidence",
  "permittedReevaluationCount", "attemptsBefore", "maxAttempts", "counterAfter",
  "recoveryCommand", "createdAt",
]);
const CHANGED_EVIDENCE_KEYS = Object.freeze([
  "sourceKind", "baselineHash", "currentHash", "changedPaths", "truncated", "changed",
]);
const RECOVERY_TRANSACTION_KEYS = Object.freeze([
  "grantId", "status", "fingerprint", "expectedFlowRevision", "request", "grant",
  "rejection", "createdAt", "updatedAt",
]);
const RECOVERY_REQUEST_KEYS = Object.freeze([
  "runId", "specId", "hasIssue", "issue", "kind", "phase", "canonicalPhase", "reason",
  "attempts", "maxAttempts", "changedEvidence",
]);

function assertExactKeys(value, expected, name) {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${name} has an invalid schema`);
  }
}

function requireSha256(value, name) {
  const hash = requireString(value, name);
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error(`${name} must be a SHA-256 digest`);
  return hash;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function requireSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return value;
}

function normalizeRelPath(value) {
  return String(value || "").split(path.sep).join("/").replace(/^\.\//, "");
}

function normalizeChangedPaths(paths) {
  const unique = [];
  const seen = new Set();
  for (const raw of Array.isArray(paths) ? paths : []) {
    const p = normalizeRelPath(raw).slice(0, MAX_PATH_LENGTH);
    if (!p || seen.has(p)) continue;
    seen.add(p);
    unique.push(p);
    if (unique.length >= MAX_CHANGED_PATHS) break;
  }
  return unique;
}

function canonicalReviewPhase(phase) {
  if (phase === "draft-questions-review") return "draft-questions";
  if (phase === "draft-coverage-review") return "draft-coverage";
  return phase;
}

function canonicalPhaseFor(kind, phase) {
  if (kind === "review") return canonicalReviewPhase(phase);
  return phase;
}

function counterForKind(kind) {
  return kind === "gate" ? "gateRetry" : "reviewRetry";
}

function specDirFor(spec) {
  return normalizeRelPath(path.dirname(spec));
}

function recoveryCommandFor(input) {
  const reason = String(input.reason || "").replace(/"/g, '\\"');
  return `senti flow set retry reset ${input.kind} ${input.phase} --reason "${reason}" --yes`;
}

function sha256ForFiles(root, relPaths, runtimeFingerprints = []) {
  const hash = crypto.createHash("sha256");
  for (const relPath of relPaths) {
    const full = path.resolve(root, relPath);
    hash.update(relPath);
    hash.update("\0");
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      hash.update("<missing>");
      hash.update("\0");
      continue;
    }
    hash.update(fs.readFileSync(full));
    hash.update("\0");
  }
  for (const fingerprint of runtimeFingerprints) {
    fingerprint.update(hash);
  }
  return hash.digest("hex");
}

function sha256ForRuntimeFingerprints(runtimeFingerprints) {
  if (runtimeFingerprints.length === 0) return null;
  const hash = crypto.createHash("sha256");
  for (const fingerprint of runtimeFingerprints) fingerprint.update(hash);
  return hash.digest("hex");
}

function walkFiles(root, relPath, out) {
  if (out.length >= MAX_FINGERPRINT_FILES) return true;
  const full = path.resolve(root, relPath);
  if (!fs.existsSync(full)) {
    out.push(normalizeRelPath(relPath));
    return false;
  }
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    out.push(normalizeRelPath(relPath));
    return false;
  }
  if (!stat.isDirectory()) return false;
  for (const dirent of fs.readdirSync(full, { withFileTypes: true })) {
    if (dirent.name === ".git" || dirent.name === "node_modules") continue;
    const truncated = walkFiles(root, path.join(relPath, dirent.name), out);
    if (truncated) return true;
  }
  return out.length >= MAX_FINGERPRINT_FILES;
}

function sourcePathMatches(sourcePath, relPath) {
  const source = normalizeRelPath(sourcePath);
  const rel = normalizeRelPath(relPath);
  return rel === source || rel.startsWith(`${source}/`);
}

function filterPathsForSource(paths, source) {
  if (!source) return normalizeChangedPaths(paths);
  const filtered = normalizeChangedPaths(paths).filter((p) => source.includes(p));
  return filtered.length > 0 ? filtered : normalizeChangedPaths(source.paths);
}

function countRetry(entries, kind, phase) {
  if (!Array.isArray(entries)) return 0;
  const counter = counterForKind(kind);
  let count = 0;
  for (const entry of entries) {
    if (entry?.phase !== phase || entry?.counter !== counter) continue;
    if (kind === "review" && entry.taskId != null) continue;
    if (entry.reset) count = 0;
    else count += entry.delta ?? 1;
  }
  return count;
}

function latestMatchingBaseline(baselines, kind, canonicalPhase) {
  const list = Array.isArray(baselines) ? baselines : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const baseline = ReviewRecoveryBaseline.from(list[i]);
    if (baseline.kind === kind && baseline.canonicalPhase === canonicalPhase) return baseline;
  }
  return null;
}

function latestMatchingRecovery(entries, kind, canonicalPhase) {
  const list = Array.isArray(entries) ? entries : [];
  for (let i = list.length - 1; i >= 0; i--) {
    const entry = list[i];
    if (entry?.kind === kind && entry?.canonicalPhase === canonicalPhase) return entry;
  }
  return null;
}

function appendRecoveryBaseline(state, baseline) {
  const existing = Array.isArray(state.reviewRecoveryBaselines)
    ? state.reviewRecoveryBaselines
    : [];
  const sameTarget = (entry) => (
    entry?.kind === baseline.kind
    && entry?.canonicalPhase === baseline.canonicalPhase
  );
  const matching = existing.filter(sameTarget);
  const retainedMatching = new Set(matching.slice(-(MAX_RECOVERY_BASELINES_PER_TARGET - 1)));
  state.reviewRecoveryBaselines = existing.filter((entry) => !sameTarget(entry) || retainedMatching.has(entry));
  state.reviewRecoveryBaselines.push(baseline.toJSON());
}

function loadAuthoritativeRecoveryAuthority(root, flowState) {
  if (typeof root !== "string" || root.trim() === "") {
    throw new Error("retry recovery root authority is required");
  }
  if (typeof flowState?.specId !== "string" || flowState.specId.trim() === "") {
    throw new Error("retry recovery specId authority is required");
  }
  const authority = loadRecoveryAuthority(root, relativeFlowSpecFile(flowState));
  if (authority.transaction) {
    assertTransactionAuthority(authority.transaction, flowState.specId, flowState);
    const expectedFingerprint = recoveryFingerprint({
      request: authority.transaction.request,
      expectedFlowRevision: authority.transaction.expectedFlowRevision,
    });
    if (authority.transaction.fingerprint !== expectedFingerprint) {
      const error = new Error(
        `retry recovery transaction fingerprint is not authoritative: ${authority.transaction.grantId}`,
      );
      error.code = "RETRY_RECOVERY_AUTHORITY_INVALID";
      throw error;
    }
  }
  return authority;
}

function loadAuthoritativeRecoveryArtifact(root, flowState) {
  return loadAuthoritativeRecoveryAuthority(root, flowState).artifact;
}

export function resolveRecoveryMaxAttempts({ root, flowState, kind, phase, attempts, resolvedMax }) {
  const target = resolveRecoveryTarget(kind, phase);
  const { artifact, transaction } = loadAuthoritativeRecoveryAuthority(root, flowState);
  // Pending requests freeze the in-flight budget; only committed grants govern later attempts.
  if (transaction?.status === "pending") return Math.max(1, transaction.request.maxAttempts);
  const recovery = artifact.latestCommitted(kind, target.canonicalPhase);
  if (Number.isSafeInteger(recovery?.maxAttempts) && recovery.maxAttempts > 0) {
    return recovery.maxAttempts;
  }
  const baseline = latestMatchingBaseline(flowState?.reviewRecoveryBaselines, kind, target.canonicalPhase);
  if (baseline && !/^[a-f0-9]{64}$/i.test(String(baseline.fingerprint.hash || ""))) {
    return Math.max(1, Number(attempts) || Number(resolvedMax) || 1);
  }
  return resolvedMax;
}

export class RetryRecoveryInput {
  constructor(input = {}) {
    this.action = requireString(input.action, "action");
    if (!VALID_ACTIONS.includes(this.action)) {
      throw new Error(`invalid action: ${this.action}`);
    }
    this.kind = requireString(input.kind, "kind");
    if (!VALID_KINDS.includes(this.kind)) {
      throw new Error(`invalid kind: ${this.kind}`);
    }
    this.phase = requireString(input.phase, "phase");
    const validPhases = this.kind === "gate" ? GATE_RECOVERABLE_PHASES : REVIEW_INPUT_PHASES;
    if (!validPhases.includes(this.phase)) {
      throw new Error(`invalid phase for ${this.kind}: ${this.phase}`);
    }
    const reason = requireString(input.reason, "reason");
    if (reason.length < RECOVERY_REASON_MIN_LENGTH) {
      throw new Error(`reason must be at least ${RECOVERY_REASON_MIN_LENGTH} characters`);
    }
    if (reason.length > RECOVERY_REASON_MAX_LENGTH) {
      throw new Error(`reason must be at most ${RECOVERY_REASON_MAX_LENGTH} characters`);
    }
    if (input.yes !== true) {
      throw new Error("yes confirmation is required");
    }
    this.reason = reason;
    this.yes = true;
    this.canonicalPhase = canonicalPhaseFor(this.kind, this.phase);
  }
}

export class RecoveryTarget {
  constructor(input = {}) {
    this.kind = requireString(input.kind, "kind");
    this.phase = requireString(input.phase, "phase");
    this.canonicalPhase = requireString(input.canonicalPhase, "canonicalPhase");
    this.recoverable = input.recoverable === true;
    this.reason = requireString(input.reason, "reason");
  }

  toJSON() {
    return {
      kind: this.kind,
      phase: this.phase,
      canonicalPhase: this.canonicalPhase,
      recoverable: this.recoverable,
      reason: this.reason,
    };
  }
}

export function resolveRecoveryTarget(kind, phase) {
  if (kind === "gate") {
    if (GATE_RECOVERABLE_PHASES.includes(phase)) {
      return new RecoveryTarget({ kind, phase, canonicalPhase: phase, recoverable: true, reason: "recoverable" });
    }
  }
  if (kind === "review") {
    const canonicalPhase = canonicalReviewPhase(phase);
    if (REVIEW_RECOVERABLE_PHASES.includes(canonicalPhase)) {
      return new RecoveryTarget({ kind, phase, canonicalPhase, recoverable: true, reason: "recoverable" });
    }
  }
  return new RecoveryTarget({
    kind,
    phase,
    canonicalPhase: canonicalPhaseFor(kind, phase),
    recoverable: false,
    reason: "unsupported-recovery-target",
  });
}

export class RecoveryEvidenceSource {
  constructor(input = {}) {
    this.sourceKind = requireString(input.sourceKind, "sourceKind");
    this.paths = normalizeChangedPaths(input.paths);
    this.runtimeIdentities = Object.freeze([...(input.runtimeIdentities || [])]);
    if (this.runtimeIdentities.some((identity) => !(identity instanceof RuntimeModuleIdentity))) {
      throw new Error("recovery runtime identities must be RuntimeModuleIdentity values");
    }
  }

  includes(relPath) {
    return this.paths.some((sourcePath) => sourcePathMatches(sourcePath, relPath));
  }

  fingerprint(root, paths) {
    const runtimeFingerprints = this.runtimeIdentities
      .map((identity) => identity.fingerprint())
      .sort((left, right) => left.key.localeCompare(right.key));
    const components = new EvidenceFingerprintComponents({
      projectHash: sha256ForFiles(root, paths),
      runtimeHash: sha256ForRuntimeFingerprints(runtimeFingerprints),
    });
    return new EvidenceFingerprint({
      sourceKind: this.sourceKind,
      hash: sha256ForFiles(root, paths, runtimeFingerprints),
      paths,
      truncated: false,
      components,
    });
  }
}

export function resolveRecoveryEvidenceSource({ kind, canonicalPhase, specDir }) {
  const dir = normalizeRelPath(specDir || ".");
  if (kind === "gate" && canonicalPhase === "draft") {
    return new RecoveryEvidenceSource({
      sourceKind: "draft-artifact",
      paths: [`${dir}/draft.json`],
      runtimeIdentities: [GATE_EVALUATOR_IDENTITY],
    });
  }
  if (kind === "gate" && canonicalPhase === "spec") {
    return new RecoveryEvidenceSource({
      sourceKind: "spec-artifact",
      paths: [`${dir}/spec.json`],
      runtimeIdentities: [GATE_EVALUATOR_IDENTITY],
    });
  }
  if (kind === "gate" && canonicalPhase === "task-impl") {
    return new RecoveryEvidenceSource({
      sourceKind: "implementation-diff",
      paths: ["src", `${dir}/spec.json`],
      runtimeIdentities: [GATE_EVALUATOR_IDENTITY],
    });
  }
  if (kind === "gate" && canonicalPhase === "integration") {
    return new RecoveryEvidenceSource({
      sourceKind: "implementation-and-test-artifacts",
      paths: [
        "src",
        "plugins",
        ".senti/config.json",
        `${dir}/file-map.json`,
        `${dir}/test-execute-result.json`,
        `${dir}/test-result-review.json`,
      ],
    });
  }
  if (kind === "review" && (canonicalPhase === "draft-questions" || canonicalPhase === "draft-coverage")) {
    return new RecoveryEvidenceSource({ sourceKind: "draft-json", paths: [`${dir}/draft.json`] });
  }
  if (kind === "review" && canonicalPhase === "spec") {
    return new RecoveryEvidenceSource({ sourceKind: "spec-json", paths: [`${dir}/spec.json`] });
  }
  if (kind === "review" && canonicalPhase === "test") {
    return new RecoveryEvidenceSource({ sourceKind: "spec-tests", paths: [`${dir}/tests`] });
  }
  if (kind === "review" && canonicalPhase === "impl") {
    return new RecoveryEvidenceSource({
      sourceKind: "implementation-diff",
      paths: ["src", `${dir}/spec.json`, `${dir}/tests`],
    });
  }
  return new RecoveryEvidenceSource({ sourceKind: "unknown", paths: [] });
}

export class EvidenceFingerprintComponents {
  constructor(input = {}) {
    this.projectHash = requireSha256(input.projectHash, "fingerprint components.projectHash");
    this.runtimeHash = input.runtimeHash == null
      ? null
      : requireSha256(input.runtimeHash, "fingerprint components.runtimeHash");
    Object.freeze(this);
  }

  toJSON() {
    return {
      projectHash: this.projectHash,
      runtimeHash: this.runtimeHash,
    };
  }
}

export class EvidenceFingerprint {
  constructor(input = {}) {
    this.sourceKind = requireString(input.sourceKind, "sourceKind");
    this.hash = requireString(input.hash, "hash");
    this.paths = normalizeChangedPaths(input.paths);
    this.truncated = input.truncated === true;
    this.components = input.components == null
      ? null
      : input.components instanceof EvidenceFingerprintComponents
        ? input.components
        : new EvidenceFingerprintComponents(input.components);
  }

  toJSON() {
    return {
      sourceKind: this.sourceKind,
      hash: this.hash,
      paths: this.paths,
      truncated: this.truncated,
      ...(this.components && { components: this.components.toJSON() }),
    };
  }

  componentChangeFrom(baseline) {
    const previous = baseline instanceof EvidenceFingerprint
      ? baseline
      : new EvidenceFingerprint(baseline || {});
    if (!this.components) return null;
    const previousComponents = previous.components || new EvidenceFingerprintComponents({
      projectHash: previous.hash,
      runtimeHash: null,
    });
    return {
      projectChanged: previousComponents.projectHash !== this.components.projectHash,
      runtimeChanged: previousComponents.runtimeHash !== this.components.runtimeHash,
    };
  }
}

export class ChangedEvidenceSummary {
  constructor(input = {}) {
    this.sourceKind = requireString(input.sourceKind, "sourceKind");
    this.baselineHash = requireString(input.baselineHash, "baselineHash");
    this.currentHash = requireString(input.currentHash, "currentHash");
    this.changedPaths = normalizeChangedPaths(input.changedPaths);
    this.truncated = input.truncated === true;
    this.changed = input.changed ?? (this.baselineHash !== this.currentHash || this.changedPaths.length > 0);
  }

  static fromStored(value) {
    assertExactKeys(value, CHANGED_EVIDENCE_KEYS, "changedEvidence");
    requireString(value.baselineHash, "changedEvidence.baselineHash");
    requireString(value.currentHash, "changedEvidence.currentHash");
    if (typeof value.truncated !== "boolean" || typeof value.changed !== "boolean") {
      throw new Error("changedEvidence flags must be boolean");
    }
    if (!Array.isArray(value.changedPaths)) {
      throw new Error("changedEvidence.changedPaths must be an array");
    }
    const evidence = new ChangedEvidenceSummary(value);
    if (evidence.changedPaths.length !== value.changedPaths.length) {
      throw new Error("changedEvidence.changedPaths must contain unique bounded relative paths");
    }
    return evidence;
  }

  toJSON() {
    return {
      sourceKind: this.sourceKind,
      baselineHash: this.baselineHash,
      currentHash: this.currentHash,
      changedPaths: this.changedPaths,
      truncated: this.truncated,
      changed: this.changed,
    };
  }

  equals(other) {
    const candidate = other instanceof ChangedEvidenceSummary
      ? other
      : ChangedEvidenceSummary.fromStored(other);
    return this.sourceKind === candidate.sourceKind
      && this.baselineHash === candidate.baselineHash
      && this.currentHash === candidate.currentHash
      && this.truncated === candidate.truncated
      && this.changed === candidate.changed
      && this.changedPaths.length === candidate.changedPaths.length
      && this.changedPaths.every((item, index) => item === candidate.changedPaths[index]);
  }
}

export class ReviewRecoveryBaseline {
  constructor(input = {}) {
    this.kind = input.kind ? requireString(input.kind, "kind") : "review";
    this.phase = requireString(input.phase, "phase");
    this.canonicalPhase = requireString(input.canonicalPhase || canonicalPhaseFor(this.kind, this.phase), "canonicalPhase");
    this.fingerprint = input.fingerprint instanceof EvidenceFingerprint
      ? input.fingerprint
      : new EvidenceFingerprint(input.fingerprint || {});
    this.trigger = input.trigger ? String(input.trigger) : null;
    this.createdAt = requireString(input.createdAt || new Date().toISOString(), "createdAt");
  }

  static from(value) {
    return value instanceof ReviewRecoveryBaseline ? value : new ReviewRecoveryBaseline(value || {});
  }

  toJSON() {
    return {
      kind: this.kind,
      phase: this.phase,
      canonicalPhase: this.canonicalPhase,
      fingerprint: this.fingerprint.toJSON(),
      ...(this.trigger && { trigger: this.trigger }),
      createdAt: this.createdAt,
    };
  }
}

export class RetryRecoveryEntry {
  constructor(input = {}) {
    this.id = requireString(input.id, "id");
    this.kind = requireString(input.kind, "kind");
    this.phase = requireString(input.phase, "phase");
    this.canonicalPhase = requireString(input.canonicalPhase, "canonicalPhase");
    this.reason = requireString(input.reason, "reason");
    this.changedEvidence = input.changedEvidence instanceof ChangedEvidenceSummary
      ? input.changedEvidence
      : new ChangedEvidenceSummary(input.changedEvidence || {});
    this.permittedReevaluationCount = requireSafeInteger(input.permittedReevaluationCount, "permittedReevaluationCount");
    this.attemptsBefore = requireSafeInteger(input.attemptsBefore, "attemptsBefore");
    this.maxAttempts = requireSafeInteger(input.maxAttempts, "maxAttempts");
    this.counterAfter = requireSafeInteger(input.counterAfter, "counterAfter");
    this.recoveryCommand = requireString(input.recoveryCommand, "recoveryCommand");
    this.createdAt = requireString(input.createdAt, "createdAt");
    if (!VALID_KINDS.includes(this.kind)) throw new Error(`invalid recovery kind: ${this.kind}`);
    if (this.permittedReevaluationCount !== PERMITTED_REEVALUATION_COUNT) {
      throw new Error("permittedReevaluationCount must grant exactly one re-evaluation");
    }
    if (this.maxAttempts === 0 || this.attemptsBefore !== this.maxAttempts) {
      throw new Error("public recovery entry requires an exhausted retry budget");
    }
    if (this.counterAfter !== this.maxAttempts - 1) {
      throw new Error("counterAfter must grant exactly one retry attempt");
    }
  }

  static fromStored(value) {
    assertExactKeys(value, PUBLIC_RECOVERY_ENTRY_KEYS, "retry recovery entry");
    return new RetryRecoveryEntry({
      ...value,
      changedEvidence: ChangedEvidenceSummary.fromStored(value.changedEvidence),
    });
  }

  toJSON() {
    return {
      id: this.id,
      kind: this.kind,
      phase: this.phase,
      canonicalPhase: this.canonicalPhase,
      reason: this.reason,
      changedEvidence: this.changedEvidence.toJSON(),
      permittedReevaluationCount: this.permittedReevaluationCount,
      attemptsBefore: this.attemptsBefore,
      maxAttempts: this.maxAttempts,
      counterAfter: this.counterAfter,
      recoveryCommand: this.recoveryCommand,
      createdAt: this.createdAt,
    };
  }

  equals(other) {
    const candidate = other instanceof RetryRecoveryEntry
      ? other
      : RetryRecoveryEntry.fromStored(other);
    return this.id === candidate.id
      && this.kind === candidate.kind
      && this.phase === candidate.phase
      && this.canonicalPhase === candidate.canonicalPhase
      && this.reason === candidate.reason
      && this.changedEvidence.equals(candidate.changedEvidence)
      && this.permittedReevaluationCount === candidate.permittedReevaluationCount
      && this.attemptsBefore === candidate.attemptsBefore
      && this.maxAttempts === candidate.maxAttempts
      && this.counterAfter === candidate.counterAfter
      && this.recoveryCommand === candidate.recoveryCommand
      && this.createdAt === candidate.createdAt;
  }
}

const RETRY_RECOVERY_AUDIT_KEYS = Object.freeze([
  "step", "grantId", ...PUBLIC_RECOVERY_ENTRY_KEYS, "timestamp", "issueLogId",
]);

export class RetryRecoveryAuditEntry {
  constructor({ grant, step = "retry-recovery", grantId, timestamp, issueLogId } = {}) {
    this.grant = grant instanceof RetryRecoveryEntry ? grant : RetryRecoveryEntry.fromStored(grant || {});
    this.step = requireString(step, "retry recovery audit step");
    this.grantId = requireString(grantId || this.grant.id, "retry recovery audit grantId");
    this.timestamp = requireString(timestamp || this.grant.createdAt, "retry recovery audit timestamp");
    this.issueLogId = requireString(issueLogId || this.grant.id, "retry recovery audit issueLogId");
    if (this.step !== "retry-recovery" || this.grantId !== this.grant.id || this.issueLogId !== this.grant.id) {
      throw new Error(`retry recovery audit identity diverges from grant: ${this.grant.id}`);
    }
  }

  static identifies(value, grantId) {
    return value?.grantId === grantId || value?.id === grantId || value?.issueLogId === grantId;
  }

  static fromStored(value) {
    assertExactKeys(value, RETRY_RECOVERY_AUDIT_KEYS, "retry recovery audit entry");
    const grantValue = Object.fromEntries(PUBLIC_RECOVERY_ENTRY_KEYS.map((key) => [key, value[key]]));
    return new RetryRecoveryAuditEntry({
      grant: RetryRecoveryEntry.fromStored(grantValue),
      step: value.step,
      grantId: value.grantId,
      timestamp: value.timestamp,
      issueLogId: value.issueLogId,
    });
  }

  equalsGrant(grant) {
    return this.grant.equals(grant)
      && this.timestamp === grant.createdAt
      && this.grantId === grant.id
      && this.issueLogId === grant.id;
  }

  toIssueLogInput() {
    return {
      step: this.step,
      grantId: this.grantId,
      ...this.grant.toJSON(),
      timestamp: this.timestamp,
    };
  }

  toJSON() {
    return { ...this.toIssueLogInput(), issueLogId: this.issueLogId };
  }
}

export function persistReviewRecoveryBaseline(state, input = {}) {
  const phase = requireString(input.phase, "phase");
  const baseline = new ReviewRecoveryBaseline({
    kind: "review",
    phase,
    canonicalPhase: canonicalReviewPhase(phase),
    fingerprint: input.fingerprint,
    trigger: input.trigger,
    createdAt: input.createdAt || new Date().toISOString(),
  });
  appendRecoveryBaseline(state, baseline);
  return baseline;
}

export function persistRecoveryBaseline(state, input = {}) {
  const kind = requireString(input.kind, "kind");
  const phase = requireString(input.phase, "phase");
  const baseline = new ReviewRecoveryBaseline({
    kind,
    phase,
    canonicalPhase: canonicalPhaseFor(kind, phase),
    fingerprint: input.fingerprint,
    trigger: input.trigger,
    createdAt: input.createdAt || new Date().toISOString(),
  });
  appendRecoveryBaseline(state, baseline);
  return baseline;
}

function buildSpecGateBaselineMigration({ kind, target, current }) {
  if (
    kind !== "gate"
    || target.canonicalPhase !== "spec"
    || current.components?.runtimeHash == null
  ) {
    return null;
  }
  return new ReviewRecoveryBaseline({
    kind,
    phase: target.phase,
    canonicalPhase: target.canonicalPhase,
    fingerprint: new EvidenceFingerprint({
      sourceKind: current.sourceKind,
      hash: current.components.projectHash,
      paths: current.paths,
      truncated: current.truncated,
      components: new EvidenceFingerprintComponents({
        projectHash: current.components.projectHash,
        runtimeHash: null,
      }),
    }),
    trigger: "spec-gate-recovery-enabled",
  });
}

export function evaluateRecoveryEligibility(input = {}) {
  const kind = requireString(input.kind, "kind");
  const phase = requireString(input.phase, "phase");
  const target = resolveRecoveryTarget(kind, phase);
  if (!target.recoverable) {
    return { recoverable: false, reason: target.reason };
  }
  if (Number(input.attempts) < Number(input.maxAttempts)) {
    return { recoverable: true, reason: "retry-budget-available" };
  }

  let current = null;
  let baseline = latestMatchingBaseline(input.baselines, kind, target.canonicalPhase);
  if (!baseline && kind === "gate" && target.canonicalPhase === "spec") {
    current = input.currentFingerprint instanceof EvidenceFingerprint
      ? input.currentFingerprint
      : new EvidenceFingerprint(input.currentFingerprint || {});
    baseline = buildSpecGateBaselineMigration({ kind, target, current });
  }
  if (!baseline) return { recoverable: false, reason: "missing-baseline" };

  current ??= input.currentFingerprint instanceof EvidenceFingerprint
    ? input.currentFingerprint
    : new EvidenceFingerprint(input.currentFingerprint || {});
  const source = input.mappedSource || null;
  const changedPaths = baseline.fingerprint.hash === current.hash
    ? []
    : filterPathsForSource(current.paths, source);
  const changedEvidence = new ChangedEvidenceSummary({
    sourceKind: current.sourceKind,
    baselineHash: baseline.fingerprint.hash,
    currentHash: current.hash,
    changedPaths,
    truncated: baseline.fingerprint.truncated || current.truncated,
  });
  if (!changedEvidence.changed) {
    return { recoverable: false, reason: "unchanged-evidence", changedEvidence };
  }
  const componentChange = current.componentChangeFrom(baseline.fingerprint);
  return {
    recoverable: true,
    reason: "changed-evidence",
    changedEvidence,
    changeKind: (
      componentChange?.projectChanged === false
      && componentChange.runtimeChanged === true
    ) ? "runtime-evaluator" : "project-evidence",
  };
}

export function evaluateRepeatedRecovery(input = {}) {
  const evidence = input.changedEvidence instanceof ChangedEvidenceSummary
    ? input.changedEvidence
    : new ChangedEvidenceSummary(input.changedEvidence || {});
  if (!evidence.changed) {
    return { recoverable: false, reason: "unchanged-evidence", changedEvidence: evidence };
  }
  return { recoverable: true, reason: "changed-evidence", changedEvidence: evidence };
}

export function buildOneAttemptGrantMetrics({ counter, phase, maxAttempts }) {
  const counterAfter = Math.max(0, Number(maxAttempts) - 1);
  return [
    { phase, counter, delta: 0, reset: true },
    { phase, counter, delta: counterAfter },
  ];
}

export function buildRetryRecoveryView(input = {}) {
  const kind = requireString(input.kind, "kind");
  const phase = requireString(input.phase, "phase");
  const canonicalPhase = requireString(input.canonicalPhase || canonicalPhaseFor(kind, phase), "canonicalPhase");
  const recoveryPossible = input.recoveryPossible === true;
  const changedEvidence = input.changedEvidence
    ? (input.changedEvidence instanceof ChangedEvidenceSummary
      ? input.changedEvidence
      : new ChangedEvidenceSummary(input.changedEvidence))
    : null;
  const reason = input.reason || "Describe the changed evidence before re-evaluation.";
  return {
    kind,
    phase,
    canonicalPhase,
    attempts: Number(input.attempts ?? 0),
    max: Number(input.max ?? 0),
    recoveryPossible,
    recoveryReason: requireString(input.recoveryReason || (recoveryPossible ? "changed-evidence" : "unsupported-recovery-target"), "recoveryReason"),
    changedEvidence: changedEvidence ? changedEvidence.toJSON() : null,
    recoveryCommand: recoveryPossible
      ? recoveryCommandFor({ kind, phase, reason })
      : null,
  };
}

export function buildCurrentRecoveryFingerprint({ root, flowState, kind, canonicalPhase, baseline }) {
  if (baseline?.fingerprint && baseline.fingerprint.hash === "same") {
    return new EvidenceFingerprint({
      sourceKind: baseline.fingerprint.sourceKind,
      hash: baseline.fingerprint.hash,
      paths: baseline.fingerprint.paths,
      truncated: baseline.fingerprint.truncated,
    });
  }

  const source = resolveRecoveryEvidenceSource({
    kind,
    canonicalPhase,
    specDir: specDirFor(relativeFlowSpecFile(flowState)),
  });
  let paths = [];
  let truncated = false;

  if (source.sourceKind === "implementation-diff" || source.sourceKind === "implementation-and-test-artifacts") {
    if (fs.existsSync(path.join(root, ".git"))) {
      try {
        paths = listChangedFilesDetailed({
          cwd: root,
          baseBranch: flowState.baseBranch || "main",
          untrackedFiles: "all",
          maxChangedFileEntries: MAX_FINGERPRINT_FILES,
        })
          .map((entry) => entry.path)
          .filter((p) => source.includes(p));
      } catch (_) {
        const fallback = [];
        truncated = walkFiles(root, "src", fallback);
        paths = fallback.filter((p) => source.includes(p));
      }
    } else {
      const fallback = [];
      truncated = walkFiles(root, "src", fallback);
      paths = fallback.filter((p) => source.includes(p));
    }
  }

  if (paths.length === 0) {
    const listed = [];
    for (const sourcePath of source.paths) {
      const wasTruncated = walkFiles(root, sourcePath, listed);
      truncated = truncated || wasTruncated;
    }
    paths = listed;
  }

  const fingerprint = source.fingerprint(root, normalizeChangedPaths(paths).sort());
  return new EvidenceFingerprint({
    ...fingerprint.toJSON(),
    truncated,
  });
}

export function buildRecoveryEligibilityForState({ root, flowState, kind, phase, attempts, maxAttempts }) {
  const target = resolveRecoveryTarget(kind, phase);
  const baseline = latestMatchingBaseline(flowState.reviewRecoveryBaselines, kind, target.canonicalPhase);
  const currentFingerprint = target.recoverable
    ? buildCurrentRecoveryFingerprint({ root, flowState, kind, canonicalPhase: target.canonicalPhase, baseline })
    : null;
  const eligibility = evaluateRecoveryEligibility({
    kind,
    phase,
    attempts,
    maxAttempts,
    baselines: flowState.reviewRecoveryBaselines,
    currentFingerprint,
    mappedSource: target.recoverable
      ? resolveRecoveryEvidenceSource({
          kind,
          canonicalPhase: target.canonicalPhase,
          specDir: specDirFor(relativeFlowSpecFile(flowState)),
        })
      : null,
  });
  const latest = loadAuthoritativeRecoveryArtifact(root, flowState)
    .latestCommitted(kind, target.canonicalPhase);
  if (
    eligibility.recoverable === true
    && latest?.changedEvidence?.currentHash === eligibility.changedEvidence?.currentHash
  ) {
    return {
      recoverable: false,
      reason: "recovery-already-granted",
      changedEvidence: eligibility.changedEvidence,
    };
  }
  return eligibility;
}

export function buildStateRetryRecoveryView({ root, flowState, kind, phase, attempts, max, reason }) {
  const target = resolveRecoveryTarget(kind, phase);
  const { artifact, transaction } = loadAuthoritativeRecoveryAuthority(root, flowState);
  if (transaction?.status === "pending") {
    return buildRetryRecoveryView({
      kind,
      phase,
      canonicalPhase: target.canonicalPhase,
      attempts,
      max,
      recoveryPossible: true,
      recoveryReason: "recovery-resume-required",
      changedEvidence: transaction.request.changedEvidence,
      reason: transaction.request.reason,
    });
  }
  if (attempts < max) return null;
  if (!target.recoverable) {
    return buildRetryRecoveryView({
      kind,
      phase,
      canonicalPhase: target.canonicalPhase,
      attempts,
      max,
      recoveryPossible: false,
      recoveryReason: target.reason,
      changedEvidence: null,
      reason,
    });
  }
  const eligibility = buildRecoveryEligibilityForState({ root, flowState, kind, phase, attempts, maxAttempts: max });
  return buildRetryRecoveryView({
    kind,
    phase,
    canonicalPhase: target.canonicalPhase,
    attempts,
    max,
    recoveryPossible: eligibility.recoverable === true,
    recoveryReason: eligibility.reason,
    changedEvidence: eligibility.changedEvidence || null,
    reason,
  });
}

export function persistCurrentRecoveryBaseline({ root, flowState, kind, phase, trigger, createdAt }) {
  const target = resolveRecoveryTarget(kind, phase);
  if (!target.recoverable) return null;
  const fingerprint = buildCurrentRecoveryFingerprint({
    root,
    flowState,
    kind,
    canonicalPhase: target.canonicalPhase,
    baseline: null,
  });
  return persistRecoveryBaseline(flowState, {
    kind,
    phase,
    fingerprint,
    trigger,
    createdAt,
  });
}

export class RetryRecoveryGrantError extends Error {
  constructor(code, message, data = {}) {
    super(message);
    this.name = "RetryRecoveryGrantError";
    this.code = code;
    this.data = data;
  }
}

function recoveryLockError(status, message, data = {}) {
  const code = {
    live: "RECOVERY_OPERATION_BUSY",
    stale: "RECOVERY_OPERATION_LOCK_STALE",
    unknown: "RECOVERY_OPERATION_LOCK_UNKNOWN",
    corrupt: "RECOVERY_OPERATION_LOCK_CORRUPT",
    "authority-invalid": "RECOVERY_OPERATION_AUTHORITY_INVALID",
    "ownership-changed": "RECOVERY_OPERATION_OWNERSHIP_CHANGED",
  }[status] || "RECOVERY_OPERATION_LOCK_FAILED";
  return new RetryRecoveryGrantError(code, message, data);
}

export class RetryRecoveryOperationLock {
  constructor({ root, spec, processIdentitySource = new ProcessIdentitySource() }) {
    const specDir = path.dirname(path.resolve(root, spec));
    this.core = new ProcessOwnedLock({
      directoryAuthority: new RealDirectoryAuthority(specDir, {
        errorFactory: (status, message, data) => recoveryLockError(status, message, data),
      }),
      fileName: ".retry-recovery.lock",
      kind: "retry-recovery-operation",
      authority: {
        root: path.resolve(root),
        spec,
        artifactPath: path.join(specDir, RECOVERY_ARTIFACT_FILE),
      },
      processIdentitySource,
      errorFactory: (status, message, data) => recoveryLockError(status, message, data),
    });
  }

  acquire() {
    return this.core.acquire({ claimStale: true });
  }

  release() {
    this.core.release();
  }
}

class RetryRecoveryRequestSnapshot {
  constructor(input = {}) {
    this.runId = requireString(input.runId, "runId");
    this.specId = requireString(input.specId, "specId");
    this.hasIssue = input.hasIssue === true;
    this.issue = this.hasIssue ? Number(input.issue) : null;
    this.kind = requireString(input.kind, "kind");
    this.phase = requireString(input.phase, "phase");
    this.canonicalPhase = requireString(input.canonicalPhase, "canonicalPhase");
    this.reason = requireString(input.reason, "reason");
    this.attempts = requireSafeInteger(input.attempts, "attempts");
    this.maxAttempts = requireSafeInteger(input.maxAttempts, "maxAttempts");
    this.changedEvidence = input.changedEvidence
      ? (input.changedEvidence instanceof ChangedEvidenceSummary
        ? input.changedEvidence
        : new ChangedEvidenceSummary(input.changedEvidence))
      : null;
    if (!VALID_KINDS.includes(this.kind)) throw new Error(`invalid request kind: ${this.kind}`);
    if (typeof input.hasIssue !== "boolean") throw new Error("request.hasIssue must be boolean");
    if (this.hasIssue && !Number.isSafeInteger(this.issue)) throw new Error("request.issue must be an integer");
    Object.freeze(this);
  }

  static fromStored(value) {
    assertExactKeys(value, RECOVERY_REQUEST_KEYS, "retry recovery request");
    if (value.hasIssue === false && value.issue !== null) {
      throw new Error("stored request.issue must be null when absent");
    }
    return new RetryRecoveryRequestSnapshot({
      ...value,
      changedEvidence: value.changedEvidence == null
        ? null
        : ChangedEvidenceSummary.fromStored(value.changedEvidence),
    });
  }

  matchesInput(input) {
    return this.kind === input.kind
      && this.phase === input.phase
      && this.reason === input.reason;
  }

  toJSON() {
    return {
      runId: this.runId,
      specId: this.specId,
      hasIssue: this.hasIssue,
      issue: this.issue,
      kind: this.kind,
      phase: this.phase,
      canonicalPhase: this.canonicalPhase,
      reason: this.reason,
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      changedEvidence: this.changedEvidence?.toJSON() ?? null,
    };
  }
}

export class RetryRecoveryTransaction {
  constructor(input = {}) {
    this.grantId = requireString(input.grantId, "grantId");
    if (!["pending", "rejected"].includes(input.status)) {
      throw new Error(`invalid retry recovery transaction status: ${input.status}`);
    }
    this.status = input.status;
    this.fingerprint = requireSha256(input.fingerprint, "fingerprint");
    this.expectedFlowRevision = requireSha256(input.expectedFlowRevision, "expectedFlowRevision");
    this.request = input.request instanceof RetryRecoveryRequestSnapshot
      ? input.request
      : RetryRecoveryRequestSnapshot.fromStored(input.request || {});
    this.grant = input.grant
      ? (input.grant instanceof RetryRecoveryEntry ? input.grant : RetryRecoveryEntry.fromStored(input.grant))
      : null;
    this.rejection = input.rejection == null
      ? null
      : {
          code: requireString(input.rejection.code, "rejection.code"),
          message: requireString(input.rejection.message, "rejection.message"),
        };
    this.createdAt = requireString(input.createdAt, "createdAt");
    this.updatedAt = requireString(input.updatedAt || input.createdAt, "updatedAt");
    if (this.status === "pending" && (this.grant == null || this.rejection != null)) {
      throw new Error("pending retry recovery transaction requires a grant and forbids rejection details");
    }
    if (this.status === "rejected" && (this.grant != null || this.rejection == null)) {
      throw new Error("rejected retry recovery transaction requires rejection details and forbids a grant");
    }
    if (this.grant && this.grant.id !== this.grantId) {
      throw new Error("retry recovery transaction grantId must match its grant");
    }
  }

  static fromStored(value) {
    assertExactKeys(value, RECOVERY_TRANSACTION_KEYS, "retry recovery transaction");
    return new RetryRecoveryTransaction(value);
  }

  reject(rejection, updatedAt = new Date().toISOString()) {
    return new RetryRecoveryTransaction({
      ...this.toJSON(),
      status: "rejected",
      grant: null,
      rejection,
      updatedAt,
    });
  }

  toJSON() {
    return {
      grantId: this.grantId,
      status: this.status,
      fingerprint: this.fingerprint,
      expectedFlowRevision: this.expectedFlowRevision,
      request: this.request.toJSON(),
      grant: this.grant?.toJSON() ?? null,
      rejection: this.rejection,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

class RetryRecoveryArtifact {
  constructor(value = {}) {
    assertExactKeys(value, ["version", "entries"], RECOVERY_ARTIFACT_FILE);
    if (value.version !== RECOVERY_ARTIFACT_VERSION || !Array.isArray(value.entries)) {
      throw new Error(`Invalid ${RECOVERY_ARTIFACT_FILE}`);
    }
    this.entries = value.entries.map((entry) => RetryRecoveryEntry.fromStored(entry));
    const ids = new Set();
    for (const entry of this.entries) {
      if (ids.has(entry.id)) throw new Error(`duplicate retry recovery id: ${entry.id}`);
      ids.add(entry.id);
    }
  }

  append(entry) {
    const existing = this.entries.find((item) => item.id === entry.id);
    if (!existing) {
      this.entries.push(entry);
      return true;
    }
    if (!existing.equals(entry)) {
      throw new Error(`retry recovery id has divergent content: ${entry.id}`);
    }
    return false;
  }

  latestCommitted(kind, canonicalPhase) {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      if (entry.kind === kind && entry.canonicalPhase === canonicalPhase) return entry;
    }
    return null;
  }

  toJSON() {
    return {
      version: RECOVERY_ARTIFACT_VERSION,
      entries: this.entries.map((entry) => entry.toJSON()),
    };
  }
}

class RetryRecoveryTransactionStore {
  constructor(store, value) {
    assertExactKeys(value, ["version", "transaction"], RECOVERY_TRANSACTION_FILE);
    if (value.version !== RECOVERY_ARTIFACT_VERSION) throw new Error(`Invalid ${RECOVERY_TRANSACTION_FILE}`);
    this.store = store;
    this.transaction = value.transaction == null
      ? null
      : RetryRecoveryTransaction.fromStored(value.transaction);
  }

  write(transaction) {
    this.store.write({
      version: RECOVERY_ARTIFACT_VERSION,
      transaction: transaction?.toJSON() ?? null,
    });
    this.transaction = transaction;
  }
}

function retryRecoveryArtifactPath(root, spec) {
  return path.join(path.dirname(path.resolve(root, spec)), RECOVERY_ARTIFACT_FILE);
}

function retryRecoveryTransactionPath(root, spec) {
  return path.join(path.dirname(path.resolve(root, spec)), RECOVERY_TRANSACTION_FILE);
}

function readRecoveryArtifact(store) {
  return new RetryRecoveryArtifact(store.read({ version: RECOVERY_ARTIFACT_VERSION, entries: [] }));
}

function readRecoveryTransactionStore(store) {
  return new RetryRecoveryTransactionStore(
    store,
    store.read({ version: RECOVERY_ARTIFACT_VERSION, transaction: null }),
  );
}

function loadRecoveryAuthority(root, spec, { artifactFaultInjector, transactionFaultInjector } = {}) {
  const artifactStore = new AtomicJsonFile(retryRecoveryArtifactPath(root, spec), {
    faultInjector: artifactFaultInjector,
  });
  const privateStore = readRecoveryTransactionStore(new AtomicJsonFile(
    retryRecoveryTransactionPath(root, spec),
    { faultInjector: transactionFaultInjector },
  ));
  const artifact = readRecoveryArtifact(artifactStore);
  const transaction = privateStore.transaction;
  if (transaction) {
    const publicEntry = artifact.entries.find((entry) => entry.id === transaction.grantId);
    if (transaction.status === "rejected" && publicEntry) {
      throw new Error(`rejected retry transaction conflicts with public grant: ${transaction.grantId}`);
    }
    if (
      transaction.status === "pending"
      && publicEntry
      && !publicEntry.equals(transaction.grant)
    ) {
      throw new Error(`pending retry transaction diverges from public grant: ${transaction.grantId}`);
    }
  }
  return { artifact, artifactStore, transaction, transactionStore: privateStore };
}

export function loadRetryRecoveryArtifact(root, spec) {
  const store = new AtomicJsonFile(retryRecoveryArtifactPath(root, spec));
  return readRecoveryArtifact(store).toJSON();
}

function recoveryFingerprint({ request, expectedFlowRevision }) {
  return crypto.createHash("sha256")
    .update(JSON.stringify({ request: request.toJSON(), expectedFlowRevision }))
    .digest("hex");
}

function flowRevision(flowState) {
  const statePath = flowStateSpecLocation(flowState)?.flowStateFile;
  if (!statePath) throw new Error("retry recovery flow state location is unavailable");
  const content = fs.readFileSync(statePath);
  return {
    digest: crypto.createHash("sha256").update(content).digest("hex"),
    statePath,
  };
}

function currentObservation({ root, spec, specId, flowManager, recoveryInput, resolveConfiguredMaxAttempts }) {
  const flowState = flowManager.loadReadOnly(specId);
  if (!flowState) throw new Error(`retry recovery flow state is unavailable: ${spec}`);
  const revision = flowRevision(flowState);
  const attempts = countRetry(flowState.metrics, recoveryInput.kind, recoveryInput.canonicalPhase);
  const configuredMax = resolveConfiguredMaxAttempts(flowState, recoveryInput.canonicalPhase);
  const maxAttempts = resolveRecoveryMaxAttempts({
    root,
    flowState,
    kind: recoveryInput.kind,
    phase: recoveryInput.canonicalPhase,
    attempts,
    resolvedMax: configuredMax,
  });
  const eligibility = buildRecoveryEligibilityForState({
    root,
    flowState,
    kind: recoveryInput.kind,
    phase: recoveryInput.phase,
    attempts,
    maxAttempts,
  });
  const request = new RetryRecoveryRequestSnapshot({
    runId: flowState.runId,
    specId: flowState.specId,
    hasIssue: Object.hasOwn(flowState, "issue"),
    issue: flowState.issue,
    kind: recoveryInput.kind,
    phase: recoveryInput.phase,
    canonicalPhase: recoveryInput.canonicalPhase,
    reason: recoveryInput.reason,
    attempts,
    maxAttempts,
    changedEvidence: eligibility.changedEvidence || null,
  });
  return { flowState, revision, attempts, maxAttempts, eligibility, request };
}

function assertExpectedRequest(input, observation, recoveryInput) {
  const sameIssue = input.expectedHasIssue === Object.hasOwn(observation.flowState, "issue")
    && (!input.expectedHasIssue || Number(input.expectedIssue) === Number(observation.flowState.issue));
  if (
    input.expectedRunId !== observation.flowState.runId
    || input.specId !== observation.flowState.specId
    || !sameIssue
  ) {
    throw retryRequestError(
      "STALE_RECOVERY_REQUEST",
      recoveryInput,
      observation.attempts,
      observation.maxAttempts,
      "target-identity-changed",
    );
  }
  if (
    input.expectedAttempts !== observation.attempts
    || input.expectedMaxAttempts !== observation.maxAttempts
  ) {
    throw retryRequestError(
      "STALE_RECOVERY_REQUEST",
      recoveryInput,
      observation.attempts,
      observation.maxAttempts,
      "retry-budget-changed",
    );
  }
}

function assertTransactionAuthority(transaction, specId, flowState) {
  if (!transaction) return;
  const sameIssue = transaction.request.hasIssue === Object.hasOwn(flowState, "issue")
    && (!transaction.request.hasIssue || Number(flowState.issue) === transaction.request.issue);
  if (
    transaction.request.specId !== specId
    || transaction.request.runId !== flowState.runId
    || !sameIssue
  ) {
    const error = new Error(`retry recovery transaction targets a foreign flow: ${transaction.grantId}`);
    error.code = "RETRY_RECOVERY_FOREIGN_AUTHORITY";
    throw error;
  }
}

function matchingFlowGrants(flowState, grant) {
  if (flowState.retryRecovery == null) return [];
  assertExactKeys(flowState.retryRecovery, ["version", "entries"], "flow retry recovery authority");
  if (flowState.retryRecovery.version !== RECOVERY_ARTIFACT_VERSION || !Array.isArray(flowState.retryRecovery.entries)) {
    throw new Error("flow retry recovery authority is invalid");
  }
  const matches = flowState.retryRecovery.entries
    .filter((entry) => entry?.id === grant.id)
    .map((entry) => RetryRecoveryEntry.fromStored(entry));
  if (matches.length > 1) throw new Error(`duplicate flow retry recovery id: ${grant.id}`);
  if (matches.length === 1 && !matches[0].equals(grant)) {
    throw new Error(`flow retry recovery payload diverges: ${grant.id}`);
  }
  return matches;
}

function matchingIssueAudits(issueDocument, grant) {
  const matches = issueDocument.entries
    .filter((entry) => RetryRecoveryAuditEntry.identifies(entry, grant.id))
    .map((entry) => RetryRecoveryAuditEntry.fromStored(entry));
  if (matches.length > 1) throw new Error(`duplicate issue-log retry recovery id: ${grant.id}`);
  if (matches.length === 1 && !matches[0].equalsGrant(grant)) {
    throw new Error(`issue-log retry recovery payload diverges: ${grant.id}`);
  }
  return matches;
}

function assertRecoveryConvergence({ record, artifact, flowState, issueDocument }) {
  const grant = record.grant;
  const flow = matchingFlowGrants(flowState, grant).length === 1;
  const issue = matchingIssueAudits(issueDocument, grant).length === 1;
  const publicMatches = artifact.entries.filter((entry) => entry.id === grant.id);
  if (publicMatches.length > 1) throw new Error(`duplicate public retry recovery id: ${grant.id}`);
  if (publicMatches.length === 1 && !publicMatches[0].equals(grant)) {
    throw new Error(`public retry recovery payload diverges: ${grant.id}`);
  }
  const published = publicMatches.length === 1;
  if ((issue && !flow) || (published && (!flow || !issue))) {
    throw new Error(`retry recovery authorities are out of order: ${grant.id}`);
  }
  return { flow, issue, published };
}

function buildPendingRecord(observation, recoveryInput, createdAt) {
  const grantId = `recovery-${crypto.randomUUID()}`;
  const grant = (
    observation.eligibility.recoverable === true
    && observation.attempts >= observation.maxAttempts
    && observation.eligibility.changedEvidence
  )
    ? new RetryRecoveryEntry({
        id: grantId,
        kind: recoveryInput.kind,
        phase: recoveryInput.phase,
        canonicalPhase: recoveryInput.canonicalPhase,
        reason: recoveryInput.reason,
        changedEvidence: observation.eligibility.changedEvidence,
        permittedReevaluationCount: PERMITTED_REEVALUATION_COUNT,
        attemptsBefore: observation.attempts,
        maxAttempts: observation.maxAttempts,
        counterAfter: Math.max(0, observation.maxAttempts - 1),
        recoveryCommand: recoveryCommandFor(recoveryInput),
        createdAt,
      })
    : null;
  const fingerprint = recoveryFingerprint({
    request: observation.request,
    expectedFlowRevision: observation.revision.digest,
  });
  if (grant == null) {
    throw retryRequestError(
      String(observation.eligibility.reason || "recovery-not-eligible").replace(/-/g, "_").toUpperCase(),
      recoveryInput,
      observation.attempts,
      observation.maxAttempts,
      observation.eligibility.reason,
    );
  }
  return new RetryRecoveryTransaction({
    grantId,
    status: "pending",
    fingerprint,
    expectedFlowRevision: observation.revision.digest,
    request: observation.request,
    grant,
    rejection: null,
    createdAt,
    updatedAt: createdAt,
  });
}

function emitRecoveryPhase(input, phase, record) {
  if (typeof input.recoveryFaultInjector === "function") {
    input.recoveryFaultInjector({ phase, record: record.toJSON() });
  }
}

function applyNormalRetryReset({ input, flowManager, recoveryInput, observation }) {
  flowManager.mutate((flowState, writerContext) => {
    assertFreshRecoveryTarget(flowState, recoveryInput, {
      runId: observation.request.runId,
      specId: observation.request.specId,
      hasIssue: observation.request.hasIssue,
      issue: observation.request.issue,
    });
    if (writerContext.revisionDigest !== observation.revision.digest) {
      throw retryRequestError(
        "STALE_RECOVERY_REQUEST",
        recoveryInput,
        observation.attempts,
        observation.maxAttempts,
        "flow-revision-changed",
      );
    }
    const attempts = countRetry(flowState.metrics, recoveryInput.kind, recoveryInput.canonicalPhase);
    const configuredMax = input.resolveConfiguredMaxAttempts(flowState, recoveryInput.canonicalPhase);
    const maxAttempts = resolveRecoveryMaxAttempts({
      root: input.root,
      flowState,
      kind: recoveryInput.kind,
      phase: recoveryInput.canonicalPhase,
      attempts,
      resolvedMax: configuredMax,
    });
    if (
      attempts !== observation.attempts
      || maxAttempts !== observation.maxAttempts
      || attempts >= maxAttempts
    ) {
      throw retryRequestError(
        "STALE_RECOVERY_REQUEST",
        recoveryInput,
        attempts,
        maxAttempts,
        "retry-budget-changed",
      );
    }
    flowState.metrics = Array.isArray(flowState.metrics) ? flowState.metrics : [];
    flowState.metrics.push({
      phase: recoveryInput.canonicalPhase,
      counter: counterForKind(recoveryInput.kind),
      delta: 0,
      reset: true,
      taskId: null,
      ts: new Date().toISOString(),
    });
    if (typeof input.afterReset === "function") input.afterReset(flowState);
  }, {
    faultInjector: input.faultInjector,
    passThroughError: (error) => error instanceof RetryRecoveryGrantError,
  });
  return {
    grant: null,
    attemptsBefore: observation.attempts,
    maxAttempts: observation.maxAttempts,
    counterAfter: 0,
  };
}

function inProgressStepIds(steps, out = []) {
  for (const step of Array.isArray(steps) ? steps : []) {
    if (step?.status === "in_progress") out.push(step.id);
    inProgressStepIds(step?.children, out);
  }
  return out;
}

function expectedActiveStep(kind, canonicalPhase, flowState) {
  return RetryTargetRoute.forRecovery(kind, canonicalPhase, {
    currentTaskId: flowState.currentTaskId,
  })?.stepId || null;
}

function assertFreshRecoveryTarget(flowState, input, expected) {
  const sameIssue = expected.hasIssue === Object.hasOwn(flowState, "issue")
    && (!expected.hasIssue || Number(flowState.issue) === expected.issue);
  if (
    flowState.runId !== expected.runId
    || flowState.specId !== expected.specId
    || !sameIssue
  ) {
    throw new RetryRecoveryGrantError(
      "STALE_RECOVERY_REQUEST",
      "retry recovery target identity changed before the writer lock was acquired",
      { kind: input.kind, phase: input.phase },
    );
  }
  const activeIds = inProgressStepIds(flowState.steps);
  for (const task of Array.isArray(flowState.tasks) ? flowState.tasks : []) {
    inProgressStepIds(task.steps, activeIds);
  }
  const expectedStep = expectedActiveStep(input.kind, input.canonicalPhase, flowState);
  if (expectedStep && !activeIds.includes(expectedStep)) {
    throw new RetryRecoveryGrantError(
      "STALE_RECOVERY_TARGET",
      `retry recovery target is no longer active: ${input.kind}/${input.canonicalPhase}`,
      { kind: input.kind, phase: input.phase, expectedStep, activeSteps: activeIds },
    );
  }
}

function retryRequestError(code, recoveryInput, attempts, maxAttempts, reason) {
  return new RetryRecoveryGrantError(
    code,
    `retry recovery rejected for ${recoveryInput.kind}/${recoveryInput.phase}: ${reason}`,
    {
      kind: recoveryInput.kind,
      phase: recoveryInput.phase,
      attempts,
      max: maxAttempts,
      reason,
    },
  );
}

function assertEvaluatorOnlyRepairEvidence({
  root,
  flowState,
  eligibility,
  issueLogEntries,
  recoveryInput,
  attempts,
  maxAttempts,
}) {
  if (
    recoveryInput.kind !== "gate"
    || recoveryInput.canonicalPhase !== "task-impl"
    || eligibility.changeKind !== "runtime-evaluator"
  ) {
    return;
  }
  const assessment = assessTaskGateRepairEvidence({
    root,
    flowState,
    issueLogEntries,
  });
  if (assessment.valid) return;
  throw retryRequestError(
    "EVALUATOR_REPAIR_EVIDENCE_REQUIRED",
    recoveryInput,
    attempts,
    maxAttempts,
    assessment.reason,
  );
}

export function applyRetryReset(input = {}) {
  const root = requireString(input.root, "root");
  const specId = requireString(input.specId, "specId");
  const flowManager = input.flowManager;
  if (!flowManager || typeof flowManager.mutate !== "function") {
    throw new Error("flowManager is required");
  }
  if (typeof input.resolveConfiguredMaxAttempts !== "function") {
    throw new Error("resolveConfiguredMaxAttempts is required");
  }
  const spec = flowManager.specLocation(specId).relativeSpecFile;
  const recoveryInput = input.input instanceof RetryRecoveryInput
    ? input.input
    : new RetryRecoveryInput(input.input || {});
  requireSafeInteger(input.expectedAttempts, "expectedAttempts");
  requireSafeInteger(input.expectedMaxAttempts, "expectedMaxAttempts");
  requireString(input.expectedRunId, "expectedRunId");
  const operation = new RetryRecoveryOperationLock({
    root,
    spec,
    processIdentitySource: input.processIdentitySource,
  });
  operation.acquire();
  let operationError = null;
  try {
    const authority = loadRecoveryAuthority(root, spec, {
      artifactFaultInjector: input.artifactFaultInjector,
      transactionFaultInjector: input.transactionFaultInjector,
    });
    const { artifact, artifactStore, transactionStore } = authority;
    const issueLogStore = new IssueLogStore({
      root,
      spec,
      specId,
      faultInjector: input.issueLogFaultInjector,
      processIdentitySource: input.processIdentitySource,
    });
    // Validate the independent audit authority before publishing a private
    // transaction or mutating flow state. The later append still fresh-reads
    // under its own writer lock.
    let issueSnapshot = issueLogStore.read();
    const observation = currentObservation({
      root,
      spec,
      flowManager,
      recoveryInput,
      resolveConfiguredMaxAttempts: input.resolveConfiguredMaxAttempts,
    });
    assertTransactionAuthority(authority.transaction, specId, observation.flowState);
    assertEvaluatorOnlyRepairEvidence({
      root,
      flowState: observation.flowState,
      eligibility: observation.eligibility,
      issueLogEntries: issueSnapshot.document.entries,
      recoveryInput,
      attempts: observation.attempts,
      maxAttempts: observation.maxAttempts,
    });

    let record = authority.transaction?.status === "pending" ? authority.transaction : null;
    if (record) {
      if (!record.request.matchesInput(recoveryInput)) {
        throw retryRequestError(
          "RECOVERY_RESUME_REQUIRED",
          recoveryInput,
          observation.attempts,
          observation.maxAttempts,
          `pending-grant:${record.grantId}`,
        );
      }
    } else {
      assertExpectedRequest(input, observation, recoveryInput);
      const committed = artifact.latestCommitted(recoveryInput.kind, recoveryInput.canonicalPhase);
      const committedConvergence = committed
        ? assertRecoveryConvergence({
            record: { grant: committed },
            artifact,
            flowState: observation.flowState,
            issueDocument: issueSnapshot.document,
          })
        : null;
      if (committedConvergence?.flow && observation.attempts === committed.counterAfter) {
        throw retryRequestError(
          "RECOVERY_ALREADY_GRANTED",
          recoveryInput,
          observation.attempts,
          observation.maxAttempts,
          "recovery-already-granted",
        );
      }
      if (observation.attempts < observation.maxAttempts) {
        if (input.requireExhausted === true) {
          throw retryRequestError(
            "RETRY_NOT_EXHAUSTED",
            recoveryInput,
            observation.attempts,
            observation.maxAttempts,
            "retry-not-exhausted",
          );
        }
        return applyNormalRetryReset({ input, flowManager, recoveryInput, observation });
      }
      const createdAt = requireString(input.createdAt || new Date().toISOString(), "createdAt");
      record = buildPendingRecord(observation, recoveryInput, createdAt);
      transactionStore.write(record);
      emitRecoveryPhase(input, "after-pending", record);
    }

    let fresh = flowManager.loadReadOnly(specId);
    let convergence = assertRecoveryConvergence({
      record,
      artifact,
      flowState: fresh,
      issueDocument: issueSnapshot.document,
    });
    if (!convergence.flow) {
      try {
        flowManager.mutate((flowState, writerContext) => {
          const expected = {
            runId: record.request.runId,
            specId: record.request.specId,
            hasIssue: record.request.hasIssue,
            issue: record.request.issue,
          };
          assertFreshRecoveryTarget(flowState, recoveryInput, expected);
          if (writerContext.revisionDigest !== record.expectedFlowRevision) {
            throw retryRequestError(
              "STALE_RECOVERY_REQUEST",
              recoveryInput,
              record.request.attempts,
              record.request.maxAttempts,
              "flow-revision-changed",
            );
          }
          const attemptsBefore = countRetry(flowState.metrics, recoveryInput.kind, recoveryInput.canonicalPhase);
          const configuredMax = input.resolveConfiguredMaxAttempts(flowState, recoveryInput.canonicalPhase);
          const maxAttempts = resolveRecoveryMaxAttempts({
            root,
            flowState,
            kind: recoveryInput.kind,
            phase: recoveryInput.canonicalPhase,
            attempts: attemptsBefore,
            resolvedMax: configuredMax,
          });
          if (attemptsBefore !== record.request.attempts || maxAttempts !== record.request.maxAttempts) {
            throw retryRequestError(
              "STALE_RECOVERY_REQUEST",
              recoveryInput,
              attemptsBefore,
              maxAttempts,
              "retry-budget-changed",
            );
          }
          flowState.metrics = Array.isArray(flowState.metrics) ? flowState.metrics : [];
          if (attemptsBefore < maxAttempts) {
            if (input.requireExhausted === true) {
              throw retryRequestError(
                "RETRY_NOT_EXHAUSTED",
                recoveryInput,
                attemptsBefore,
                maxAttempts,
                "retry-not-exhausted",
              );
            }
            flowState.metrics.push({
              phase: recoveryInput.canonicalPhase,
              counter: counterForKind(recoveryInput.kind),
              delta: 0,
              reset: true,
              taskId: null,
              ts: new Date().toISOString(),
            });
            if (typeof input.afterReset === "function") input.afterReset(flowState);
            return;
          }
          const eligibility = buildRecoveryEligibilityForState({
            root,
            flowState,
            kind: recoveryInput.kind,
            phase: recoveryInput.phase,
            attempts: attemptsBefore,
            maxAttempts,
          });
          assertEvaluatorOnlyRepairEvidence({
            root,
            flowState,
            eligibility,
            issueLogEntries: issueSnapshot.document.entries,
            recoveryInput,
            attempts: attemptsBefore,
            maxAttempts,
          });
          const currentRequest = new RetryRecoveryRequestSnapshot({
            ...record.request.toJSON(),
            attempts: attemptsBefore,
            maxAttempts,
            changedEvidence: eligibility.changedEvidence || null,
          });
          const currentFingerprint = recoveryFingerprint({
            request: currentRequest,
            expectedFlowRevision: writerContext.revisionDigest,
          });
          if (currentFingerprint !== record.fingerprint) {
            throw retryRequestError(
              "STALE_RECOVERY_REQUEST",
              recoveryInput,
              attemptsBefore,
              maxAttempts,
              "recovery-fingerprint-changed",
            );
          }
          if (eligibility.recoverable !== true || record.grant == null) {
            const code = eligibility.reason === "recovery-already-granted"
              ? "RECOVERY_ALREADY_GRANTED"
              : String(eligibility.reason || "recovery-not-eligible").replace(/-/g, "_").toUpperCase();
            throw retryRequestError(code, recoveryInput, attemptsBefore, maxAttempts, eligibility.reason);
          }
          const entries = Array.isArray(flowState.retryRecovery?.entries)
            ? flowState.retryRecovery.entries
            : [];
          flowState.retryRecovery = {
            version: RECOVERY_ARTIFACT_VERSION,
            entries: [...entries, record.grant.toJSON()],
          };
          for (const metric of buildOneAttemptGrantMetrics({
            counter: counterForKind(recoveryInput.kind),
            phase: recoveryInput.canonicalPhase,
            maxAttempts,
          })) {
            flowState.metrics.push({ ...metric, taskId: null, ts: new Date().toISOString() });
          }
          if (typeof input.afterReset === "function") input.afterReset(flowState);
        }, {
          faultInjector: input.faultInjector,
          passThroughError: (error) => error instanceof RetryRecoveryGrantError,
        });
      } catch (error) {
        fresh = flowManager.loadReadOnly(specId);
        if (matchingFlowGrants(fresh, record.grant).length === 0) {
          record = record.reject({
              code: error.code || "FLOW_MUTATION_FAILED",
              message: error.message || String(error),
          });
          transactionStore.write(record);
        }
        throw error;
      }
      fresh = flowManager.loadReadOnly(specId);
      emitRecoveryPhase(input, "after-flow-commit", record);
    }

    convergence = assertRecoveryConvergence({
      record,
      artifact,
      flowState: fresh,
      issueDocument: issueSnapshot.document,
    });
    const audit = new RetryRecoveryAuditEntry({ grant: record.grant });
    issueLogStore.append(audit.toIssueLogInput(), record.grantId);
    issueSnapshot = issueLogStore.read();
    convergence = assertRecoveryConvergence({
      record,
      artifact,
      flowState: fresh,
      issueDocument: issueSnapshot.document,
    });
    emitRecoveryPhase(input, "after-issue-log", record);
    if (!convergence.published) {
      if (artifact.append(record.grant)) artifactStore.write(artifact.toJSON());
      emitRecoveryPhase(input, "after-artifact-commit", record);
    }
    const finalArtifact = readRecoveryArtifact(artifactStore);
    const finalConvergence = assertRecoveryConvergence({
      record,
      artifact: finalArtifact,
      flowState: flowManager.loadReadOnly(specId),
      issueDocument: issueLogStore.read().document,
    });
    if (!finalConvergence.flow || !finalConvergence.issue || !finalConvergence.published) {
      throw new Error(`retry recovery authorities did not converge: ${record.grantId}`);
    }
    transactionStore.write(null);
    return {
      grant: record.grant,
      attemptsBefore: record.request.attempts,
      maxAttempts: record.request.maxAttempts,
      counterAfter: record.grant.counterAfter,
    };
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    try {
      operation.release();
    } catch (releaseError) {
      if (operationError) {
        throw new AggregateError(
          [operationError, releaseError],
          "retry recovery operation and lock release both failed",
          { cause: operationError },
        );
      }
      throw releaseError;
    }
  }
}

export function applyRetryRecoveryGrant(input = {}) {
  const result = applyRetryReset({ ...input, requireExhausted: true });
  return result.grant;
}

export function applyRecoveredRetryOutcome(state, input = {}) {
  const kind = requireString(input.kind, "kind");
  const phase = requireString(input.phase, "phase");
  const verdict = requireString(input.verdict, "verdict");
  const maxAttempts = requireSafeInteger(input.maxAttempts, "maxAttempts");
  const counter = counterForKind(kind);
  state.metrics = Array.isArray(state.metrics) ? state.metrics : [];
  if (verdict === "pass") {
    state.metrics.push({ phase, counter, delta: 0, reset: true });
  } else {
    state.metrics.push({ phase, counter, delta: 1 });
  }
  const counterAfter = countRetry(state.metrics, kind, phase);
  return {
    kind,
    phase,
    counterAfter,
    exhausted: counterAfter >= maxAttempts,
    autoRecoveryGranted: false,
  };
}
