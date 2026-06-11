/**
 * src/flow/lib/retry-recovery.js
 *
 * Audited retry recovery domain model and persistence helpers.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { listChangedFilesDetailed } from "../../lib/git-helpers.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";

export const RECOVERY_ARTIFACT_FILE = "retry-recovery.json";
export const RECOVERY_REASON_MIN_LENGTH = 20;
export const RECOVERY_REASON_MAX_LENGTH = 500;

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

function readJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function readRecoveryArtifact(root, spec) {
  const filePath = path.join(path.dirname(path.resolve(root, spec)), RECOVERY_ARTIFACT_FILE);
  const artifact = readJsonIfExists(filePath, { version: RECOVERY_ARTIFACT_VERSION, entries: [] });
  if (artifact.version !== RECOVERY_ARTIFACT_VERSION || !Array.isArray(artifact.entries)) {
    throw new Error(`Invalid ${RECOVERY_ARTIFACT_FILE}`);
  }
  return { filePath, artifact };
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

export function resolveRecoveryMaxAttempts({ flowState, kind, phase, attempts, resolvedMax }) {
  const target = resolveRecoveryTarget(kind, phase);
  const recovery = latestMatchingRecovery(flowState?.retryRecovery?.entries, kind, target.canonicalPhase);
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
  return evaluateRecoveryEligibility({
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
}

export function buildStateRetryRecoveryView({ root, flowState, kind, phase, attempts, max, reason }) {
  const target = resolveRecoveryTarget(kind, phase);
  const latest = latestMatchingRecovery(flowState.retryRecovery?.entries, kind, target.canonicalPhase);
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

export function applyRetryRecoveryGrant(input = {}) {
  const root = requireString(input.root, "root");
  const spec = requireString(input.spec, "spec");
  const flowState = input.flowState || {};
  const recoveryInput = input.input instanceof RetryRecoveryInput
    ? input.input
    : new RetryRecoveryInput(input.input || {});
  const changedEvidence = input.eligibility?.changedEvidence instanceof ChangedEvidenceSummary
    ? input.eligibility.changedEvidence
    : new ChangedEvidenceSummary(input.eligibility?.changedEvidence || {});
  if (input.eligibility?.recoverable !== true) {
    throw new Error(`recovery is not eligible: ${input.eligibility?.reason || "unknown"}`);
  }

  const attemptsBefore = requireSafeInteger(input.attemptsBefore, "attemptsBefore");
  const maxAttempts = requireSafeInteger(input.maxAttempts, "maxAttempts");
  const counterAfter = Math.max(0, maxAttempts - 1);
  const createdAt = requireString(input.createdAt || new Date().toISOString(), "createdAt");
  const { filePath, artifact } = readRecoveryArtifact(root, spec);
  const entry = new RetryRecoveryEntry({
    id: `recovery-${String(artifact.entries.length + 1).padStart(3, "0")}`,
    kind: recoveryInput.kind,
    phase: recoveryInput.phase,
    canonicalPhase: recoveryInput.canonicalPhase,
    reason: recoveryInput.reason,
    changedEvidence,
    permittedReevaluationCount: PERMITTED_REEVALUATION_COUNT,
    attemptsBefore,
    maxAttempts,
    counterAfter,
    recoveryCommand: recoveryCommandFor(recoveryInput),
    createdAt,
  });
  const entryJson = entry.toJSON();
  artifact.entries.push(entryJson);
  writeJson(filePath, artifact);

  const issueLog = loadIssueLog(root, spec);
  issueLog.entries.push({
    step: "retry-recovery",
    ...entryJson,
  });
  saveIssueLog(root, spec, issueLog);

  const metrics = buildOneAttemptGrantMetrics({
    counter: counterForKind(recoveryInput.kind),
    phase: recoveryInput.canonicalPhase,
    maxAttempts,
  });
  flowState.retryRecovery = artifact;
  flowState.metrics = Array.isArray(flowState.metrics) ? flowState.metrics : [];
  for (const metric of metrics) {
    flowState.metrics.push({ ...metric, taskId: null, ts: new Date().toISOString() });
  }
  writeJson(path.join(path.dirname(path.resolve(root, spec)), "flow.json"), flowState);
  return entry;
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
