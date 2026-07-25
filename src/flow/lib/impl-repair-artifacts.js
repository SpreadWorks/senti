import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { flowLeafIdsBetween } from "../definition.js";
import { appendIssueLogEntry } from "./set-issue-log.js";
import { findStepById, flattenSteps } from "./step-tree.js";
import {
  ExplicitRecoveryTransition,
  StepTransitionCommitIntent,
} from "./step-transition-policy.js";
import {
  REPAIR_DELTA_DIR,
  REPAIR_FINGERPRINT_MANIFEST_FILE,
  REPAIR_LOCK_DIR,
  REPAIR_MIGRATION_FILE,
  REPAIR_STATE_VERSION,
  LEGACY_REPAIR_STATE_VERSION,
  REPAIR_TRANSACTION_FILE,
  ImmutableGitBaseline,
  LegacyRepairFingerprintManifest,
  RepairDeltaArtifact,
  RepairFingerprintManifest,
  RepairFingerprintReference,
  atomicWriteJson,
  buildRepairStateManifest,
  captureRepairBaseline,
  changedRepairPaths,
  normalizeRepairPath,
  readRepairFingerprintMigrationInput,
  readRepairFingerprintManifest,
  repairDeltaArtifact,
  writeRepairDelta,
  writeRepairFingerprintManifest,
} from "./repair-state-identity.js";

export const IMPL_REPAIR_ARTIFACT_FILE = "impl-repair.json";
export const IMPL_TRIAGE_ARTIFACT_FILE = "impl-triage.json";
const IMPL_REPAIR_ENTRY_LIMIT = 100;
const IMPL_REPAIR_LEDGER_SIZE_LIMIT = 1024 * 1024;
const CHANGED_PATH_PREVIEW_LIMIT = 20;
const CHANGED_PATH_GROUP_LIMIT = 20;
const WORKFLOW_ARTIFACT_PATH_PREFIXES = Object.freeze([
  ".senti/",
  ".tmp/",
  "docs/",
  "specs/",
]);

export const EVIDENCE_FILE_BY_STEP = Object.freeze({
  "test-execute": "test-execute-result.json",
  "test-result-review": "test-result-review.json",
  "impl-review": "impl-review.json",
  "impl-gate": "impl-gate-result.json",
  retro: "retro.json",
  "acceptance-review": "acceptance-review.json",
});

const ASSOCIATED_EVIDENCE_PATHS = Object.freeze({
  "test-execute-result.json": ["tests/.raw/test-execution.log"],
  "test-result-review.json": ["test-result-review.md"],
  "impl-review.json": ["review.md"],
});
const TRIAGE_DECISIONS = new Set(["apply", "reject"]);
const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const LEGACY_REPAIR_FINGERPRINT = crypto.createHash("sha256").update("legacy-repair-fingerprint").digest("hex");

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function sameSerializedValue(left, right) {
  return JSON.stringify(left.toJSON()) === JSON.stringify(right.toJSON());
}

function requireHash(value, field) {
  const hash = requireString(value, field);
  if (!HASH_PATTERN.test(hash)) throw new Error(`${field} must be a 64-character SHA-256 digest`);
  return hash.toLowerCase();
}

function requireStringArray(value, field, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${field} must be ${allowEmpty ? "an" : "a non-empty"} array`);
  }
  return value.map((entry, index) => requireString(entry, `${field}[${index}]`));
}

function writeJson(file, value) {
  atomicWriteJson(file, value);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fingerprintFrom(value, field) {
  if (value instanceof RepairFingerprintManifest) return value;
  try {
    return new RepairFingerprintManifest(value);
  } catch (error) {
    throw new Error(`${field}: ${error.message}`);
  }
}

function fingerprintReferenceFrom(value, field) {
  if (value instanceof RepairFingerprintReference) return value;
  try {
    return new RepairFingerprintReference(value);
  } catch (error) {
    throw new Error(`${field}: ${error.message}`);
  }
}

export { RepairFingerprintManifest as RepairFingerprint };

export class ImplTriageItem {
  constructor(input = {}) {
    this.findingId = requireString(input.findingId, "findingId");
    this.sourceStep = requireString(input.sourceStep || "impl-review", "sourceStep");
    this.decision = requireString(input.decision, "decision");
    if (!TRIAGE_DECISIONS.has(this.decision)) throw new Error(`invalid triage decision: ${this.decision}`);
    this.rationale = requireString(input.rationale, "rationale");
    this.evidenceRefs = Object.freeze(requireStringArray(input.evidenceRefs || [], "evidenceRefs"));
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      sourceStep: this.sourceStep,
      decision: this.decision,
      rationale: this.rationale,
      evidenceRefs: [...this.evidenceRefs],
    };
  }
}

export class InvalidatedArtifactRecord {
  constructor(input = {}) {
    this.path = normalizeRepairPath(input.path);
    this.reason = requireString(input.reason, "reason");
    this.previousFingerprint = requireHash(input.previousFingerprint, "previousFingerprint");
    Object.freeze(this);
  }

  toJSON() {
    return { path: this.path, reason: this.reason, previousFingerprint: this.previousFingerprint };
  }
}

export class ChangedPathGroup {
  constructor(input = {}) {
    this.prefix = normalizeRepairPath(input.prefix);
    if (!Number.isSafeInteger(input.count) || input.count < 1) throw new Error("changed path group count must be positive");
    this.count = input.count;
    Object.freeze(this);
  }

  toJSON() {
    return { prefix: this.prefix, count: this.count };
  }
}

function changedPathGroups(paths) {
  const counts = new Map();
  for (const relPath of paths) {
    const parts = relPath.split("/");
    const prefix = parts.length > 1 ? `${parts.slice(0, Math.min(2, parts.length - 1)).join("/")}/` : relPath;
    counts.set(prefix, (counts.get(prefix) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, CHANGED_PATH_GROUP_LIMIT)
    .map(([prefix, count]) => new ChangedPathGroup({ prefix, count }));
}

export class ImplRepairEntry {
  constructor(input = {}) {
    this.id = requireString(input.id, "id");
    this.sourceFindingIds = Object.freeze(requireStringArray(input.sourceFindingIds, "sourceFindingIds"));
    if (new Set(this.sourceFindingIds).size !== this.sourceFindingIds.length) {
      throw new Error("sourceFindingIds must not contain duplicates");
    }
    this.reason = requireString(input.reason, "reason");
    this.previousHash = requireHash(input.previousHash, "previousHash");
    this.currentHash = requireHash(input.currentHash, "currentHash");
    if (this.previousHash === this.currentHash) throw new Error("previousHash and currentHash must differ");
    if (!Number.isSafeInteger(input.changedPathCount) || input.changedPathCount < 1) {
      throw new Error("changedPathCount must be a positive integer");
    }
    this.changedPathCount = input.changedPathCount;
    this.changedPathsRef = normalizeRepairPath(input.changedPathsRef);
    this.changedPathsDigest = requireHash(input.changedPathsDigest, "changedPathsDigest");
    this.changedPathsPreview = Object.freeze(requireStringArray(
      input.changedPathsPreview,
      "changedPathsPreview",
    ).map(normalizeRepairPath));
    if (this.changedPathsPreview.length > CHANGED_PATH_PREVIEW_LIMIT) {
      throw new Error(`changedPathsPreview exceeds ${CHANGED_PATH_PREVIEW_LIMIT} entries`);
    }
    if (new Set(this.changedPathsPreview).size !== this.changedPathsPreview.length) {
      throw new Error("changedPathsPreview must not contain duplicates");
    }
    if (!Array.isArray(input.changedPathGroups) || input.changedPathGroups.length === 0) {
      throw new Error("changedPathGroups must be a non-empty array");
    }
    if (input.changedPathGroups.length > CHANGED_PATH_GROUP_LIMIT) {
      throw new Error(`changedPathGroups exceeds ${CHANGED_PATH_GROUP_LIMIT} entries`);
    }
    this.changedPathGroups = Object.freeze(input.changedPathGroups.map((group) => (
      group instanceof ChangedPathGroup ? group : new ChangedPathGroup(group)
    )));
    if (!Array.isArray(input.invalidations) || input.invalidations.length === 0) {
      throw new Error("invalidations must be a non-empty array");
    }
    this.invalidations = Object.freeze(input.invalidations.map((record) => (
      record instanceof InvalidatedArtifactRecord ? record : new InvalidatedArtifactRecord(record)
    )));
    if (new Set(this.invalidations.map((record) => record.path)).size !== this.invalidations.length) {
      throw new Error("invalidations must not contain duplicate paths");
    }
    this.invalidatedArtifacts = Object.freeze(this.invalidations.map((record) => record.path));
    this.createdAt = requireString(input.createdAt, "createdAt");
    if (Number.isNaN(Date.parse(this.createdAt))) throw new Error("createdAt must be an ISO timestamp");
    Object.freeze(this);
  }

  toProjection() {
    return {
      id: this.id,
      sourceFindingIds: [...this.sourceFindingIds],
      reason: this.reason,
      changedPathCount: this.changedPathCount,
      changedPathsPreview: [...this.changedPathsPreview],
      changedPathGroups: this.changedPathGroups.map((group) => group.toJSON()),
      changedPathsRef: this.changedPathsRef,
      invalidatedArtifacts: [...this.invalidatedArtifacts],
      previousHash: this.previousHash,
      currentHash: this.currentHash,
      createdAt: this.createdAt,
    };
  }

  toJSON() {
    return {
      ...this.toProjection(),
      changedPathsDigest: this.changedPathsDigest,
      invalidations: this.invalidations.map((record) => record.toJSON()),
    };
  }
}

export class ImplRepairLedger {
  constructor(input = {}) {
    if (input.version !== 2) throw new Error("impl-repair ledger version must be 2");
    if (!Array.isArray(input.entries)) throw new Error("impl-repair ledger entries must be an array");
    if (input.entries.length > IMPL_REPAIR_ENTRY_LIMIT) {
      throw new Error(`impl-repair ledger exceeds ${IMPL_REPAIR_ENTRY_LIMIT} entries`);
    }
    this.version = 2;
    this.entries = Object.freeze(input.entries.map((entry) => (
      entry instanceof ImplRepairEntry ? entry : new ImplRepairEntry(entry)
    )));
    if (new Set(this.entries.map((entry) => entry.id)).size !== this.entries.length) {
      throw new Error("impl-repair ledger contains duplicate entry ids");
    }
    for (let index = 1; index < this.entries.length; index++) {
      if (this.entries[index - 1].currentHash !== this.entries[index].previousHash) {
        throw new Error("impl-repair fingerprint chain is discontinuous");
      }
    }
    const serializedBytes = Buffer.byteLength(JSON.stringify({
      version: this.version,
      entries: this.entries.map((entry) => entry.toJSON()),
    }, null, 2) + "\n");
    if (serializedBytes > IMPL_REPAIR_LEDGER_SIZE_LIMIT) {
      throw new Error(`${IMPL_REPAIR_ARTIFACT_FILE} exceeds ${IMPL_REPAIR_LEDGER_SIZE_LIMIT} bytes`);
    }
    Object.freeze(this);
  }

  append(entry) {
    const next = entry instanceof ImplRepairEntry ? entry : new ImplRepairEntry(entry);
    if (this.entries.length > 0 && this.entries.at(-1).currentHash !== next.previousHash) {
      throw new Error("impl-repair fingerprint chain is discontinuous");
    }
    return new ImplRepairLedger({ version: 2, entries: [...this.entries, next] });
  }

  toProjection(currentFingerprint) {
    const current = fingerprintFrom(currentFingerprint, "currentFingerprint");
    const matched = this.entries.length === 0 || this.entries.at(-1).currentHash === current.hash;
    return {
      currentFingerprintMatched: matched,
      repairs: this.entries.map((entry) => entry.toProjection()),
    };
  }

  toJSON() {
    return { version: this.version, entries: this.entries.map((entry) => entry.toJSON()) };
  }

  validateDeltaEvidence(specDir) {
    for (const entry of this.entries) {
      const expectedRef = `${REPAIR_DELTA_DIR}/${entry.id}.json`;
      if (entry.changedPathsRef !== expectedRef) {
        throw new Error(`repair delta reference does not match entry ${entry.id}`);
      }
      const file = path.join(specDir, entry.changedPathsRef);
      if (!fs.existsSync(file)) throw new Error(`repair delta is missing: ${entry.changedPathsRef}`);
      const delta = new RepairDeltaArtifact(readJson(file));
      if (
        delta.id !== entry.id
        || delta.previousHash !== entry.previousHash
        || delta.currentHash !== entry.currentHash
        || delta.changedPaths.length !== entry.changedPathCount
        || delta.digest !== entry.changedPathsDigest
      ) {
        throw new Error(`repair delta does not match ledger entry ${entry.id}`);
      }
      const expectedPreview = delta.changedPaths.slice(0, CHANGED_PATH_PREVIEW_LIMIT);
      if (JSON.stringify(entry.changedPathsPreview) !== JSON.stringify(expectedPreview)) {
        throw new Error(`repair delta preview does not match ledger entry ${entry.id}`);
      }
      const expectedGroups = changedPathGroups(delta.changedPaths).map((group) => group.toJSON());
      if (JSON.stringify(entry.changedPathGroups.map((group) => group.toJSON())) !== JSON.stringify(expectedGroups)) {
        throw new Error(`repair delta groups do not match ledger entry ${entry.id}`);
      }
    }
    return this;
  }
}

export class ImplRepairPurpose {
  constructor(kind) {
    if (new.target === ImplRepairPurpose) {
      throw new Error("ImplRepairPurpose is abstract");
    }
    this.kind = requireString(kind, "impl-repair purpose kind");
  }

  static from(input = null) {
    const kind = input == null
      ? "applied-finding-repair"
      : input instanceof ImplRepairPurpose
        ? input.kind
        : input.kind;
    if (kind === "applied-finding-repair") return new AppliedFindingRepairPurpose();
    if (kind === "test-evidence-refresh") return new TestEvidenceRefreshPurpose();
    throw new Error(`unknown impl-repair purpose: ${kind}`);
  }

  toJSON() {
    return { kind: this.kind };
  }

  recordEvidence() {
    throw new Error(`impl-repair purpose ${this.kind} must implement recordEvidence`);
  }
}

export class AppliedFindingRepairPurpose extends ImplRepairPurpose {
  constructor() {
    super("applied-finding-repair");
    Object.freeze(this);
  }

  recordEvidence({ root, specPath, sourceStep, entry }) {
    recordAppliedFindingRepairEvidence({ root, specPath, sourceStep, entry });
  }
}

export class TestEvidenceRefreshPurpose extends ImplRepairPurpose {
  constructor() {
    super("test-evidence-refresh");
    Object.freeze(this);
  }

  recordEvidence() {
    // Refresh-only transactions deliberately emit no consumable finding repair evidence.
  }
}

export class ImplRepairTargetIdentity {
  constructor(input = {}) {
    this.runId = requireString(input.runId, "target.runId");
    this.spec = normalizeRepairPath(input.spec);
    this.hasIssue = Object.hasOwn(input, "issue") && input.issue != null;
    this.issue = this.hasIssue ? Number(input.issue) : null;
    if (this.hasIssue && !Number.isSafeInteger(this.issue)) {
      throw new Error("target.issue must be an integer");
    }
    Object.freeze(this);
  }

  static fromState(state) {
    return new ImplRepairTargetIdentity({
      runId: state.runId,
      spec: state.spec,
      ...(Object.hasOwn(state, "issue") && state.issue != null
        ? { issue: state.issue }
        : {}),
    });
  }

  equals(value) {
    const other = value instanceof ImplRepairTargetIdentity
      ? value
      : new ImplRepairTargetIdentity(value);
    return sameSerializedValue(other, this);
  }

  assertState(state) {
    const observed = ImplRepairTargetIdentity.fromState(state);
    if (!this.equals(observed)) {
      throw new Error("impl-repair transaction target authority changed");
    }
    return state;
  }

  toJSON() {
    return {
      runId: this.runId,
      spec: this.spec,
      ...(this.hasIssue ? { issue: this.issue } : {}),
    };
  }
}

export class ImplRepairTransaction {
  constructor(input = {}) {
    if (input.version !== 2) throw new Error("impl-repair transaction version must be 2");
    this.version = 2;
    this.id = requireString(input.id, "id");
    this.sourceStep = requireString(input.sourceStep, "sourceStep");
    this.target = input.target instanceof ImplRepairTargetIdentity
      ? input.target
      : new ImplRepairTargetIdentity(input.target);
    this.resetStepIds = Object.freeze(requireStringArray(input.resetStepIds, "resetStepIds", { allowEmpty: true }));
    if (new Set(this.resetStepIds).size !== this.resetStepIds.length) {
      throw new Error("impl-repair transaction resetStepIds must not contain duplicates");
    }
    this.entry = input.entry instanceof ImplRepairEntry ? input.entry : new ImplRepairEntry(input.entry);
    this.ledger = input.ledger instanceof ImplRepairLedger ? input.ledger : new ImplRepairLedger(input.ledger);
    this.currentManifest = input.currentManifest instanceof RepairFingerprintManifest
      ? input.currentManifest
      : new RepairFingerprintManifest(input.currentManifest);
    this.delta = input.delta instanceof RepairDeltaArtifact ? input.delta : new RepairDeltaArtifact(input.delta);
    this.purpose = ImplRepairPurpose.from(input.purpose);
    if (this.id !== this.entry.id || this.id !== this.delta.id) {
      throw new Error("impl-repair transaction id is inconsistent");
    }
    if (this.ledger.entries.at(-1)?.id !== this.entry.id) {
      throw new Error("impl-repair transaction ledger does not end at its entry");
    }
    if (
      this.entry.currentHash !== this.currentManifest.hash
      || this.entry.previousHash !== this.delta.previousHash
      || this.entry.currentHash !== this.delta.currentHash
      || this.entry.changedPathCount !== this.delta.changedPaths.length
      || this.entry.changedPathsDigest !== this.delta.digest
    ) {
      throw new Error("impl-repair transaction evidence is inconsistent");
    }
    this.invalidations = Object.freeze((input.invalidations || []).map((record) => (
      record instanceof InvalidatedArtifactRecord ? record : new InvalidatedArtifactRecord(record)
    )));
    if (JSON.stringify(this.invalidations.map((record) => record.toJSON())) !== JSON.stringify(this.entry.invalidations.map((record) => record.toJSON()))) {
      throw new Error("impl-repair transaction invalidations do not match its entry");
    }
    Object.freeze(this);
  }

  equals(value) {
    const other = value instanceof ImplRepairTransaction
      ? value
      : new ImplRepairTransaction(value);
    return sameSerializedValue(other, this);
  }

  toJSON() {
    return {
      version: this.version,
      id: this.id,
      sourceStep: this.sourceStep,
      target: this.target.toJSON(),
      resetStepIds: [...this.resetStepIds],
      entry: this.entry.toJSON(),
      ledger: this.ledger.toJSON(),
      currentManifest: this.currentManifest.toJSON(),
      delta: this.delta.toJSON(),
      ...(this.purpose instanceof TestEvidenceRefreshPurpose
        ? { purpose: this.purpose.toJSON() }
        : {}),
      invalidations: this.invalidations.map((record) => record.toJSON()),
    };
  }
}

export class ImplRepairPrecommitAuthority {
  constructor() {
    if (new.target === ImplRepairPrecommitAuthority) {
      throw new Error("impl-repair precommit authority must use a concrete type");
    }
  }

  assertTransition() {
    throw new Error("impl-repair precommit authority must validate the transition");
  }

  assertEffects() {
    throw new Error("impl-repair precommit authority must validate the effects");
  }
}

export class ImplRepairTransitionIntent extends StepTransitionCommitIntent {
  constructor(transaction, precommitAuthority = null) {
    super();
    this.transaction = transaction instanceof ImplRepairTransaction
      ? transaction
      : new ImplRepairTransaction(transaction);
    if (
      precommitAuthority != null
      && !(precommitAuthority instanceof ImplRepairPrecommitAuthority)
    ) {
      throw new Error("impl-repair transition precommit authority is invalid");
    }
    this.precommitAuthority = precommitAuthority;
    Object.freeze(this);
  }

  assertBeforeTransition(state) {
    this.precommitAuthority?.assertTransition(state, this.transaction);
  }

  applyTo(state) {
    const pending = state.implRepairTransaction == null
      ? null
      : new ImplRepairTransaction(state.implRepairTransaction);
    if (pending && !this.transaction.equals(pending)) {
      throw new Error("a different impl-repair transaction is already pending");
    }
    state.implRepairTransaction = this.transaction.toJSON();
    if (this.transaction.purpose instanceof TestEvidenceRefreshPurpose) {
      delete state.acceptanceReview;
    }
  }

  completeIn(state) {
    if (state.implRepairTransaction == null) {
      throw new Error("pending impl-repair transition intent is missing");
    }
    const pending = new ImplRepairTransaction(state.implRepairTransaction);
    if (!this.transaction.equals(pending)) {
      throw new Error("pending impl-repair transition intent changed before completion");
    }
    delete state.implRepairTransaction;
  }
}

export class RepairStateMigration {
  constructor(input = {}) {
    if (input.version !== 2) throw new Error("repair state migration version must be 2");
    this.version = 2;
    this.runId = requireString(input.runId, "runId");
    this.specPath = normalizeRepairPath(input.specPath);
    if (input.sourceVersion !== LEGACY_REPAIR_STATE_VERSION) {
      throw new Error(`repair state migration sourceVersion must be ${LEGACY_REPAIR_STATE_VERSION}`);
    }
    this.sourceVersion = LEGACY_REPAIR_STATE_VERSION;
    if (input.targetVersion !== REPAIR_STATE_VERSION) {
      throw new Error(`repair state migration targetVersion must be ${REPAIR_STATE_VERSION}`);
    }
    this.targetVersion = REPAIR_STATE_VERSION;
    this.baseline = input.baseline instanceof ImmutableGitBaseline
      ? input.baseline
      : new ImmutableGitBaseline(input.baseline);
    this.invalidations = Object.freeze((input.invalidations || []).map((record) => (
      record instanceof InvalidatedArtifactRecord ? record : new InvalidatedArtifactRecord(record)
    )));
    this.resetStepIds = Object.freeze(requireStringArray(input.resetStepIds, "resetStepIds"));
    this.recordPhase = requireString(input.recordPhase || "prepared", "recordPhase");
    if (this.recordPhase !== "prepared" && this.recordPhase !== "completed") {
      throw new Error("repair state migration recordPhase must be prepared or completed");
    }
    this.retainRecord = input.retainRecord === true;
    this.createdAt = requireString(input.createdAt, "createdAt");
    if (Number.isNaN(Date.parse(this.createdAt))) throw new Error("repair state migration createdAt must be an ISO timestamp");
    Object.freeze(this);
  }

  complete() {
    return new RepairStateMigration({ ...this.toJSON(), recordPhase: "completed" });
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specPath: this.specPath,
      sourceVersion: this.sourceVersion,
      targetVersion: this.targetVersion,
      baseline: this.baseline.toJSON(),
      invalidations: this.invalidations.map((record) => record.toJSON()),
      resetStepIds: [...this.resetStepIds],
      recordPhase: this.recordPhase,
      retainRecord: this.retainRecord,
      createdAt: this.createdAt,
    };
  }
}

export class RepairStateMigratedError extends Error {
  constructor() {
    super("legacy repair fingerprint state was migrated safely; rerun senti flow get next-action and regenerate test evidence");
    this.name = "RepairStateMigratedError";
    this.code = "REPAIR_STATE_MIGRATED";
  }
}

export function collectRepairFingerprintPaths({ root, specPath, state = null }) {
  return buildRepairFingerprint({ root, specPath, state }).entries.map((entry) => entry.path);
}

export function buildRepairFingerprint({ root, specPath, state = null, truncated = false }) {
  if (truncated) throw new Error("truncated repair fingerprint is not valid evidence");
  return buildRepairStateManifest({ root, specPath, state });
}

export function stampRepairFingerprint({ root, specPath, state = null, artifact, fingerprint = null }) {
  const current = fingerprint == null
    ? buildRepairFingerprint({ root, specPath, state })
    : fingerprintFrom(fingerprint, "fingerprint");
  return { ...artifact, repairFingerprint: current.hash };
}

export function assertRepairFingerprint({ artifact, fingerprint, label = "artifact" }) {
  const current = fingerprintFrom(fingerprint, "fingerprint");
  if (!artifact || typeof artifact !== "object") throw new Error(`${label} must be an object`);
  if (typeof artifact.repairFingerprint !== "string" || artifact.repairFingerprint === "") {
    throw new Error(`${label} repairFingerprint is missing`);
  }
  if (artifact.repairFingerprint !== current.hash) {
    throw new Error(`${label} repairFingerprint mismatch: expected ${current.hash}, got ${artifact.repairFingerprint}`);
  }
  return artifact;
}

export function assertCurrentRepairEvidenceFiles({ root, state, specDir, files }) {
  const existing = files.filter((file) => fs.existsSync(path.join(specDir, file)));
  if (existing.length === 0) return null;
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec, state });
  for (const file of existing) {
    assertRepairFingerprint({ artifact: readJson(path.join(specDir, file)), fingerprint, label: file });
  }
  return fingerprint;
}

export function writeRepairEvidenceArtifact({ specDir, stepId, artifact, fingerprint }) {
  const fileName = EVIDENCE_FILE_BY_STEP[stepId];
  if (!fileName) throw new Error(`unknown repair evidence step: ${stepId}`);
  const current = fingerprintFrom(fingerprint, "fingerprint");
  const stamped = stampRepairFingerprint({ artifact, fingerprint: current });
  const file = path.join(specDir, fileName);
  writeRepairFingerprintManifest(specDir, current);
  writeJson(file, stamped);
  return { path: file, artifact: stamped };
}

export function validateImplTriageArtifact(artifact, { sourceFindingIds } = {}) {
  if (!artifact || typeof artifact !== "object") throw new Error("impl-triage artifact must be an object");
  if (artifact.version !== 2) throw new Error("impl-triage version must be 2");
  if (artifact.phase !== "impl-triage") throw new Error("impl-triage phase is required");
  const sourceStep = requireString(artifact.sourceStep, "sourceStep");
  requireString(artifact.sourceArtifact, "sourceArtifact");
  const expected = requireStringArray(sourceFindingIds, "sourceFindingIds");
  const items = Array.isArray(artifact.items) ? artifact.items.map((item) => new ImplTriageItem(item)) : [];
  const actual = new Set();
  for (const item of items) {
    if (actual.has(item.findingId)) throw new Error(`duplicate finding id: ${item.findingId}`);
    if (item.sourceStep !== sourceStep) throw new Error(`finding ${item.findingId} sourceStep does not match ${sourceStep}`);
    if (sourceStep === "acceptance-review" && item.decision !== "apply") {
      throw new Error(`acceptance finding ${item.findingId} must use apply disposition`);
    }
    actual.add(item.findingId);
    if (!expected.includes(item.findingId)) throw new Error(`unknown finding id: ${item.findingId}`);
  }
  for (const findingId of expected) {
    if (!actual.has(findingId)) throw new Error(`missing finding id: ${findingId}`);
  }
  fingerprintReferenceFrom(artifact.previousFingerprint, "previousFingerprint");
  return artifact;
}

export function prepareImplTriageArtifact({ specDir, sourceStep, sourceArtifact, findings, fingerprint }) {
  const current = fingerprintFrom(fingerprint, "fingerprint");
  const sourceFindings = Array.isArray(findings) ? findings : [];
  if (sourceFindings.length === 0) throw new Error("impl-triage requires at least one source finding");
  const items = sourceFindings.map((finding, index) => {
    const findingId = requireString(finding.findingId || `F-${index + 1}`, "findingId");
    return new ImplTriageItem({
      findingId,
      sourceStep,
      decision: finding.decision || "apply",
      rationale: finding.suggestion || finding.summary || finding.issue || `Repair ${findingId}.`,
      evidenceRefs: [`${sourceArtifact}#${findingId}`],
    }).toJSON();
  });
  writeRepairFingerprintManifest(specDir, current);
  const artifact = {
    version: 2,
    phase: "impl-triage",
    sourceStep,
    sourceArtifact,
    previousFingerprint: current.toReference(),
    generatedAt: new Date().toISOString(),
    items,
  };
  validateImplTriageArtifact(artifact, { sourceFindingIds: items.map((item) => item.findingId) });
  const file = path.join(specDir, IMPL_TRIAGE_ARTIFACT_FILE);
  writeJson(file, artifact);
  return { path: file, artifact };
}

function sourceFindingIds(sourceStep, source) {
  if (sourceStep === "impl-review") {
    const blocking = (source.blockingFindings || []).map((finding, index) => finding.findingId || `F-${index + 1}`);
    const nonBlocking = (source.nonBlockingImprovements || []).map((finding, index) => finding.findingId || `I-${index + 1}`);
    return [...blocking, ...nonBlocking];
  }
  if (sourceStep === "acceptance-review") {
    return (source.requirementJudgments || [])
      .filter((judgment) => judgment.status === "notMet")
      .map((judgment) => `acceptance:${judgment.requirementId}`);
  }
  throw new Error(`unsupported impl-triage source step: ${sourceStep}`);
}

export function validateStoredImplTriageArtifact({ specDir }) {
  const triage = readJson(path.join(specDir, IMPL_TRIAGE_ARTIFACT_FILE));
  const source = readJson(path.join(specDir, requireString(triage.sourceArtifact, "sourceArtifact")));
  validateImplTriageArtifact(triage, { sourceFindingIds: sourceFindingIds(triage.sourceStep, source) });
  const previous = fingerprintReferenceFrom(triage.previousFingerprint, "previousFingerprint");
  const manifest = readRepairFingerprintManifest(specDir);
  if (previous.hash !== manifest.hash || previous.manifestRef !== REPAIR_FINGERPRINT_MANIFEST_FILE) {
    throw new Error("impl-triage previousFingerprint does not match the local repair manifest");
  }
  if (source.repairFingerprint !== previous.hash) {
    throw new Error("impl-triage previousFingerprint must match its source artifact");
  }
  return triage;
}

export function completeImplTriage({ specDir }) {
  const triage = validateStoredImplTriageArtifact({ specDir });
  if (triage.items.some((item) => item.decision === "apply")) {
    return { requiresRepair: true, artifact: triage };
  }
  return { requiresRepair: false, artifact: triage };
}

export function readRejectedImplReviewTriage(specDir) {
  const file = path.join(specDir, IMPL_TRIAGE_ARTIFACT_FILE);
  if (!fs.existsSync(file)) return null;
  const triage = readJson(file);
  if (!triage || typeof triage !== "object") {
    throw new Error("impl-triage artifact must be an object");
  }
  if (triage.version !== 2 || triage.phase !== "impl-triage") {
    throw new Error("impl-triage artifact header is invalid");
  }
  if (typeof triage.sourceStep !== "string" || triage.sourceStep.length === 0) {
    throw new Error("impl-triage sourceStep must be a non-empty string");
  }
  if (triage.sourceStep !== "impl-review") return null;
  const source = readJson(path.join(
    specDir,
    requireString(triage.sourceArtifact, "sourceArtifact"),
  ));
  validateImplTriageArtifact(triage, {
    sourceFindingIds: sourceFindingIds(triage.sourceStep, source),
  });
  const previous = fingerprintReferenceFrom(triage.previousFingerprint, "previousFingerprint");
  if (
    previous.manifestRef !== REPAIR_FINGERPRINT_MANIFEST_FILE
    || source.repairFingerprint !== previous.hash
  ) {
    throw new Error("impl-triage previousFingerprint must match its source artifact");
  }
  return triage.items.every((item) => item.decision === "reject") ? triage : null;
}

function evidencePreviousFingerprint(artifact, fallback) {
  return typeof artifact?.repairFingerprint === "string" && HASH_PATTERN.test(artifact.repairFingerprint)
    ? artifact.repairFingerprint
    : fallback.hash;
}

function invalidationFingerprint(value, field) {
  if (typeof value === "string") return { hash: requireHash(value, field) };
  return fingerprintFrom(value, field);
}

function planRepairInvalidation({ specDir, currentFingerprint, previousFingerprint, reason }) {
  const current = invalidationFingerprint(currentFingerprint, "currentFingerprint");
  const previous = invalidationFingerprint(previousFingerprint, "previousFingerprint");
  const invalidations = [];
  const planPath = (relPath, recordReason, priorHash) => {
    const full = path.join(specDir, relPath);
    if (!fs.existsSync(full)) return;
    invalidations.push(new InvalidatedArtifactRecord({
      path: relPath,
      reason: `${requireString(reason, "reason")} (${recordReason})`,
      previousFingerprint: priorHash,
    }));
  };
  for (const relPath of Object.values(EVIDENCE_FILE_BY_STEP)) {
    const full = path.join(specDir, relPath);
    if (!fs.existsSync(full)) continue;
    let artifact = null;
    try { artifact = readJson(full); } catch (_) { artifact = null; }
    if (artifact?.repairFingerprint === current.hash) continue;
    const priorHash = evidencePreviousFingerprint(artifact, previous);
    const recordReason = artifact?.repairFingerprint ? "repair_fingerprint_mismatch" : "missing_repair_fingerprint";
    planPath(relPath, recordReason, priorHash);
    for (const associated of ASSOCIATED_EVIDENCE_PATHS[relPath] || []) {
      planPath(associated, `associated_${recordReason}`, priorHash);
    }
  }
  return invalidations;
}

function applyRepairInvalidations(specDir, invalidations) {
  for (const input of invalidations) {
    const record = input instanceof InvalidatedArtifactRecord ? input : new InvalidatedArtifactRecord(input);
    fs.rmSync(path.join(specDir, record.path), { recursive: true, force: true });
  }
}

class StagedRepairArtifact {
  constructor({ specDir, stagingDir, record, index }) {
    const normalized = record instanceof InvalidatedArtifactRecord
      ? record
      : new InvalidatedArtifactRecord(record);
    this.sourcePath = path.join(specDir, normalized.path);
    this.stagedPath = path.join(stagingDir, String(index));
    Object.freeze(this);
  }

  stage() {
    if (!fs.existsSync(this.sourcePath)) return false;
    fs.renameSync(this.sourcePath, this.stagedPath);
    return true;
  }

  restore() {
    if (!fs.existsSync(this.stagedPath)) return;
    fs.mkdirSync(path.dirname(this.sourcePath), { recursive: true });
    fs.renameSync(this.stagedPath, this.sourcePath);
  }
}

class RepairInvalidationTransaction {
  constructor({ specDir, invalidations }) {
    this.stagingDir = fs.mkdtempSync(path.join(path.resolve(specDir), ".repair-invalidation-"));
    this.artifacts = Object.freeze(invalidations.map((record, index) => (
      new StagedRepairArtifact({
        specDir,
        stagingDir: this.stagingDir,
        record,
        index,
      })
    )));
    this.staged = [];
  }

  stage() {
    try {
      for (const artifact of this.artifacts) {
        if (artifact.stage()) this.staged.push(artifact);
      }
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  commit() {
    fs.rmSync(this.stagingDir, { recursive: true, force: true });
    this.staged = [];
  }

  rollback() {
    const errors = [];
    for (const artifact of [...this.staged].reverse()) {
      try {
        artifact.restore();
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      fs.rmSync(this.stagingDir, { recursive: true, force: true });
    } catch (error) {
      errors.push(error);
    }
    this.staged = [];
    if (errors.length > 0) {
      throw new AggregateError(errors, "repair invalidation rollback failed");
    }
  }
}

function restoreRepairMigrationState(flowManager, snapshot) {
  flowManager.mutate((next) => {
    for (const key of Object.keys(next)) delete next[key];
    Object.assign(next, structuredClone(snapshot));
  });
}

class RepairMigrationManifestReplacement {
  constructor({ specDir, currentManifest }) {
    this.file = path.join(specDir, REPAIR_FINGERPRINT_MANIFEST_FILE);
    this.currentManifest = currentManifest;
    this.previous = fs.existsSync(this.file) ? readJson(this.file) : null;
    this.replaced = false;
  }

  replace() {
    if (!this.currentManifest) return;
    writeRepairFingerprintManifest(path.dirname(this.file), this.currentManifest);
    this.replaced = true;
  }

  rollback() {
    if (!this.replaced) return;
    if (this.previous == null) {
      fs.rmSync(this.file, { force: true });
    } else {
      writeJson(this.file, this.previous);
    }
    this.replaced = false;
  }
}

export class RepairEvidenceInvalidationPlan {
  constructor({ specDir, currentFingerprint, previousFingerprint, reason }) {
    this.specDir = path.resolve(specDir);
    this.invalidations = Object.freeze(planRepairInvalidation({
      specDir: this.specDir,
      currentFingerprint,
      previousFingerprint,
      reason,
    }));
    Object.freeze(this);
  }

  get invalidatedArtifacts() {
    return this.invalidations.map((record) => record.path);
  }

  get invalidationRecords() {
    return this.invalidations.map((record) => record.toJSON());
  }

  apply() {
    applyRepairInvalidations(this.specDir, this.invalidations);
    return {
      invalidatedArtifacts: this.invalidatedArtifacts,
      invalidations: this.invalidationRecords,
    };
  }
}

export function planRepairEvidenceInvalidation(options) {
  return new RepairEvidenceInvalidationPlan(options);
}

export function invalidateRepairEvidence({ specDir, currentFingerprint, previousFingerprint, reason }) {
  return planRepairEvidenceInvalidation({
    specDir,
    currentFingerprint,
    previousFingerprint,
    reason,
  }).apply();
}

function planAdditionalRefreshInvalidations({
  specDir,
  relativePaths,
  currentFingerprint,
  previousFingerprint,
  reason,
  plannedPaths,
}) {
  return relativePaths.flatMap((relPath) => {
    if (plannedPaths.has(relPath)) return [];
    const file = path.join(specDir, relPath);
    if (!fs.existsSync(file)) return [];
    let artifact = null;
    try { artifact = readJson(file); } catch (_) { artifact = null; }
    return [new InvalidatedArtifactRecord({
      path: relPath,
      reason: `${requireString(reason, "reason")} (explicit_refresh_artifact)`,
      previousFingerprint: evidencePreviousFingerprint(artifact, previousFingerprint)
        || currentFingerprint.hash,
    })];
  });
}

class TestEvidenceRefreshTransitionAuthority extends ImplRepairPrecommitAuthority {
  constructor({ root, specDir, transaction }) {
    super();
    this.root = path.resolve(root);
    this.specDir = path.resolve(specDir);
    this.transaction = transaction instanceof ImplRepairTransaction
      ? transaction
      : new ImplRepairTransaction(transaction);
    Object.freeze(this);
  }

  assertTransition(state, transaction) {
    if (!this.transaction.equals(transaction)) {
      throw new Error("test evidence refresh transition transaction changed");
    }
    transaction.target.assertState(state);
    const observed = buildRepairFingerprint({
      root: this.root,
      specPath: transaction.target.spec,
      state,
    });
    if (observed.hash !== transaction.currentManifest.hash) {
      throw new Error("test evidence refresh material authority changed");
    }
    const journalPath = path.join(this.specDir, REPAIR_TRANSACTION_FILE);
    if (
      !fs.existsSync(journalPath)
      || !transaction.equals(readJson(journalPath))
    ) {
      throw new Error("test evidence refresh journal authority changed");
    }
  }

  assertEffects(state, transaction) {
    this.assertTransition(state, transaction);
  }
}

function testEvidenceRefreshTransition(state, transaction) {
  const changes = plannedRepairStepChanges(state, transaction.resetStepIds);
  if (changes.length === 0) {
    throw new Error("test evidence refresh produced no lifecycle changes");
  }
  return new ExplicitRecoveryTransition({
    stepId: changes[0].stepId,
    currentStatus: changes[0].currentStatus,
    requestedStatus: changes[0].requestedStatus,
    entrypoint: "impl-repair-invalidation",
    changes,
  });
}

class CommittedImplRepairEffects {
  constructor({ specDir, state, transaction }) {
    this.specDir = path.resolve(specDir);
    this.state = state;
    this.transaction = transaction instanceof ImplRepairTransaction
      ? transaction
      : new ImplRepairTransaction(transaction);
    Object.freeze(this);
  }

  reconcileJournal() {
    const deltaPath = path.join(this.specDir, this.transaction.entry.changedPathsRef);
    const deltaCurrent = fs.existsSync(deltaPath)
      && this.transaction.delta.digest === new RepairDeltaArtifact(readJson(deltaPath)).digest;
    const ledgerPath = path.join(this.specDir, IMPL_REPAIR_ARTIFACT_FILE);
    const ledgerCurrent = fs.existsSync(ledgerPath)
      && sameSerializedValue(readImplRepairLedger(this.specDir), this.transaction.ledger);
    const manifestPath = path.join(this.specDir, REPAIR_FINGERPRINT_MANIFEST_FILE);
    const manifestCurrent = fs.existsSync(manifestPath)
      && sameSerializedValue(
        readRepairFingerprintManifest(this.specDir),
        this.transaction.currentManifest,
      );
    const lifecycleCurrent = this.transaction.resetStepIds
      .filter((stepId) => stepId !== "impl-repair")
      .every((stepId) => {
        const step = findStepById(this.state.steps || [], stepId);
        return step?.status === (stepId === "test-execute" ? "in_progress" : "pending");
      })
      && (
        !(this.transaction.purpose instanceof TestEvidenceRefreshPurpose)
        || !Object.hasOwn(this.state, "acceptanceReview")
      );
    const invalidationsCurrent = this.transaction.invalidations.every(
      (record) => !fs.existsSync(path.join(this.specDir, record.path)),
    );
    const durableMarkers = [
      deltaCurrent,
      ledgerCurrent,
      manifestCurrent,
      lifecycleCurrent,
    ];
    if (durableMarkers.every(Boolean) && invalidationsCurrent) {
      fs.rmSync(path.join(this.specDir, REPAIR_TRANSACTION_FILE), { force: true });
      return {
        entry: this.transaction.entry.toJSON(),
        invalidations: this.transaction.entry.invalidations.map((record) => record.toJSON()),
      };
    }
    if (durableMarkers.some(Boolean)) {
      throw new Error("completed impl-repair effects are partially committed");
    }
    return null;
  }
}

function commitOwnedTestEvidenceRefresh({
  root,
  state,
  specDir,
  flowManager,
  transaction,
  faultInjector = null,
}) {
  if (!flowManager || typeof flowManager.updateStepStatus !== "function") {
    throw new Error("test evidence refresh requires the impl-repair lifecycle authority");
  }
  const journal = transaction instanceof ImplRepairTransaction
    ? transaction
    : new ImplRepairTransaction(transaction);
  journal.target.assertState(state);
  const transactionPath = path.join(specDir, REPAIR_TRANSACTION_FILE);
  if (fs.existsSync(transactionPath)) {
    if (!journal.equals(readJson(transactionPath))) {
      throw new Error("a different impl-repair transaction journal is pending");
    }
  } else {
    writeJson(transactionPath, journal.toJSON());
  }

  const pending = state.implRepairTransaction == null
    ? null
    : new ImplRepairTransaction(state.implRepairTransaction);
  if (pending && !journal.equals(pending)) {
    throw new Error("a different impl-repair transaction is already pending");
  }
  let committedState = state;
  if (!pending) {
    const authority = new TestEvidenceRefreshTransitionAuthority({
      root,
      specDir,
      transaction: journal,
    });
    flowManager.updateStepStatus(
      testEvidenceRefreshTransition(state, journal),
      {
        taskId: null,
        expectedOriginal: state,
      },
      new ImplRepairTransitionIntent(journal, authority),
    );
    committedState = typeof flowManager.loadReadOnly === "function"
      ? flowManager.loadReadOnly()
      : flowManager.load();
  }
  journal.target.assertState(committedState);
  if (
    committedState.implRepairTransaction == null
    || !journal.equals(committedState.implRepairTransaction)
  ) {
    throw new Error("owned test evidence refresh intent is not committed");
  }
  return commitOwnedImplRepairEffects({
    root,
    state: committedState,
    specDir,
    flowManager,
    transaction: journal,
    precommitAuthority: new TestEvidenceRefreshTransitionAuthority({
      root,
      specDir,
      transaction: journal,
    }),
    faultInjector,
  });
}

function resumeJournaledTestEvidenceRefresh({
  root,
  state,
  specDir,
  flowManager,
  expectedPreviousFingerprint,
  expectedCurrentFingerprint,
  faultInjector,
}) {
  const transaction = new ImplRepairTransaction(
    readJson(path.join(specDir, REPAIR_TRANSACTION_FILE)),
  );
  if (!(transaction.purpose instanceof TestEvidenceRefreshPurpose)) {
    throw new Error("pending repair transaction is not a test evidence refresh");
  }
  transaction.target.assertState(state);
  if (
    expectedPreviousFingerprint
    && transaction.entry.previousHash !== expectedPreviousFingerprint
  ) {
    throw new Error("pending test evidence refresh previous fingerprint changed");
  }
  if (
    expectedCurrentFingerprint
    && transaction.entry.currentHash !== expectedCurrentFingerprint
  ) {
    throw new Error("pending test evidence refresh current fingerprint changed");
  }
  const reconciled = state.implRepairTransaction == null
    ? new CommittedImplRepairEffects({
        specDir,
        state,
        transaction,
      }).reconcileJournal()
    : null;
  const resumed = reconciled || commitOwnedTestEvidenceRefresh({
    root,
    state,
    specDir,
    flowManager,
    transaction,
    faultInjector,
  });
  return {
    ...resumed,
    previousFingerprint: transaction.entry.previousHash,
    currentFingerprint: transaction.entry.currentHash,
    invalidatedArtifacts: resumed.invalidations.map((record) => record.path),
  };
}

export function completeTestEvidenceRefresh({
  root,
  state,
  specDir,
  flowManager,
  reason,
  sourceStep,
  resetStepIds = flowLeafIdsBetween("test-execute", "finalize-cleanup"),
  additionalArtifacts = [],
  expectedPreviousFingerprint = null,
  expectedCurrentFingerprint = null,
  faultInjector = null,
}) {
  const lock = new RepairRunLock(specDir);
  lock.acquire();
  try {
    const activeState = state || flowManager.load();
    const specParent = path.dirname(activeState.spec);
    const inferredRoot = path.resolve(
      specDir,
      ...specParent.split(/[\\/]/).filter((part) => part && part !== ".").map(() => ".."),
    );
    const executionRoot = root || inferredRoot;
    if (path.dirname(path.resolve(executionRoot, activeState.spec)) !== path.resolve(specDir)) {
      throw new Error("test evidence refresh spec directory does not match the active flow");
    }
    const transactionPath = path.join(specDir, REPAIR_TRANSACTION_FILE);
    if (fs.existsSync(transactionPath)) {
      return resumeJournaledTestEvidenceRefresh({
        root: executionRoot,
        state: activeState,
        specDir,
        flowManager,
        expectedPreviousFingerprint,
        expectedCurrentFingerprint,
        faultInjector,
      });
    }
    const manifestPath = path.join(specDir, REPAIR_FINGERPRINT_MANIFEST_FILE);
    if (!fs.existsSync(manifestPath)) {
      throw new Error("test evidence refresh requires a repair fingerprint manifest");
    }
    const previous = readRepairFingerprintManifest(specDir);
    if (
      expectedPreviousFingerprint
      && previous.hash !== expectedPreviousFingerprint
    ) {
      throw new Error("test evidence refresh previous fingerprint authority changed");
    }
    const current = buildRepairFingerprint({
      root: executionRoot,
      specPath: activeState.spec,
      state: activeState,
    });
    if (expectedCurrentFingerprint && current.hash !== expectedCurrentFingerprint) {
      throw new Error("test evidence refresh fingerprint changed before recovery");
    }
    const existing = readImplRepairLedger(specDir) || new ImplRepairLedger({ version: 2, entries: [] });
    const ledgerPreviousHash = existing.entries.at(-1)?.currentHash || previous.hash;
    if (ledgerPreviousHash === current.hash) {
      throw new Error("test evidence refresh requires a repair fingerprint change");
    }
    const changedPaths = ledgerPreviousHash === previous.hash
      ? changedRepairPaths(previous, current)
      : current.entries.map((entry) => entry.path);
    if (changedPaths.length === 0) {
      throw new Error("test evidence refresh changed paths must be non-empty");
    }
    const invalidations = planRepairInvalidation({
      specDir,
      currentFingerprint: current,
      previousFingerprint: previous,
      reason,
    });
    const plannedPaths = new Set(invalidations.map((record) => record.path));
    invalidations.push(...planAdditionalRefreshInvalidations({
      specDir,
      relativePaths: additionalArtifacts,
      currentFingerprint: current,
      previousFingerprint: previous,
      reason,
      plannedPaths,
    }));
    if (invalidations.length === 0) {
      throw new Error("test evidence refresh must invalidate at least one stale artifact");
    }
    const id = `repair-${String(existing.entries.length + 1).padStart(3, "0")}`;
    const delta = ledgerPreviousHash === previous.hash
      ? repairDeltaArtifact({ id, previous, current, changedPaths })
      : new RepairDeltaArtifact({
          version: 1,
          id,
          previousHash: ledgerPreviousHash,
          currentHash: current.hash,
          changedPaths,
        });
    const entry = new ImplRepairEntry({
      id,
      sourceFindingIds: [`test-evidence-refresh:${requireString(sourceStep, "sourceStep")}`],
      reason,
      previousHash: ledgerPreviousHash,
      currentHash: current.hash,
      changedPathCount: changedPaths.length,
      changedPathsRef: `${REPAIR_DELTA_DIR}/${id}.json`,
      changedPathsDigest: delta.digest,
      changedPathsPreview: changedPaths.slice(0, CHANGED_PATH_PREVIEW_LIMIT),
      changedPathGroups: changedPathGroups(changedPaths),
      invalidations,
      createdAt: new Date().toISOString(),
    });
    const transaction = new ImplRepairTransaction({
      version: 2,
      id,
      sourceStep,
      target: ImplRepairTargetIdentity.fromState(activeState),
      resetStepIds,
      entry,
      ledger: existing.append(entry),
      currentManifest: current,
      delta,
      purpose: new TestEvidenceRefreshPurpose(),
      invalidations,
    });
    const result = commitOwnedTestEvidenceRefresh({
      root: executionRoot,
      state: activeState,
      specDir,
      flowManager,
      transaction,
      faultInjector,
    });
    return {
      ...result,
      previousFingerprint: ledgerPreviousHash,
      currentFingerprint: current.hash,
      invalidatedArtifacts: result.invalidations.map((record) => record.path),
    };
  } finally {
    lock.release();
  }
}

export function completeLateAppliedFindingRepair({
  root,
  state,
  flowManager,
  specDir,
  sourceStep,
  sourceFindingIds,
  resetStepIds = flowLeafIdsBetween("test-execute", "finalize-cleanup"),
  specId = null,
}) {
  if (!flowManager || typeof flowManager.updateStepStatus !== "function") {
    throw new Error("late applied-finding repair requires the impl-repair lifecycle authority");
  }
  const activeState = state || flowManager.load();
  const resolvedSpecDir = path.resolve(specDir || path.dirname(path.resolve(root, activeState.spec)));
  const appliedFindingIds = requireStringArray(sourceFindingIds, "sourceFindingIds");
  const previous = readRepairFingerprintManifest(resolvedSpecDir);
  const current = buildRepairFingerprint({
    root,
    specPath: activeState.spec,
    state: activeState,
  });
  const existing = readImplRepairLedger(resolvedSpecDir) || new ImplRepairLedger({ version: 2, entries: [] });
  const ledgerPreviousHash = existing.entries.at(-1)?.currentHash || previous.hash;
  if (ledgerPreviousHash === current.hash) {
    throw new Error("late applied-finding repair requires a repair fingerprint change");
  }
  const changedPaths = ledgerPreviousHash === previous.hash
    ? changedRepairPaths(previous, current)
    : current.entries.map((entry) => entry.path);
  if (changedPaths.length === 0) {
    throw new Error("late applied-finding repair changed paths must be non-empty");
  }
  const reason = `Late repair evidence recorded for findings ${appliedFindingIds.join(", ")}.`;
  const invalidations = planRepairInvalidation({
    specDir: resolvedSpecDir,
    currentFingerprint: current,
    previousFingerprint: previous,
    reason,
  });
  if (invalidations.length === 0) {
    throw new Error("late applied-finding repair must invalidate stale test evidence");
  }
  const id = `repair-${String(existing.entries.length + 1).padStart(3, "0")}`;
  const delta = ledgerPreviousHash === previous.hash
    ? repairDeltaArtifact({ id, previous, current, changedPaths })
    : new RepairDeltaArtifact({
        version: 1,
        id,
        previousHash: ledgerPreviousHash,
        currentHash: current.hash,
        changedPaths,
      });
  const entry = new ImplRepairEntry({
    id,
    sourceFindingIds: appliedFindingIds,
    reason,
    previousHash: ledgerPreviousHash,
    currentHash: current.hash,
    changedPathCount: changedPaths.length,
    changedPathsRef: `${REPAIR_DELTA_DIR}/${id}.json`,
    changedPathsDigest: delta.digest,
    changedPathsPreview: changedPaths.slice(0, CHANGED_PATH_PREVIEW_LIMIT),
    changedPathGroups: changedPathGroups(changedPaths),
    invalidations,
    createdAt: new Date().toISOString(),
  });
  const transaction = new ImplRepairTransaction({
    version: 2,
    id,
    sourceStep: requireString(sourceStep, "sourceStep"),
    target: ImplRepairTargetIdentity.fromState(activeState),
    resetStepIds,
    entry,
    ledger: existing.append(entry),
    currentManifest: current,
    delta,
    invalidations,
  });
  const changes = plannedRepairStepChanges(activeState, transaction.resetStepIds);
  if (changes.length === 0) {
    throw new Error("late applied-finding repair requires downstream lifecycle invalidations");
  }
  flowManager.updateStepStatus(new ExplicitRecoveryTransition({
    stepId: changes[0].stepId,
    currentStatus: changes[0].currentStatus,
    requestedStatus: changes[0].requestedStatus,
    entrypoint: "impl-repair-invalidation",
    changes,
  }), {
    ...(specId == null ? {} : { specId }),
    taskId: null,
    expectedOriginal: activeState,
  }, new ImplRepairTransitionIntent(transaction));
  return commitImplRepairEffects({
    root,
    state: activeState,
    flowManager,
    transaction,
    specId,
  });
}

export function appendImplRepairEntry({ specDir, entry }) {
  const normalized = entry instanceof ImplRepairEntry ? entry : new ImplRepairEntry(entry);
  const file = path.join(specDir, IMPL_REPAIR_ARTIFACT_FILE);
  const ledger = fs.existsSync(file) ? readImplRepairLedger(specDir) : new ImplRepairLedger({ version: 2, entries: [] });
  const artifact = ledger.append(normalized).toJSON();
  writeJson(file, artifact);
  return { path: file, artifact };
}

function isDurableRepairEvidencePath(root, relativePath) {
  if (WORKFLOW_ARTIFACT_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) return false;
  const repositoryRoot = path.resolve(root);
  const candidate = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  try {
    const stat = fs.lstatSync(candidate);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw new Error(`failed to inspect repair evidence path: ${relativePath}`, { cause: error });
  }
}

function repairEvidenceFile({ root, specPath, entry }) {
  const specDir = path.dirname(path.resolve(root, specPath));
  const delta = new RepairDeltaArtifact(readJson(path.join(specDir, entry.changedPathsRef)));
  if (
    delta.id !== entry.id
    || delta.previousHash !== entry.previousHash
    || delta.currentHash !== entry.currentHash
    || delta.digest !== entry.changedPathsDigest
  ) {
    throw new Error(`repair evidence delta does not match entry ${entry.id}`);
  }
  const file = delta.changedPaths.find((candidate) => isDurableRepairEvidencePath(root, candidate));
  if (!file) {
    throw new Error(`repair evidence for ${entry.id} requires a materialized repository file`);
  }
  return file;
}

function recordAppliedFindingRepairEvidence({ root, specPath, sourceStep, entry }) {
  const repairFile = repairEvidenceFile({ root, specPath, entry });
  for (const findingId of entry.sourceFindingIds) {
    appendIssueLogEntry(root, specPath, {
      step: sourceStep,
      reason: entry.reason,
      trigger: "impl-repair completed for an applied review finding",
      resolution: `Repair evidence recorded by ${entry.id}; ${entry.changedPathCount} changed path(s), delta ${entry.changedPathsRef}.`,
      normalizedFindingId: findingId,
      repairRef: { files: [repairFile] },
      taskId: null,
      timestamp: entry.createdAt,
    }, `impl-repair:${entry.id}:${findingId}`);
  }
}

export function readImplRepairLedger(specDir) {
  const file = path.join(specDir, IMPL_REPAIR_ARTIFACT_FILE);
  if (!fs.existsSync(file)) return null;
  if (fs.statSync(file).size > IMPL_REPAIR_LEDGER_SIZE_LIMIT) {
    throw new Error(`${IMPL_REPAIR_ARTIFACT_FILE} exceeds ${IMPL_REPAIR_LEDGER_SIZE_LIMIT} bytes`);
  }
  return new ImplRepairLedger(readJson(file)).validateDeltaEvidence(specDir);
}

class RepairRunLock {
  constructor(specDir) {
    this.directory = path.join(specDir, REPAIR_LOCK_DIR);
    this.acquired = false;
  }

  acquire() {
    try {
      fs.mkdirSync(this.directory);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const ownerFile = path.join(this.directory, "owner.json");
      let owner = null;
      try { owner = readJson(ownerFile); } catch (_) { owner = null; }
      let live = false;
      if (Number.isSafeInteger(owner?.pid)) {
        try { process.kill(owner.pid, 0); live = true; } catch (probe) { live = probe.code === "EPERM"; }
      }
      if (live) throw new Error(`impl-repair is already running in process ${owner.pid}`);
      fs.rmSync(this.directory, { recursive: true, force: true });
      fs.mkdirSync(this.directory);
    }
    atomicWriteJson(path.join(this.directory, "owner.json"), {
      pid: process.pid,
      acquiredAt: new Date().toISOString(),
    });
    this.acquired = true;
  }

  release() {
    if (!this.acquired) return;
    fs.rmSync(this.directory, { recursive: true, force: true });
    this.acquired = false;
  }
}

function legacyMigrationInvalidations(specDir, {
  includeManifest = true,
  reason = "legacy repair fingerprint contract migrated to version 2",
} = {}) {
  const candidates = new Set([
    ...Object.values(EVIDENCE_FILE_BY_STEP),
    ...Object.values(ASSOCIATED_EVIDENCE_PATHS).flat(),
    IMPL_REPAIR_ARTIFACT_FILE,
    IMPL_TRIAGE_ARTIFACT_FILE,
    REPAIR_DELTA_DIR,
    "final-regression-result.json",
    "upgrade-result.json",
    "report.json",
  ]);
  if (includeManifest) candidates.add(REPAIR_FINGERPRINT_MANIFEST_FILE);
  const rawDir = path.join(specDir, "tests", ".raw");
  if (fs.existsSync(rawDir)) {
    for (const name of fs.readdirSync(rawDir)) {
      if (name.startsWith("final-regression-attempt-")) candidates.add(`tests/.raw/${name}`);
    }
  }
  const invalidations = [];
  for (const relPath of [...candidates].sort()) {
    const file = path.join(specDir, relPath);
    if (!fs.existsSync(file)) continue;
    let previousFingerprint = LEGACY_REPAIR_FINGERPRINT;
    if (fs.statSync(file).isFile() && file.endsWith(".json")) {
      try {
        const candidate = readJson(file)?.repairFingerprint;
        if (typeof candidate === "string" && HASH_PATTERN.test(candidate)) previousFingerprint = candidate;
      } catch (_) { /* malformed legacy evidence is invalidated with the legacy marker */ }
    }
    invalidations.push(new InvalidatedArtifactRecord({
      path: relPath,
      reason,
      previousFingerprint,
    }));
  }
  return invalidations;
}

function sameBaselineAuthority(left, right) {
  const first = left instanceof ImmutableGitBaseline ? left : new ImmutableGitBaseline(left);
  const second = right instanceof ImmutableGitBaseline ? right : new ImmutableGitBaseline(right);
  return first.kind === second.kind
    && first.objectFormat === second.objectFormat
    && first.commitOid === second.commitOid
    && first.treeOid === second.treeOid
    && first.ref === second.ref;
}

function assertMatchingMigrationBaseline(state, baseline) {
  if (!state.repairBaseline) return;
  if (!sameBaselineAuthority(state.repairBaseline, baseline)) {
    throw new Error("repair state migration baseline conflicts with active flow state");
  }
}

function applyRepairMigrationState(state, migration) {
  if (state.runId !== migration.runId || state.spec !== migration.specPath) {
    throw new Error("repair state migration authority no longer matches the active flow");
  }
  if (state.repairBaseline) {
    assertMatchingMigrationBaseline(state, migration.baseline);
  } else {
    state.repairBaseline = migration.baseline.toJSON();
  }
  for (const step of flattenSteps(state.steps || [])) {
    if (step.status !== "in_progress" || step.id === "test-execute" || (step.children || []).length > 0) continue;
    step.status = "done";
    step.finishedAt = migration.createdAt;
  }
  const reset = new Set(migration.resetStepIds);
  for (const stepId of migration.resetStepIds) {
    const step = findStepById(state.steps || [], stepId);
    if (!step) continue;
    step.status = stepId === "test-execute" ? "in_progress" : "pending";
    delete step.startedAt;
    delete step.finishedAt;
    if (stepId === "test-execute") step.startedAt = migration.createdAt;
  }
  if (!reset.has("test-execute")) throw new Error("repair state migration must reset test-execute");
  return state;
}

function hasAppliedRepairMigration(state, specDir, migration) {
  const testExecute = findStepById(state.steps || [], "test-execute");
  if (testExecute?.status !== "in_progress") return false;
  for (const stepId of migration.resetStepIds) {
    if (stepId === "test-execute") continue;
    const step = findStepById(state.steps || [], stepId);
    if (step && step.status !== "pending") return false;
  }
  return migration.invalidations.every((record) => (
    !fs.existsSync(path.join(specDir, record.path))
  ));
}

function commitRepairStateMigration({ root, state, flowManager, specDir, migration, currentManifest = null }) {
  const stateSnapshot = structuredClone(state);
  const invalidation = new RepairInvalidationTransaction({ specDir, invalidations: migration.invalidations });
  const manifest = new RepairMigrationManifestReplacement({ specDir, currentManifest });
  let stateMutationStarted = false;
  try {
    invalidation.stage();
    stateMutationStarted = true;
    flowManager.mutate((next) => applyRepairMigrationState(next, migration));
    manifest.replace();
    appendIssueLogEntry(root, migration.specPath, {
      step: "test-execute",
      reason: `legacy repair fingerprint evidence migrated from version ${migration.sourceVersion} to ${migration.targetVersion}`,
      trigger: "automatic fail-closed repair fingerprint migration",
      resolution: `Pinned ${migration.baseline.commitOid} and invalidated ${migration.invalidations.length} downstream artifact(s).`,
      normalizedFindingId: `repair-state-migration-v${migration.targetVersion}`,
      repairRef: { files: [migration.specPath] },
      taskId: null,
      timestamp: migration.createdAt,
    }, `repair-state-migration:${migration.runId}`);
    const migrationFile = path.join(specDir, REPAIR_MIGRATION_FILE);
    if (migration.retainRecord) {
      writeJson(migrationFile, migration.complete().toJSON());
    } else {
      fs.rmSync(migrationFile, { force: true });
    }
    invalidation.commit();
  } catch (error) {
    const rollbackErrors = [];
    try {
      manifest.rollback();
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    if (stateMutationStarted) {
      try {
        restoreRepairMigrationState(flowManager, stateSnapshot);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    try {
      invalidation.rollback();
    } catch (rollbackError) {
      rollbackErrors.push(rollbackError);
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError([error, ...rollbackErrors], "repair state migration rollback failed");
    }
    throw error;
  }
  const migratedState = structuredClone(state);
  return applyRepairMigrationState(migratedState, migration);
}

export function ensureRepairFingerprintContract({
  root,
  state,
  flowManager,
  continueAfterMigration = false,
}) {
  if (!state?.runId) return { state, migrated: false };
  const specDir = path.dirname(path.resolve(root, state.spec));
  const migrationFile = path.join(specDir, REPAIR_MIGRATION_FILE);
  const persisted = fs.existsSync(migrationFile)
    ? new RepairStateMigration(readJson(migrationFile))
    : null;
  const manifestFile = path.join(specDir, REPAIR_FINGERPRINT_MANIFEST_FILE);
  const migrationInput = fs.existsSync(manifestFile)
    ? readRepairFingerprintMigrationInput(specDir)
    : null;

  if (persisted?.recordPhase === "completed"
    && hasAppliedRepairMigration(state, specDir, persisted)) {
    if (state.repairBaseline) assertMatchingMigrationBaseline(state, persisted.baseline);
    return { state, migrated: false };
  }
  if (!migrationInput && persisted?.retainRecord) {
    throw new Error("repair fingerprint migration record requires its legacy or current manifest");
  }
  if (migrationInput instanceof RepairFingerprintManifest && !persisted) {
    if (state.repairBaseline) assertMatchingMigrationBaseline(state, migrationInput.baseline);
    return { state, migrated: false };
  }
  if (!migrationInput && state.repairBaseline && !persisted) {
    new ImmutableGitBaseline(state.repairBaseline);
    return { state, migrated: false };
  }
  if (!flowManager || typeof flowManager.mutate !== "function") {
    throw new Error("legacy repair fingerprint migration requires the active flow manager");
  }
  const lock = new RepairRunLock(specDir);
  lock.acquire();
  let migratedState;
  try {
    let migration = persisted;
    let currentManifest = null;
    if (migrationInput instanceof LegacyRepairFingerprintManifest) {
      if (state.repairBaseline) {
        assertMatchingMigrationBaseline(state, migrationInput.baseline);
        migration = migration || new RepairStateMigration({
          version: 2,
          runId: state.runId,
          specPath: state.spec,
          sourceVersion: LEGACY_REPAIR_STATE_VERSION,
          targetVersion: REPAIR_STATE_VERSION,
          baseline: state.repairBaseline,
          invalidations: legacyMigrationInvalidations(specDir, {
            includeManifest: false,
            reason: "repair fingerprint version 2 migrated to version 3",
          }),
          resetStepIds: flowLeafIdsBetween("test-execute", "finalize-cleanup"),
          retainRecord: true,
          createdAt: new Date().toISOString(),
        });
        currentManifest = migrationInput.toCurrentManifest();
      } else {
        const baseline = migration?.baseline || captureRepairBaseline({
          root,
          baseRef: state.baseBranch,
          runId: state.runId,
          useMergeBase: true,
        });
        migration = migration || new RepairStateMigration({
          version: 2,
          runId: state.runId,
          specPath: state.spec,
          sourceVersion: LEGACY_REPAIR_STATE_VERSION,
          targetVersion: REPAIR_STATE_VERSION,
          baseline,
          invalidations: legacyMigrationInvalidations(specDir),
          resetStepIds: flowLeafIdsBetween("test-execute", "finalize-cleanup"),
          retainRecord: false,
          createdAt: new Date().toISOString(),
        });
      }
    } else if (migrationInput instanceof RepairFingerprintManifest) {
      if (!migration) {
        if (state.repairBaseline) assertMatchingMigrationBaseline(state, migrationInput.baseline);
        return { state, migrated: false };
      }
      assertMatchingMigrationBaseline(state, migration.baseline);
      currentManifest = migrationInput;
    } else if (!migration) {
      const baseline = captureRepairBaseline({
        root,
        baseRef: state.baseBranch,
        runId: state.runId,
        useMergeBase: true,
      });
      migration = new RepairStateMigration({
        version: 2,
        runId: state.runId,
        specPath: state.spec,
        sourceVersion: LEGACY_REPAIR_STATE_VERSION,
        targetVersion: REPAIR_STATE_VERSION,
        baseline,
        invalidations: legacyMigrationInvalidations(specDir),
        resetStepIds: flowLeafIdsBetween("test-execute", "finalize-cleanup"),
        retainRecord: false,
        createdAt: new Date().toISOString(),
      });
    }
    if (!migration) throw new Error("repair fingerprint migration is missing a validated migration input");
    if (!fs.existsSync(migrationFile)) {
      writeJson(migrationFile, migration.toJSON());
    }
    migratedState = commitRepairStateMigration({
      root,
      state,
      flowManager,
      specDir,
      migration,
      currentManifest,
    });
  } finally {
    lock.release();
  }
  if (!continueAfterMigration) throw new RepairStateMigratedError();
  return { state: migratedState, migrated: true };
}

function updateRepairSteps(
  flowManager,
  resetStepIds,
  { clearAcceptanceReview = false } = {},
) {
  flowManager.mutate((next) => {
    const repairStep = findStepById(next.steps || [], "impl-repair");
    if (repairStep) {
      repairStep.status = "done";
      repairStep.finishedAt = new Date().toISOString();
    }
    for (const stepId of resetStepIds) {
      const step = findStepById(next.steps || [], stepId);
      if (!step) continue;
      step.status = stepId === "test-execute" ? "in_progress" : "pending";
      delete step.startedAt;
      delete step.finishedAt;
      if (stepId === "test-execute") step.startedAt = new Date().toISOString();
    }
    if (clearAcceptanceReview) delete next.acceptanceReview;
  });
}

function commitRepairTransaction({
  root,
  state,
  specDir,
  flowManager,
  transaction,
  faultInjector = null,
  commitFlowState = true,
  removeJournal = true,
}) {
  const journal = transaction instanceof ImplRepairTransaction ? transaction : new ImplRepairTransaction(transaction);
  journal.target.assertState(state);
  const { entry, ledger, currentManifest: manifest } = journal;
  const observed = buildRepairFingerprint({ root, specPath: state.spec, state });
  if (observed.hash !== manifest.hash) {
    throw new Error("impl-repair transaction current state changed before recovery");
  }
  const invalidationTransaction = new RepairInvalidationTransaction({
    specDir,
    invalidations: journal.invalidations,
  });
  invalidationTransaction.stage();
  try {
    const deltaRef = writeRepairDelta(specDir, journal.delta);
    if (deltaRef !== entry.changedPathsRef) throw new Error("impl-repair delta reference changed during transaction");
    faultInjector?.({ phase: "after-delta" });
    writeJson(path.join(specDir, IMPL_REPAIR_ARTIFACT_FILE), ledger.toJSON());
    faultInjector?.({ phase: "after-ledger" });
    writeRepairFingerprintManifest(specDir, manifest);
    faultInjector?.({ phase: "after-manifest" });
    faultInjector?.({ phase: "after-invalidation" });
    journal.purpose.recordEvidence({
      root,
      specPath: state.spec,
      sourceStep: journal.sourceStep,
      entry,
    });
    if (commitFlowState) {
      updateRepairSteps(flowManager, journal.resetStepIds, {
        clearAcceptanceReview: journal.purpose instanceof TestEvidenceRefreshPurpose,
      });
    }
    faultInjector?.({ phase: "after-flow-state" });
    invalidationTransaction.commit();
    if (removeJournal) {
      fs.rmSync(path.join(specDir, REPAIR_TRANSACTION_FILE), { force: true });
    }
    return { entry: entry.toJSON(), invalidations: entry.invalidations.map((record) => record.toJSON()) };
  } catch (error) {
    try {
      invalidationTransaction.rollback();
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        `repair transaction failed and rollback also failed: ${error.message}`,
      );
    }
    throw error;
  }
}

function prepareImplRepairTransaction({ root, state, specDir, resetStepIds }) {
  const triagePath = path.join(specDir, IMPL_TRIAGE_ARTIFACT_FILE);
  if (!fs.existsSync(triagePath)) throw new Error(`${IMPL_TRIAGE_ARTIFACT_FILE} is required`);
  const triage = validateStoredImplTriageArtifact({ specDir });
  const appliedFindingIds = triage.items.filter((item) => item.decision === "apply").map((item) => item.findingId);
  if (appliedFindingIds.length === 0) throw new Error("impl-repair requires at least one apply disposition");
  const previousFingerprint = readRepairFingerprintManifest(specDir);
  const currentFingerprint = buildRepairFingerprint({ root, specPath: state.spec, state });
  if (currentFingerprint.hash === previousFingerprint.hash) throw new Error("impl-repair fingerprint did not change");
  const changedPaths = changedRepairPaths(previousFingerprint, currentFingerprint);
  if (changedPaths.length === 0) throw new Error("impl-repair changed paths must be non-empty");
  const reason = `Repair applied for findings ${appliedFindingIds.join(", ")}.`;
  const invalidations = planRepairInvalidation({
    specDir,
    currentFingerprint,
    previousFingerprint,
    reason,
  });
  if (invalidations.length === 0) throw new Error("impl-repair must invalidate at least one stale artifact");
  const existing = readImplRepairLedger(specDir) || new ImplRepairLedger({ version: 2, entries: [] });
  const id = `repair-${String(existing.entries.length + 1).padStart(3, "0")}`;
  const delta = repairDeltaArtifact({ id, previous: previousFingerprint, current: currentFingerprint, changedPaths });
  const changedPathsRef = `${REPAIR_DELTA_DIR}/${id}.json`;
  const entry = new ImplRepairEntry({
    id,
    sourceFindingIds: appliedFindingIds,
    reason,
    previousHash: previousFingerprint.hash,
    currentHash: currentFingerprint.hash,
    changedPathCount: changedPaths.length,
    changedPathsRef,
    changedPathsDigest: delta.digest,
    changedPathsPreview: changedPaths.slice(0, CHANGED_PATH_PREVIEW_LIMIT),
    changedPathGroups: changedPathGroups(changedPaths),
    invalidations,
    createdAt: new Date().toISOString(),
  });
  return new ImplRepairTransaction({
    version: 2,
    id,
    sourceStep: triage.sourceStep,
    target: ImplRepairTargetIdentity.fromState(state),
    resetStepIds: [...resetStepIds],
    entry: entry.toJSON(),
    ledger: existing.append(entry).toJSON(),
    currentManifest: currentFingerprint.toJSON(),
    delta: delta.toJSON(),
    invalidations: invalidations.map((record) => record.toJSON()),
  });
}

function plannedRepairStepChanges(state, resetStepIds) {
  return resetStepIds.filter((stepId) => stepId !== "impl-repair").flatMap((stepId) => {
    const step = findStepById(state.steps || [], stepId);
    return step ? [{
      stepId,
      currentStatus: step.status,
      requestedStatus: stepId === "test-execute" ? "in_progress" : "pending",
    }] : [];
  });
}

function clearImplRepairTransitionIntent({ flowManager, transaction, specId = null }) {
  if (!flowManager) return false;
  const load = typeof flowManager.loadReadOnly === "function"
    ? flowManager.loadReadOnly.bind(flowManager)
    : typeof flowManager.load === "function"
      ? flowManager.load.bind(flowManager)
      : null;
  const current = load ? load(specId ?? undefined) : null;
  if (current?.implRepairTransaction == null) return false;
  const expected = transaction instanceof ImplRepairTransaction
    ? transaction
    : new ImplRepairTransaction(transaction);
  const stored = new ImplRepairTransaction(current.implRepairTransaction);
  if (!expected.equals(stored)) {
    throw new Error("pending impl-repair transition intent does not match completed effects");
  }
  if (typeof flowManager.completeStepTransitionIntent !== "function") {
    throw new Error("flow manager cannot complete an impl-repair transition intent");
  }
  flowManager.completeStepTransitionIntent(
    new ImplRepairTransitionIntent(expected),
    {
      expectedOriginal: current,
      ...(specId == null ? {} : { specId }),
    },
  );
  return true;
}

function commitOwnedImplRepairEffects({
  root,
  state,
  flowManager = null,
  transaction,
  specDir,
  specId = null,
  precommitAuthority = null,
  faultInjector = null,
}) {
  const journal = transaction instanceof ImplRepairTransaction
    ? transaction
    : new ImplRepairTransaction(transaction);
  if (
    precommitAuthority != null
    && !(precommitAuthority instanceof ImplRepairPrecommitAuthority)
  ) {
    throw new Error("impl-repair effects precommit authority is invalid");
  }
  if (precommitAuthority) {
    const load = typeof flowManager?.loadReadOnly === "function"
      ? flowManager.loadReadOnly.bind(flowManager)
      : typeof flowManager?.load === "function"
        ? flowManager.load.bind(flowManager)
        : null;
    const committedState = load ? load(specId ?? undefined) : state;
    precommitAuthority.assertEffects(committedState, journal);
  }
  writeJson(path.join(specDir, REPAIR_TRANSACTION_FILE), journal.toJSON());
  const result = commitRepairTransaction({
    root,
    state,
    specDir,
    flowManager: null,
    transaction: journal,
    faultInjector,
    commitFlowState: false,
    removeJournal: false,
  });
  clearImplRepairTransitionIntent({ flowManager, transaction: journal, specId });
  faultInjector?.({ phase: "after-intent-completion" });
  fs.rmSync(path.join(specDir, REPAIR_TRANSACTION_FILE), { force: true });
  return result;
}

export function commitImplRepairEffects({
  root,
  state,
  flowManager = null,
  transaction,
  specId = null,
  precommitAuthority = null,
}) {
  const specDir = path.dirname(path.resolve(root, state.spec));
  const lock = new RepairRunLock(specDir);
  lock.acquire();
  try {
    return commitOwnedImplRepairEffects({
      root,
      state,
      flowManager,
      transaction,
      specDir,
      specId,
      precommitAuthority,
    });
  } finally {
    lock.release();
  }
}

export function completeImplRepair({ root, state, flowManager = null, resetStepIds, faultInjector = null }) {
  const specDir = path.dirname(path.resolve(root, state.spec));
  const lock = new RepairRunLock(specDir);
  lock.acquire();
  try {
    const transactionFile = path.join(specDir, REPAIR_TRANSACTION_FILE);
    if (fs.existsSync(transactionFile)) {
      if (!flowManager) throw new Error("pending impl-repair transaction requires recovery before a new transition");
      return commitRepairTransaction({ root, state, specDir, flowManager, transaction: readJson(transactionFile), faultInjector });
    }
    const transaction = prepareImplRepairTransaction({ root, state, specDir, resetStepIds });
    if (!flowManager) {
      return {
        entry: transaction.entry.toJSON(),
        invalidations: transaction.invalidations.map((record) => record.toJSON()),
        stepChanges: plannedRepairStepChanges(state, transaction.resetStepIds),
        transaction: transaction.toJSON(),
      };
    }
    writeJson(transactionFile, transaction.toJSON());
    return commitRepairTransaction({ root, state, specDir, flowManager, transaction, faultInjector });
  } finally {
    lock.release();
  }
}

export function recoverImplRepairTransaction({ root, state, flowManager }) {
  const specDir = path.dirname(path.resolve(root, state.spec));
  if (state.implRepairTransaction != null) {
    return commitImplRepairEffects({
      root,
      state,
      flowManager,
      transaction: state.implRepairTransaction,
    });
  }
  if (!fs.existsSync(path.join(specDir, REPAIR_TRANSACTION_FILE))) return null;
  return completeImplRepair({ root, state, flowManager, resetStepIds: [] });
}
