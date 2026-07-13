/**
 * src/flow/lib/retry-recovery.js
 *
 * Audited retry recovery domain model and persistence helpers.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { AtomicJsonFile } from "../../lib/atomic-json-file.js";
import { flowStatePath } from "../../lib/flow-state-atomic-writer.js";
import { listChangedFilesDetailed } from "../../lib/git-helpers.js";
import { ProcessIdentitySource } from "../../lib/process-identity.js";
import { ProcessOwnedLock, RealDirectoryAuthority } from "../../lib/process-owned-lock.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";

export const RECOVERY_REASON_MIN_LENGTH = 20;
export const RECOVERY_REASON_MAX_LENGTH = 500;
export const RECOVERY_ARTIFACT_FILE = "retry-recovery.json";

const RECOVERY_ARTIFACT_VERSION = 1;
const PERMITTED_REEVALUATION_COUNT = 1;
const MAX_CHANGED_PATHS = 50;
const MAX_PATH_LENGTH = 300;
const MAX_FINGERPRINT_FILES = 500;
const MAX_RECOVERY_BASELINES_PER_TARGET = 10;
const VALID_ACTIONS = Object.freeze(["reset"]);
const VALID_KINDS = Object.freeze(["gate", "review"]);
const GATE_RECOVERABLE_PHASES = Object.freeze(["task-impl", "integration"]);
const GATE_TRACKED_UNRECOVERABLE_PHASES = Object.freeze(["draft", "spec"]);
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

function sha256ForFiles(root, relPaths) {
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

function loadAuthoritativeRecoveryArtifact(root, flowState) {
  if (typeof root !== "string" || root.trim() === "") {
    throw new Error("retry recovery root authority is required");
  }
  if (typeof flowState?.spec !== "string" || flowState.spec.trim() === "") {
    throw new Error("retry recovery spec authority is required");
  }
  return readRecoveryArtifact(new AtomicJsonFile(retryRecoveryArtifactPath(root, flowState.spec)));
}

export function resolveRecoveryMaxAttempts({ root, flowState, kind, phase, attempts, resolvedMax }) {
  const target = resolveRecoveryTarget(kind, phase);
  const artifact = loadAuthoritativeRecoveryArtifact(root, flowState);
  // Pending requests freeze the in-flight budget; only committed grants govern later attempts.
  if (artifact.pending) return Math.max(1, artifact.pending.request.maxAttempts);
  const recovery = artifact.latestCommitted(kind, target.canonicalPhase)?.grant ?? null;
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
    if (GATE_TRACKED_UNRECOVERABLE_PHASES.includes(phase)) {
      return new RecoveryTarget({
        kind,
        phase,
        canonicalPhase: phase,
        recoverable: false,
        reason: "unsupported-plan-gate-phase",
      });
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
  }

  includes(relPath) {
    return this.paths.some((sourcePath) => sourcePathMatches(sourcePath, relPath));
  }
}

export function resolveRecoveryEvidenceSource({ kind, canonicalPhase, specDir }) {
  const dir = normalizeRelPath(specDir || ".");
  if (kind === "gate" && canonicalPhase === "task-impl") {
    return new RecoveryEvidenceSource({ sourceKind: "implementation-diff", paths: ["src", `${dir}/spec.json`] });
  }
  if (kind === "gate" && canonicalPhase === "integration") {
    return new RecoveryEvidenceSource({
      sourceKind: "implementation-and-test-artifacts",
      paths: ["src", "plugins", ".senti/config.json", `${dir}/test-execute-result.json`, `${dir}/test-result-review.json`],
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
    return new RecoveryEvidenceSource({ sourceKind: "implementation-diff", paths: ["src", `${dir}/spec.json`] });
  }
  return new RecoveryEvidenceSource({ sourceKind: "unknown", paths: [] });
}

export class EvidenceFingerprint {
  constructor(input = {}) {
    this.sourceKind = requireString(input.sourceKind, "sourceKind");
    this.hash = requireString(input.hash, "hash");
    this.paths = normalizeChangedPaths(input.paths);
    this.truncated = input.truncated === true;
  }

  toJSON() {
    return {
      sourceKind: this.sourceKind,
      hash: this.hash,
      paths: this.paths,
      truncated: this.truncated,
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

  const baseline = latestMatchingBaseline(input.baselines, kind, target.canonicalPhase);
  if (!baseline) return { recoverable: false, reason: "missing-baseline" };

  const current = input.currentFingerprint instanceof EvidenceFingerprint
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
  return { recoverable: true, reason: "changed-evidence", changedEvidence };
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
    specDir: specDirFor(flowState.spec),
  });
  let paths = [];
  let truncated = false;

  if (source.sourceKind === "implementation-diff" || source.sourceKind === "implementation-and-test-artifacts") {
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
  }

  if (paths.length === 0) {
    const listed = [];
    for (const sourcePath of source.paths) {
      const wasTruncated = walkFiles(root, sourcePath, listed);
      truncated = truncated || wasTruncated;
    }
    paths = listed;
  }

  const normalized = normalizeChangedPaths(paths).sort();
  return new EvidenceFingerprint({
    sourceKind: source.sourceKind,
    hash: sha256ForFiles(root, normalized),
    paths: normalized,
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
          specDir: specDirFor(flowState.spec),
        })
      : null,
  });
  const latest = loadAuthoritativeRecoveryArtifact(root, flowState)
    .latestCommitted(kind, target.canonicalPhase)?.grant;
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
  const artifact = loadAuthoritativeRecoveryArtifact(root, flowState);
  if (artifact.pending) {
    return buildRetryRecoveryView({
      kind,
      phase,
      canonicalPhase: target.canonicalPhase,
      attempts,
      max,
      recoveryPossible: false,
      recoveryReason: "recovery-resume-required",
      changedEvidence: artifact.pending.request.changedEvidence,
      reason: artifact.pending.request.reason,
    });
  }
  const latest = artifact.latestCommitted(kind, target.canonicalPhase)?.grant ?? null;
  if (latest && attempts < max) {
    return buildRetryRecoveryView({
      kind,
      phase,
      canonicalPhase: target.canonicalPhase,
      attempts: latest.attemptsBefore,
      max: latest.maxAttempts,
      recoveryPossible: true,
      recoveryReason: "changed-evidence",
      changedEvidence: latest.changedEvidence,
      reason: latest.reason,
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
    this.spec = requireString(input.spec, "spec");
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
    Object.freeze(this);
  }

  matchesInput(input) {
    return this.kind === input.kind
      && this.phase === input.phase
      && this.reason === input.reason;
  }

  toJSON() {
    return {
      runId: this.runId,
      spec: this.spec,
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

export class RetryRecoveryRecord {
  constructor(input = {}) {
    this.grantId = requireString(input.grantId, "grantId");
    if (!["pending", "committed", "rejected"].includes(input.status)) {
      throw new Error(`invalid retry recovery record status: ${input.status}`);
    }
    this.status = input.status;
    this.fingerprint = requireString(input.fingerprint, "fingerprint");
    this.expectedFlowRevision = requireString(input.expectedFlowRevision, "expectedFlowRevision");
    this.request = input.request instanceof RetryRecoveryRequestSnapshot
      ? input.request
      : new RetryRecoveryRequestSnapshot(input.request || {});
    this.grant = input.grant
      ? (input.grant instanceof RetryRecoveryEntry ? input.grant : new RetryRecoveryEntry(input.grant))
      : null;
    this.rejection = input.rejection == null
      ? null
      : {
          code: requireString(input.rejection.code, "rejection.code"),
          message: requireString(input.rejection.message, "rejection.message"),
        };
    this.createdAt = requireString(input.createdAt, "createdAt");
    this.updatedAt = requireString(input.updatedAt || input.createdAt, "updatedAt");
    if (this.status === "committed" && this.grant == null) {
      throw new Error("committed retry recovery record requires a grant");
    }
    if (this.status === "rejected" && this.rejection == null) {
      throw new Error("rejected retry recovery record requires rejection details");
    }
  }

  withStatus(status, { rejection = null, updatedAt = new Date().toISOString() } = {}) {
    return new RetryRecoveryRecord({
      ...this.toJSON(),
      status,
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
    if (value.version !== RECOVERY_ARTIFACT_VERSION || !Array.isArray(value.entries)) {
      throw new Error(`Invalid ${RECOVERY_ARTIFACT_FILE}`);
    }
    this.entries = value.entries.map((entry) => new RetryRecoveryRecord(entry));
  }

  get pending() {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      if (this.entries[index].status === "pending") return this.entries[index];
    }
    return null;
  }

  append(record) {
    this.entries.push(record);
  }

  replace(record) {
    const index = this.entries.findIndex((entry) => entry.grantId === record.grantId);
    if (index < 0) throw new Error(`retry recovery record is missing: ${record.grantId}`);
    this.entries[index] = record;
  }

  latestCommitted(kind, canonicalPhase) {
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const record = this.entries[index];
      if (
        record.status === "committed"
        && record.request.kind === kind
        && record.request.canonicalPhase === canonicalPhase
      ) return record;
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

function retryRecoveryArtifactPath(root, spec) {
  return path.join(path.dirname(path.resolve(root, spec)), RECOVERY_ARTIFACT_FILE);
}

function readRecoveryArtifact(store) {
  return new RetryRecoveryArtifact(store.read({ version: RECOVERY_ARTIFACT_VERSION, entries: [] }));
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

function flowRevision(root, spec) {
  const specId = specIdFromPath(spec);
  if (!specId) throw new Error(`retry recovery spec path is invalid: ${spec}`);
  const statePath = flowStatePath(root, specId);
  const content = fs.readFileSync(statePath);
  return {
    digest: crypto.createHash("sha256").update(content).digest("hex"),
    statePath,
  };
}

function currentObservation({ root, spec, flowManager, recoveryInput, resolveConfiguredMaxAttempts }) {
  const specId = specIdFromPath(spec);
  const flowState = flowManager.loadReadOnly(specId);
  if (!flowState) throw new Error(`retry recovery flow state is unavailable: ${spec}`);
  const revision = flowRevision(root, spec);
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
    spec: flowState.spec,
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
    || input.spec !== observation.flowState.spec
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

function hasFlowGrant(flowState, grantId) {
  return Array.isArray(flowState.retryRecovery?.entries)
    && flowState.retryRecovery.entries.some((entry) => entry?.id === grantId);
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
  return new RetryRecoveryRecord({
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

class RetryRecoveryIssueLog {
  constructor(value = {}) {
    if (!Array.isArray(value.entries)) {
      throw new Error('Invalid issue-log.json: "entries" must be an array');
    }
    this.entries = value.entries;
  }

  append(record) {
    if (this.entries.some((entry) => entry?.grantId === record.grantId)) return false;
    this.entries.push({
      step: "retry-recovery",
      grantId: record.grantId,
      ...record.grant.toJSON(),
      timestamp: record.grant.createdAt,
    });
    return true;
  }

  toJSON() {
    return { entries: this.entries };
  }
}

function readRecoveryIssueLog(store) {
  return new RetryRecoveryIssueLog(store.read({ entries: [] }));
}

function appendRecoveryIssueLog({ store, issueLog, record }) {
  if (issueLog.append(record)) store.write(issueLog.toJSON());
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
      spec: observation.request.spec,
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

function expectedActiveStep(kind, canonicalPhase) {
  if (kind === "gate") {
    return canonicalPhase === "task-impl" ? "task-gate" : "impl-gate";
  }
  return {
    "draft-questions": "draft-questions-review",
    "draft-coverage": "draft-coverage-review",
    spec: "spec-review",
    test: "test-review",
    impl: "impl-review",
  }[canonicalPhase] || null;
}

function assertFreshRecoveryTarget(flowState, input, expected) {
  const sameIssue = expected.hasIssue === Object.hasOwn(flowState, "issue")
    && (!expected.hasIssue || Number(flowState.issue) === expected.issue);
  if (
    flowState.runId !== expected.runId
    || flowState.spec !== expected.spec
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
  const expectedStep = expectedActiveStep(input.kind, input.canonicalPhase);
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

export function applyRetryReset(input = {}) {
  const root = requireString(input.root, "root");
  const spec = requireString(input.spec, "spec");
  const flowManager = input.flowManager;
  if (!flowManager || typeof flowManager.mutate !== "function") {
    throw new Error("flowManager is required");
  }
  if (typeof input.resolveConfiguredMaxAttempts !== "function") {
    throw new Error("resolveConfiguredMaxAttempts is required");
  }
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
  try {
    const artifactStore = new AtomicJsonFile(retryRecoveryArtifactPath(root, spec), {
      faultInjector: input.artifactFaultInjector,
    });
    const artifact = readRecoveryArtifact(artifactStore);
    const issueLogStore = new AtomicJsonFile(
      path.join(path.dirname(path.resolve(root, spec)), "issue-log.json"),
      { faultInjector: input.issueLogFaultInjector },
    );
    const issueLog = readRecoveryIssueLog(issueLogStore);
    const observation = currentObservation({
      root,
      spec,
      flowManager,
      recoveryInput,
      resolveConfiguredMaxAttempts: input.resolveConfiguredMaxAttempts,
    });

    let record = artifact.pending;
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
      if (
        committed
        && committed.grant
        && hasFlowGrant(observation.flowState, committed.grantId)
        && observation.attempts === committed.grant.counterAfter
      ) {
        throw retryRequestError(
          "RECOVERY_ALREADY_GRANTED",
          recoveryInput,
          observation.attempts,
          observation.maxAttempts,
          "recovery-already-granted",
        );
      }
      if (observation.attempts < observation.maxAttempts && input.requireExhausted !== true) {
        return applyNormalRetryReset({ input, flowManager, recoveryInput, observation });
      }
      const createdAt = requireString(input.createdAt || new Date().toISOString(), "createdAt");
      record = buildPendingRecord(observation, recoveryInput, createdAt);
      artifact.append(record);
      artifactStore.write(artifact.toJSON());
      emitRecoveryPhase(input, "after-pending", record);
    }

    let fresh = flowManager.loadReadOnly(specIdFromPath(spec));
    if (!hasFlowGrant(fresh, record.grantId)) {
      try {
        flowManager.mutate((flowState, writerContext) => {
          const expected = {
            runId: record.request.runId,
            spec: record.request.spec,
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
        fresh = flowManager.loadReadOnly(specIdFromPath(spec));
        if (!hasFlowGrant(fresh, record.grantId)) {
          record = record.withStatus("rejected", {
            rejection: {
              code: error.code || "FLOW_MUTATION_FAILED",
              message: error.message || String(error),
            },
          });
          artifact.replace(record);
          artifactStore.write(artifact.toJSON());
        }
        throw error;
      }
      fresh = flowManager.loadReadOnly(specIdFromPath(spec));
      if (record.grant == null) {
        return {
          grant: null,
          attemptsBefore: record.request.attempts,
          maxAttempts: record.request.maxAttempts,
          counterAfter: 0,
        };
      }
      emitRecoveryPhase(input, "after-flow-commit", record);
    }

    appendRecoveryIssueLog({
      store: issueLogStore,
      issueLog,
      record,
    });
    emitRecoveryPhase(input, "after-issue-log", record);
    record = record.withStatus("committed");
    artifact.replace(record);
    artifactStore.write(artifact.toJSON());
    emitRecoveryPhase(input, "after-artifact-commit", record);
    return {
      grant: record.grant,
      attemptsBefore: record.request.attempts,
      maxAttempts: record.request.maxAttempts,
      counterAfter: record.grant.counterAfter,
    };
  } finally {
    operation.release();
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
