import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema } from "../../lib/schema-validate.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { FlowTargetExpectation } from "../../lib/flow-target-guard.js";
import { flowLeafIdsBetween } from "../definition.js";
import { findStepById } from "./step-tree.js";
import { appendIssueLogEntry } from "./set-issue-log.js";
import {
  ACCEPTANCE_FINAL_DISPOSITIONS,
  findSourceFinding,
  MAX_SOURCE_ARTIFACT_READ_BYTES,
  mirrorFinalDispositions,
  readBoundedSourceArtifact,
  readFlowFindingsArtifact,
  validateFinalDisposition,
} from "./flow-findings.js";
import {
  buildReviewHandoffFindings,
  ReviewDisposition,
  ReviewEvidence,
} from "./review-convergence.js";
import {
  assertRepairFingerprint,
  buildRepairFingerprint,
  ensureRepairFingerprintContract,
  prepareImplTriageArtifact,
  readImplRepairLedger,
  readRejectedImplReviewTriage,
  writeRepairEvidenceArtifact,
} from "./impl-repair-artifacts.js";
import { StaleTestEvidenceRefresh } from "./stale-test-evidence-refresh.js";
import {
  validateScenarioValidityResult,
  validateTestExecuteResultV2,
  validateTestResultReview,
} from "./test-artifacts.js";

export const ACCEPTANCE_REVIEW_ARTIFACT_FILE = "acceptance-review.json";

const SCHEMA_PATH = fileURLToPath(new URL("../schemas/acceptance-review.schema.json", import.meta.url));
const JUDGMENT_STATUSES = new Set(["met", "notMet", "notVerifiable"]);
const VERDICTS = new Set(["pass", "repair_required", "user_decision_required", "blocked"]);
const USER_DECISION_CHOICES = new Set(["accept_risk_and_continue", "abort"]);
const REQUIRED_MECHANICAL_ARTIFACTS = Object.freeze([
  "scenario-validity-result.json",
  "test-execute-result.json",
  "test-result-review.json",
  "impl-review.json",
  "impl-gate-result.json",
  "retro.json",
]);
const FINGERPRINTED_INPUT_ARTIFACTS = Object.freeze(REQUIRED_MECHANICAL_ARTIFACTS.slice(1));
const MAX_ACCEPTANCE_RAW_EVIDENCE_BYTES = 20 * 1024 * 1024;
const REPAIR_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function requireNullableIssue(value, field) {
  if (value == null) return null;
  const issue = Number(value);
  if (!Number.isSafeInteger(issue) || issue < 1) throw new Error(`${field} must be a positive integer or null`);
  return issue;
}

function requireStringArray(value, field, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${field} must be ${allowEmpty ? "an" : "a non-empty"} array`);
  }
  return value.map((entry, index) => requireString(entry, `${field}[${index}]`));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function acceptanceDecisionRegistryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

class AcceptanceDecisionRegistryEntry {
  constructor(input = {}) {
    this.runId = requireString(input.runId, "active-flow entry.runId");
    this.issue = requireNullableIssue(input.issue, "active-flow entry.issue");
    this.spec = requireString(input.spec, "active-flow entry.spec");
    this.mode = requireString(input.mode, "active-flow entry.mode");
    Object.freeze(this);
  }

  get key() {
    return `${this.runId}\u0000${this.issue ?? "none"}\u0000${this.spec}\u0000${this.mode}`;
  }

  toJSON() {
    return {
      runId: this.runId,
      issue: this.issue,
      spec: this.spec,
      mode: this.mode,
    };
  }
}

class AcceptanceDecisionTargetIdentity {
  constructor(state) {
    this.runId = requireString(state?.runId, "active flow runId");
    this.issue = requireNullableIssue(state?.issue, "active flow issue");
    this.spec = requireString(state?.spec, "active flow spec");
    this.expectation = new FlowTargetExpectation({
      expectRunId: this.runId,
      ...(this.issue === null ? { expectNoIssue: true } : { expectIssue: this.issue }),
      expectSpec: this.spec,
    });
    this.specId = this.expectation.spec;
    Object.freeze(this);
  }

  resolve(flowManager) {
    if (typeof flowManager.resolveExplicitFlowTargetForRead !== "function") {
      throw acceptanceDecisionRegistryError(
        "ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH",
        "managed-worktree acceptance decision requires guarded flow resolution",
      );
    }
    const resolved = flowManager.resolveExplicitFlowTargetForRead(this.expectation);
    if (
      resolved?.specId !== this.specId
      || resolved.state?.runId !== this.runId
      || requireNullableIssue(resolved.state?.issue, "resolved flow issue") !== this.issue
    ) {
      throw acceptanceDecisionRegistryError(
        "ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH",
        "guarded flow resolution changed during acceptance decision",
      );
    }
    return resolved;
  }

  captureMutation(flowManager) {
    if (typeof flowManager.captureExactTarget !== "function") {
      throw acceptanceDecisionRegistryError(
        "ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH",
        "managed-worktree acceptance decision requires exact target capture",
      );
    }
    return flowManager.captureExactTarget(this.expectation);
  }

  toJSON() {
    return { spec: this.specId, runId: this.runId, issue: this.issue, mode: "worktree" };
  }
}

class AcceptanceDecisionRegistrySnapshot {
  constructor({ target, targetMutation, registrySnapshot }) {
    if (!(target instanceof AcceptanceDecisionTargetIdentity)) {
      throw new Error("acceptance registry snapshot requires a target identity");
    }
    if (targetMutation == null || typeof targetMutation.mutate !== "function") {
      throw new Error("acceptance registry snapshot requires a captured target mutation");
    }
    if (!registrySnapshot || !Array.isArray(registrySnapshot.entries)) {
      throw new Error("acceptance registry snapshot requires locked registry entries");
    }
    this.target = target;
    this.targetMutation = targetMutation;
    this.entries = Object.freeze(registrySnapshot.entries.map((entry) => new AcceptanceDecisionRegistryEntry(entry)));
    this.entryKeys = Object.freeze(this.entries.map((entry) => entry.key).sort());
    this.revision = registrySnapshot.revision;
    const targetEntry = new AcceptanceDecisionRegistryEntry(target.toJSON());
    if (!this.entries.some((entry) => entry.key === targetEntry.key)) {
      throw acceptanceDecisionRegistryError(
        "ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH",
        "managed-worktree acceptance decision target is absent from the active-flow registry",
      );
    }
    Object.freeze(this);
  }

  static capture(flowManager, state) {
    const target = new AcceptanceDecisionTargetIdentity(state);
    const targetMutation = target.captureMutation(flowManager);
    if (typeof flowManager.snapshotActiveFlowIdentities !== "function") {
      throw acceptanceDecisionRegistryError(
        "ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH",
        "managed-worktree acceptance decision requires locked active-flow identity access",
      );
    }
    return new AcceptanceDecisionRegistrySnapshot({
      target,
      targetMutation,
      registrySnapshot: flowManager.snapshotActiveFlowIdentities(),
    });
  }

  verify(flowManager) {
    this.target.resolve(flowManager);
    const registrySnapshot = flowManager.snapshotActiveFlowIdentities();
    if (registrySnapshot.revision !== this.revision) {
      throw acceptanceDecisionRegistryError(
        "ACTIVE_FLOW_REGISTRY_REVISION_CONFLICT",
        "active-flow registry revision changed during acceptance decision",
      );
    }
    const entries = registrySnapshot.entries.map((entry) => new AcceptanceDecisionRegistryEntry(entry));
    const entryKeys = entries.map((entry) => entry.key).sort();
    if (
      entryKeys.length !== this.entryKeys.length
      || entryKeys.some((key, index) => key !== this.entryKeys[index])
    ) {
      throw acceptanceDecisionRegistryError(
        "ACTIVE_FLOW_REGISTRY_IDENTITY_MISMATCH",
        "active-flow registry entries changed during acceptance decision",
      );
    }
    return {
      target: this.target.toJSON(),
      entries: entries.map((entry) => entry.toJSON()),
      prohibitedOperations: [],
    };
  }
}

class AcceptanceDecisionIssueLogSnapshot {
  constructor({ file, bytes, mode }) {
    if ((bytes == null) !== (mode == null)) {
      throw new Error("acceptance decision issue-log snapshot requires matching bytes and mode");
    }
    if (mode != null && (!Number.isSafeInteger(mode) || mode < 0 || mode > 0o777)) {
      throw new Error("acceptance decision issue-log snapshot mode is invalid");
    }
    this.file = requireString(file, "acceptance decision issue-log path");
    this.bytes = bytes == null ? null : Buffer.from(bytes);
    this.mode = mode;
    Object.freeze(this);
  }

  static capture(specDir) {
    const file = path.join(specDir, "issue-log.json");
    if (!fs.existsSync(file)) return new AcceptanceDecisionIssueLogSnapshot({ file, bytes: null, mode: null });
    const stat = fs.statSync(file);
    return new AcceptanceDecisionIssueLogSnapshot({
      file,
      bytes: fs.readFileSync(file),
      mode: stat.mode & 0o777,
    });
  }

  restore() {
    if (this.bytes == null) {
      fs.rmSync(this.file, { force: true });
      return;
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, this.bytes);
    fs.chmodSync(this.file, this.mode);
  }
}

function replaceState(current, previous) {
  for (const key of Object.keys(current)) delete current[key];
  Object.assign(current, clone(previous));
}

function acceptanceSchema() {
  return readJson(SCHEMA_PATH);
}

function requireFinalDisposition(value, field = "finalDisposition") {
  const disposition = validateFinalDisposition(value, field);
  if (disposition === null) {
    throw new Error(`${field} must be one of ${ACCEPTANCE_FINAL_DISPOSITIONS.join(", ")}`);
  }
  return disposition;
}

export class RequirementAcceptanceJudgment {
  constructor(input = {}) {
    this.requirementId = requireString(input.requirementId, "requirementId");
    this.status = requireString(input.status, "status");
    if (!JUDGMENT_STATUSES.has(this.status)) throw new Error(`invalid acceptance judgment status: ${this.status}`);
    this.requestRefs = Object.freeze(requireStringArray(input.requestRefs, "requestRefs"));
    this.requirementRefs = Object.freeze(requireStringArray(input.requirementRefs, "requirementRefs"));
    const evidenceMayBeMissing = this.status === "notVerifiable";
    this.diffRefs = Object.freeze(requireStringArray(input.diffRefs || [], "diffRefs", { allowEmpty: evidenceMayBeMissing }));
    this.repairRefs = Object.freeze(requireStringArray(input.repairRefs, "repairRefs"));
    this.testRefs = Object.freeze(requireStringArray(input.testRefs || [], "testRefs", { allowEmpty: evidenceMayBeMissing }));
    this.missingEvidence = Object.freeze(requireStringArray(input.missingEvidence || [], "missingEvidence", {
      allowEmpty: !evidenceMayBeMissing,
    }));
    if (evidenceMayBeMissing && this.missingEvidence.length === 0) {
      throw new Error("missingEvidence must be non-empty for notVerifiable");
    }
    if (!evidenceMayBeMissing && this.missingEvidence.length > 0) {
      throw new Error(`missingEvidence must be empty for ${this.status}`);
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      requirementId: this.requirementId,
      status: this.status,
      requestRefs: [...this.requestRefs],
      requirementRefs: [...this.requirementRefs],
      diffRefs: [...this.diffRefs],
      repairRefs: [...this.repairRefs],
      testRefs: [...this.testRefs],
      missingEvidence: [...this.missingEvidence],
    };
  }
}

export class MechanicalBlocker {
  constructor(input = {}) {
    this.blockerId = requireString(input.blockerId, "blockerId");
    this.kind = requireString(input.kind, "kind");
    this.summary = requireString(input.summary, "summary");
    Object.freeze(this);
  }

  toJSON() {
    return { blockerId: this.blockerId, kind: this.kind, summary: this.summary };
  }
}

export class AcceptanceEvidenceRefresh {
  constructor({ fingerprint, artifacts, blockers, deferredFindings, fingerprintExemptArtifacts = [] }) {
    this.currentFingerprint = fingerprint.hash;
    this.fingerprintExemptArtifacts = Object.freeze(requireStringArray(
      fingerprintExemptArtifacts,
      "fingerprintExemptArtifacts",
      { allowEmpty: true },
    ));
    this.staleArtifacts = Object.freeze(FINGERPRINTED_INPUT_ARTIFACTS
      .filter((file) => {
        if (this.fingerprintExemptArtifacts.includes(file)) return false;
        const previous = artifacts[file]?.repairFingerprint;
        return typeof previous === "string"
          && REPAIR_FINGERPRINT_PATTERN.test(previous)
          && previous !== this.currentFingerprint;
      }));
    this.previousFingerprint = this.staleArtifacts.length > 0
      ? artifacts[this.staleArtifacts[0]].repairFingerprint
      : null;
    this.required = blockers.length > 0
      && this.staleArtifacts.length > 0
      && blockers.every((blocker) => this.supports(blocker, deferredFindings));
    Object.freeze(this);
  }

  supports(blocker, deferredFindings) {
    if (blocker.kind === "invalid_schema") {
      if (blocker.summary === "Required artifact is invalid: impl-repair.json.") {
        return this.staleArtifacts.length > 0;
      }
      return this.staleArtifacts.some((file) => (
        blocker.summary === `Required artifact is invalid: ${file}.`
      ));
    }
    if (blocker.kind !== "missing_deferred_source") return false;
    return deferredFindings.some((finding) => (
      this.staleArtifacts.includes(finding.sourceArtifact)
      && blocker.summary === `Deferred source evidence is missing: ${finding.sourceArtifact}#${finding.sourceFindingId}.`
    ));
  }

  recover({ specDir, flowManager, acceptancePath }) {
    if (!this.required) return null;
    return new StaleTestEvidenceRefresh({
      previousFingerprint: this.previousFingerprint,
      currentFingerprint: this.currentFingerprint,
    }).recover({
      specDir,
      flowManager,
      reason: "acceptance review detected stale fingerprint evidence",
      additionalArtifacts: [path.basename(acceptancePath)],
    });
  }
}

export class AcceptanceTestEvidenceProjection {
  constructor(artifacts = {}) {
    const project = (file, fields) => {
      const source = artifacts[file];
      if (!source) return null;
      return Object.fromEntries(fields.filter((field) => Object.hasOwn(source, field)).map((field) => [field, clone(source[field])]));
    };
    this.artifacts = Object.freeze(Object.fromEntries([
      ["scenario-validity-result.json", project("scenario-validity-result.json", ["version", "command", "process", "result", "summary"])],
      ["test-execute-result.json", project("test-execute-result.json", ["version", "summary", "regression", "repairFingerprint"])],
      ["test-result-review.json", project("test-result-review.json", ["verdict", "checked_items", "result_file_path", "raw_output_path", "repairFingerprint"])],
      ["impl-review.json", project("impl-review.json", ["version", "phase", "verdict", "summary", "blockingFindings", "nonBlockingImprovements", "repairFingerprint"])],
      ["impl-gate-result.json", project("impl-gate-result.json", ["verdict", "phase", "issues", "evaluations", "observations", "repairFingerprint"])],
      ["retro.json", project("retro.json", ["mode", "date", "summary", "requirements", "repairFingerprint"])],
    ].filter(([, value]) => value !== null)));
    Object.freeze(this);
  }

  toJSON() {
    return clone(this.artifacts);
  }
}

export class DeferredAcceptanceFinding {
  constructor(input = {}) {
    this.findingId = requireString(input.findingId, "findingId");
    this.sourceStep = requireString(input.sourceStep, "sourceStep");
    this.sourceArtifact = requireString(input.sourceArtifact, "sourceArtifact");
    this.sourceFindingId = requireString(input.sourceFindingId, "sourceFindingId");
    this.finalDisposition = requireFinalDisposition(input.finalDisposition);
    this.evidenceRefs = Object.freeze(requireStringArray(input.evidenceRefs || [], "evidenceRefs", { allowEmpty: true }));
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      sourceStep: this.sourceStep,
      sourceArtifact: this.sourceArtifact,
      sourceFindingId: this.sourceFindingId,
      finalDisposition: this.finalDisposition,
      evidenceRefs: [...this.evidenceRefs],
    };
  }
}

export class DeferredFindingBlocker {
  constructor(finding) {
    const normalized = finding instanceof DeferredAcceptanceFinding
      ? finding
      : new DeferredAcceptanceFinding(finding);
    this.findingId = normalized.findingId;
    this.kind = normalized.finalDisposition === "blocking"
      ? "blocking_deferred_finding"
      : "unresolved_deferred_finding";
    this.summary = normalized.finalDisposition === "blocking"
      ? `Deferred finding remains blocking: ${normalized.findingId}.`
      : `Deferred finding remains unresolved: ${normalized.findingId}.`;
    Object.freeze(this);
  }

  toJSON() {
    return { findingId: this.findingId, kind: this.kind, summary: this.summary };
  }
}

export class DeferredFindingEvidenceProjection {
  constructor({ finding, sourceFinding }) {
    const normalized = finding instanceof DeferredAcceptanceFinding
      ? finding
      : new DeferredAcceptanceFinding(finding);
    if (!sourceFinding || typeof sourceFinding !== "object" || Array.isArray(sourceFinding)) {
      throw new Error("deferred source finding must be an object");
    }
    this.findingId = normalized.findingId;
    this.sourceRef = `${normalized.sourceArtifact}#${normalized.sourceFindingId}`;
    this.sourceFinding = Object.freeze(clone(sourceFinding));
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      sourceRef: this.sourceRef,
      sourceFinding: clone(this.sourceFinding),
    };
  }
}

function canonicalEvidenceIdentityMatches(identity, evidence) {
  return identity
    && identity.phase === evidence.phase
    && (identity.taskId ?? null) === evidence.taskId
    && identity.treeSha === evidence.treeSha
    && identity.evidenceDigest === evidence.identity.evidenceDigest
    && ["provider", "invocationId", "capturedAt"].every((field) => (
      identity.provenance?.[field] === evidence.provenance[field]
    ));
}

function readCanonicalReviewEvidence({ specDir, sourceArtifact }) {
  const normalizedSourceArtifact = requireString(sourceArtifact, "canonicalEvidenceRef");
  const sourcePath = path.resolve(specDir, normalizedSourceArtifact);
  const relative = path.relative(specDir, sourcePath);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(sourcePath)) {
    throw new Error("canonical review evidence is missing or outside the spec directory");
  }
  const sourceStat = fs.lstatSync(sourcePath);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink()) {
    throw new Error("canonical review evidence must be a regular file");
  }
  if (sourceStat.size > MAX_SOURCE_ARTIFACT_READ_BYTES) {
    throw new Error(`canonical review evidence exceeds ${MAX_SOURCE_ARTIFACT_READ_BYTES} bytes`);
  }
  const realRelative = path.relative(fs.realpathSync(specDir), fs.realpathSync(sourcePath));
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error("canonical review evidence resolves outside the spec directory");
  }
  const canonicalText = fs.readFileSync(sourcePath, "utf8").replace(/\n$/, "");
  const document = JSON.parse(canonicalText);
  const evidence = new ReviewEvidence({
    ...document,
    disposition: new ReviewDisposition({
      value: document.disposition,
      blockingFindings: document.blockingFindings,
      advisoryFindings: document.advisoryFindings,
    }),
  });
  if (evidence.canonicalText !== canonicalText) {
    throw new Error("canonical review evidence bytes are not canonical");
  }
  const expectedSourceArtifact = `review-evidence/${evidence.identity.evidenceDigest}.json`;
  if (normalizedSourceArtifact !== expectedSourceArtifact) {
    throw new Error("canonical review evidence reference does not match its digest");
  }
  return { sourceArtifact: normalizedSourceArtifact, evidence };
}

export class CanonicalReviewEvidenceProjection {
  constructor({ specDir, record }) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error("review convergence record is required");
    }
    const sourceArtifact = requireString(record.canonicalEvidenceRef, "canonicalEvidenceRef");
    const canonical = readCanonicalReviewEvidence({ specDir, sourceArtifact });
    const { evidence } = canonical;
    const identity = record.evidenceIdentity;
    if (
      !canonicalEvidenceIdentityMatches(identity, evidence)
      || record.phase !== evidence.phase
      || (record.taskId ?? null) !== evidence.taskId
      || record.treeSha !== evidence.treeSha
      || record.evidence?.evidenceId !== evidence.identity.evidenceDigest
      || record.evidence?.disposition !== evidence.disposition.value
    ) {
      throw new Error("canonical review evidence does not match current flow state");
    }
    const expectedHandoffs = buildReviewHandoffFindings(evidence).map((entry) => entry.toJSON());
    if (JSON.stringify(record.handoffFindings || []) !== JSON.stringify(expectedHandoffs)) {
      throw new Error("canonical review handoff findings do not match current flow state");
    }
    this.sourceArtifact = canonical.sourceArtifact;
    this.evidence = evidence;
    Object.freeze(this);
  }

  findFinding(findingId) {
    return this.evidence.findings.find((finding) => finding.findingId === findingId) || null;
  }

  toJSON() {
    return {
      sourceArtifact: this.sourceArtifact,
      phase: this.evidence.phase,
      taskId: this.evidence.taskId,
      treeSha: this.evidence.treeSha,
      disposition: this.evidence.disposition.value,
      evidenceDigest: this.evidence.identity.evidenceDigest,
      provenance: this.evidence.provenance.toJSON(),
      findings: this.evidence.findings.map((finding) => finding.toJSON()),
    };
  }
}

class HistoricalCanonicalReviewEvidenceProjection {
  constructor({ specDir, record, evidenceIdentity }) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error("review convergence record is required");
    }
    const digest = requireString(evidenceIdentity?.evidenceDigest, "evidenceHistory.evidenceDigest");
    const canonical = readCanonicalReviewEvidence({
      specDir,
      sourceArtifact: `review-evidence/${digest}.json`,
    });
    const { evidence } = canonical;
    if (
      !canonicalEvidenceIdentityMatches(evidenceIdentity, evidence)
      || record.phase !== evidence.phase
      || (record.taskId ?? null) !== evidence.taskId
    ) {
      throw new Error("historical canonical review evidence does not match flow state");
    }
    this.sourceArtifact = canonical.sourceArtifact;
    this.evidence = evidence;
    Object.freeze(this);
  }
}

export class AcceptanceReviewOutcome {
  constructor(input = {}) {
    if (input.version !== 2) throw new Error("acceptance-review version must be 2");
    this.version = 2;
    this.repairFingerprint = requireString(input.repairFingerprint, "repairFingerprint");
    if (!/^[a-f0-9]{64}$/i.test(this.repairFingerprint)) {
      throw new Error("repairFingerprint must be a 64-character SHA-256 digest");
    }
    if (!Array.isArray(input.mechanicalBlockers)) throw new Error("mechanicalBlockers must be an array");
    this.mechanicalBlockers = Object.freeze(input.mechanicalBlockers.map((entry) => (
      entry instanceof MechanicalBlocker ? entry : new MechanicalBlocker(entry)
    )));
    if (!Array.isArray(input.hardBlockers)) throw new Error("hardBlockers must be an array");
    this.hardBlockers = Object.freeze(clone(input.hardBlockers));
    if (!Array.isArray(input.requirementJudgments)) throw new Error("requirementJudgments must be an array");
    this.requirementJudgments = Object.freeze(input.requirementJudgments.map((entry) => (
      entry instanceof RequirementAcceptanceJudgment ? entry : new RequirementAcceptanceJudgment(entry)
    )));
    if (!Array.isArray(input.deferredFindings)) throw new Error("deferredFindings must be an array");
    this.deferredFindings = Object.freeze(input.deferredFindings.map((entry) => (
      entry instanceof DeferredAcceptanceFinding ? entry : new DeferredAcceptanceFinding(entry)
    )));
    this.userDecision = input.userDecision == null ? null : Object.freeze(clone(input.userDecision));
    if (this.userDecision !== null) {
      if (!USER_DECISION_CHOICES.has(this.userDecision.choice)) throw new Error("userDecision.choice is invalid");
      if (Number.isNaN(Date.parse(this.userDecision.decidedAt))) throw new Error("userDecision.decidedAt must be an ISO timestamp");
    }
    this.verdict = deriveAcceptanceReviewVerdict(this);
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      repairFingerprint: this.repairFingerprint,
      mechanicalBlockers: this.mechanicalBlockers.map((entry) => entry.toJSON()),
      hardBlockers: clone(this.hardBlockers),
      requirementJudgments: this.requirementJudgments.map((entry) => entry.toJSON()),
      deferredFindings: this.deferredFindings.map((entry) => entry.toJSON()),
      userDecision: this.userDecision == null ? null : clone(this.userDecision),
      verdict: this.verdict,
    };
  }
}

export class AcceptanceEvidenceBindings {
  constructor(context) {
    this.requestRef = "flow.request";
    this.requirementIds = Object.freeze([...context.requirementIds]);
    this.diffRefs = Object.freeze([...new Set(
      [...String(context.evidence.diff || "").matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)]
        .flatMap((match) => [`diff:${match[1]}`, `diff:${match[2]}`]),
    )]);
    const repair = context.evidence.repairEvidence;
    const repairRefs = new Set([repair.ref]);
    if (repair.kind === "repair-audit") {
      for (const [index, entry] of (repair.artifact?.repairs || []).entries()) {
        repairRefs.add(`${repair.ref}#repairs[${index}]`);
        if (entry?.id) repairRefs.add(`${repair.ref}#${entry.id}`);
      }
    }
    this.repairRefs = Object.freeze([...repairRefs]);
    this.testRefs = Object.freeze([
      "test-execute-result.json",
      ...this.requirementIds.map((requirementId) => `test-execute-result.json#${requirementId}`),
      "test-result-review.json",
    ]);
    Object.freeze(this);
  }

  validate(input) {
    const judgment = input instanceof RequirementAcceptanceJudgment
      ? input
      : new RequirementAcceptanceJudgment(input);
    if (!this.requirementIds.includes(judgment.requirementId)) {
      throw new Error(`unknown requirement judgment: ${judgment.requirementId}`);
    }
    if (judgment.requestRefs.some((ref) => ref !== this.requestRef)) {
      throw new Error(`${judgment.requirementId}: requestRefs must cite ${this.requestRef}`);
    }
    const requirementRef = `spec.json#${judgment.requirementId}`;
    if (judgment.requirementRefs.some((ref) => ref !== requirementRef)) {
      throw new Error(`${judgment.requirementId}: requirementRefs must cite ${requirementRef}`);
    }
    if (judgment.diffRefs.some((ref) => !this.diffRefs.includes(ref))) {
      throw new Error(`${judgment.requirementId}: diffRefs contain a path outside the current diff`);
    }
    if (judgment.repairRefs.some((ref) => !this.repairRefs.includes(ref))) {
      throw new Error(`${judgment.requirementId}: repairRefs do not cite current repair evidence`);
    }
    const allowedTestRefs = new Set([
      "test-execute-result.json",
      `test-execute-result.json#${judgment.requirementId}`,
      "test-result-review.json",
    ]);
    if (judgment.testRefs.some((ref) => !allowedTestRefs.has(ref))) {
      throw new Error(`${judgment.requirementId}: testRefs do not cite current test evidence`);
    }
    return judgment;
  }

  validateDeferredDisposition(input, finding) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("deferred finding disposition must be an object");
    }
    const findingId = requireString(input.findingId, "deferred disposition findingId");
    if (findingId !== finding.findingId) {
      throw new Error(`deferred finding disposition does not match ${finding.findingId}`);
    }
    const evidenceRefs = requireStringArray(
      input.evidenceRefs,
      `${findingId}.evidenceRefs`,
    );
    const sourceRef = `${finding.sourceArtifact}#${finding.sourceFindingId}`;
    if (!evidenceRefs.includes(sourceRef)) {
      throw new Error(`${findingId}: evidenceRefs must cite ${sourceRef}`);
    }
    const allowedRefs = new Set([
      sourceRef,
      ...this.diffRefs,
      ...this.repairRefs,
      ...this.testRefs,
    ]);
    if (evidenceRefs.some((ref) => !allowedRefs.has(ref))) {
      throw new Error(`${findingId}: evidenceRefs contain an unbound acceptance reference`);
    }
    return new DeferredAcceptanceFinding({
      ...finding,
      finalDisposition: requireFinalDisposition(input.finalDisposition, `${findingId}.finalDisposition`),
      evidenceRefs,
    });
  }
}

function resolveDeferredFindings({ context, bindings, dispositionJudgments }) {
  const judgments = Array.isArray(dispositionJudgments) ? dispositionJudgments : [];
  const byId = new Map();
  for (const judgment of judgments) {
    const findingId = requireString(judgment?.findingId, "deferred disposition findingId");
    if (byId.has(findingId)) throw new Error(`duplicate deferred finding disposition: ${findingId}`);
    byId.set(findingId, judgment);
  }
  const expectedIds = new Set(context.deferredFindings.map((finding) => finding.findingId));
  for (const findingId of byId.keys()) {
    if (!expectedIds.has(findingId)) throw new Error(`unknown deferred finding disposition: ${findingId}`);
  }
  return context.deferredFindings.map((finding) => {
    const judgment = byId.get(finding.findingId);
    if (judgment) return bindings.validateDeferredDisposition(judgment, finding).toJSON();
    if (!["still_open", "blocking"].includes(finding.finalDisposition)) {
      return new DeferredAcceptanceFinding(finding).toJSON();
    }
    throw new Error(`missing deferred finding disposition: ${finding.findingId}`);
  });
}

function deferredFindingBlockers(deferredFindings) {
  return deferredFindings
    .filter((finding) => ["still_open", "blocking"].includes(finding.finalDisposition))
    .map((finding) => new DeferredFindingBlocker(finding).toJSON());
}

export function deriveAcceptanceReviewVerdict(artifact = {}) {
  if ((artifact.mechanicalBlockers || []).length > 0) return "blocked";
  const judgments = artifact.requirementJudgments || [];
  if (judgments.some((judgment) => judgment.status === "notMet")) return "repair_required";
  if (
    judgments.some((judgment) => judgment.status === "notVerifiable")
    || (artifact.hardBlockers || []).length > 0
  ) {
    return "user_decision_required";
  }
  return "pass";
}

function normalizeArtifact(input = {}) {
  return new AcceptanceReviewOutcome(input).toJSON();
}

export function validateAcceptanceReviewArtifact(artifact, { requirementIds = null } = {}) {
  const errors = validateSchema(artifact, acceptanceSchema());
  if (errors.length > 0) throw new Error(`acceptance-review schema validation failed: ${errors.join("; ")}`);
  if (!VERDICTS.has(artifact.verdict)) throw new Error(`invalid acceptance-review verdict: ${artifact.verdict}`);
  const judgments = artifact.requirementJudgments.map((entry) => new RequirementAcceptanceJudgment(entry));
  const expected = Array.isArray(requirementIds) ? requirementIds : judgments.map((entry) => entry.requirementId);
  const actual = new Set();
  for (const judgment of judgments) {
    if (actual.has(judgment.requirementId)) throw new Error(`duplicate requirement judgment: ${judgment.requirementId}`);
    actual.add(judgment.requirementId);
    if (!expected.includes(judgment.requirementId)) throw new Error(`unknown requirement judgment: ${judgment.requirementId}`);
  }
  for (const requirementId of expected) {
    if (!actual.has(requirementId)) throw new Error(`missing requirement judgment: ${requirementId}`);
  }
  const derived = deriveAcceptanceReviewVerdict(artifact);
  if (artifact.verdict !== derived) throw new Error(`acceptance-review verdict must match derived verdict: ${derived}`);
  return artifact;
}

function validateDeferredFindingCoverage(specDir, deferredFindings, flowState = null) {
  const expected = new DeferredFindingSources(specDir, flowState)
    .entries
    .map((entry) => entry.findingId);
  const actual = deferredFindings.map((entry) => entry.findingId);
  if (new Set(actual).size !== actual.length) throw new Error("duplicate deferred finding classification");
  for (const findingId of expected) {
    if (!actual.includes(findingId)) throw new Error(`missing deferred finding classification: ${findingId}`);
  }
  for (const findingId of actual) {
    if (!expected.includes(findingId)) throw new Error(`unknown deferred finding classification: ${findingId}`);
  }
}

function prepareAcceptanceReviewArtifact({
  specDir,
  artifact,
  requirementIds = null,
  flowState = null,
}) {
  const normalized = normalizeArtifact(artifact);
  const reportPath = path.join(specDir, "report.json");
  if (fs.existsSync(reportPath)) normalized.reportRefs = ["report.json"];
  validateDeferredFindingCoverage(specDir, normalized.deferredFindings, flowState);
  validateAcceptanceReviewArtifact(normalized, { requirementIds });
  return normalized;
}

function persistAcceptanceReviewArtifact({ specDir, normalized, fingerprint }) {
  if (!fingerprint) throw new Error("acceptance-review writer requires the current repair fingerprint");
  const written = writeRepairEvidenceArtifact({
    specDir,
    stepId: "acceptance-review",
    artifact: normalized,
    fingerprint,
  });
  if (normalized.deferredFindings.length > 0) mirrorFinalDispositions(specDir, normalized.deferredFindings);
  return written;
}

export function writeAcceptanceReviewArtifact({
  specDir,
  artifact,
  requirementIds = null,
  fingerprint = null,
  flowState = null,
}) {
  const normalized = prepareAcceptanceReviewArtifact({
    specDir,
    artifact,
    requirementIds,
    flowState,
  });
  return persistAcceptanceReviewArtifact({ specDir, normalized, fingerprint });
}

function dispositionEvidence(specDir) {
  const file = path.join(specDir, "acceptance-review-evidence.json");
  if (!fs.existsSync(file)) return new Map();
  const data = readJson(file);
  return new Map((data.deferredFindingDispositions || []).map((entry) => [entry.findingId, {
    finalDisposition: requireFinalDisposition(entry.finalDisposition),
    evidenceRefs: Array.isArray(entry.evidenceRefs) ? entry.evidenceRefs : [],
  }]));
}

function latestReviewConvergenceRecords(flowState) {
  const records = reviewConvergenceRecords(flowState);
  const latest = new Map();
  for (const record of records) {
    latest.set(`${record.phase}:${record.taskId ?? ""}`, record);
  }
  return [...latest.values()];
}

function reviewConvergenceRecords(flowState) {
  return Array.isArray(flowState?.reviewConvergence?.records)
    ? flowState.reviewConvergence.records
    : [];
}

function reviewHandoffFindingId(record, finding) {
  const digest = record.evidence?.evidenceId || record.evidenceIdentity?.evidenceDigest;
  return `RF-${String(digest).slice(0, 12)}-${finding.findingId}`;
}

function reviewHandoffFindings(flowState) {
  return latestReviewConvergenceRecords(flowState).flatMap((record) => (
    Array.isArray(record.handoffFindings) ? record.handoffFindings.map((finding) => ({
      findingId: reviewHandoffFindingId(record, finding),
      sourceStep: finding.sourceStep || (record.taskId == null ? `${record.phase}-review` : "task-review"),
      sourceArtifact: record.canonicalEvidenceRef || finding.canonicalEvidenceRef,
      sourceFindingId: finding.findingId,
      handoffFinding: finding,
      record,
    })) : []
  ));
}

function historicalReviewHandoffs(specDir, flowState) {
  const handoffs = new Map();
  const seenEvidence = new Set();
  for (const record of reviewConvergenceRecords(flowState)) {
    const identities = [record.evidenceIdentity, ...(record.evidenceHistory || [])];
    for (const identity of identities) {
      const digest = identity?.evidenceDigest;
      if (typeof digest !== "string" || seenEvidence.has(digest)) continue;
      seenEvidence.add(digest);
      try {
        const projection = new HistoricalCanonicalReviewEvidenceProjection({
          specDir,
          record,
          evidenceIdentity: identity,
        });
        for (const finding of buildReviewHandoffFindings(projection.evidence)) {
          const sourceStep = finding.sourceStep || (record.taskId == null ? `${record.phase}-review` : "task-review");
          const key = `${sourceStep}:${finding.fingerprint}`;
          if (!handoffs.has(key)) {
            handoffs.set(key, {
              sourceArtifact: projection.sourceArtifact,
              sourceFindingId: finding.findingId,
            });
          }
        }
      } catch (error) {
        throw new Error(`historical review evidence is invalid for ${digest}`, { cause: error });
      }
    }
  }
  return handoffs;
}

class ResolvedDeferredFindingSource {
  constructor(finding, canonicalHandoff = null) {
    this.findingId = finding.findingId;
    this.sourceStep = finding.sourceStep;
    this.sourceArtifact = canonicalHandoff?.sourceArtifact || finding.sourceArtifact;
    this.sourceFindingId = canonicalHandoff?.sourceFindingId || finding.sourceFindingId;
    this.fingerprint = finding.fingerprint;
    Object.freeze(this);
  }
}

class DeferredFindingSources {
  constructor(specDir, flowState = null) {
    const reviewHandoffs = reviewHandoffFindings(flowState);
    const canonicalHandoffs = new Map(reviewHandoffs.map((entry) => [
      `${entry.sourceStep}:${entry.handoffFinding.fingerprint}`,
      entry,
    ]));
    const historicalHandoffs = historicalReviewHandoffs(specDir, flowState);
    this.flowFindings = Object.freeze(
      readFlowFindingsArtifact(specDir, { flowState }).entries.map((entry) => (
        new ResolvedDeferredFindingSource(
          entry,
          canonicalHandoffs.get(`${entry.sourceStep}:${entry.fingerprint}`)
            || historicalHandoffs.get(`${entry.sourceStep}:${entry.fingerprint}`)
            || null,
        )
      )),
    );
    const deferredFingerprints = new Set(
      this.flowFindings.map((entry) => entry.fingerprint),
    );
    this.reviewHandoffs = Object.freeze(
      reviewHandoffs
        .filter((entry) => !deferredFingerprints.has(entry.handoffFinding.fingerprint)),
    );
    Object.freeze(this);
  }

  get entries() {
    return [...this.flowFindings, ...this.reviewHandoffs];
  }
}

function buildDeferredFindingsFromEvidence(specDir, flowState = null) {
  const evidence = dispositionEvidence(specDir);
  const sources = new DeferredFindingSources(specDir, flowState);
  const deferred = sources.flowFindings.map((entry) => {
    const decision = evidence.get(entry.findingId);
    return new DeferredAcceptanceFinding({
      findingId: entry.findingId,
      sourceStep: entry.sourceStep,
      sourceArtifact: entry.sourceArtifact,
      sourceFindingId: entry.sourceFindingId,
      finalDisposition: decision?.finalDisposition || "still_open",
      evidenceRefs: decision?.evidenceRefs || [],
    }).toJSON();
  });
  const reviewHandoffs = sources.reviewHandoffs.map((entry) => {
    const decision = evidence.get(entry.findingId);
    return new DeferredAcceptanceFinding({
      findingId: entry.findingId,
      sourceStep: entry.sourceStep,
      sourceArtifact: entry.sourceArtifact,
      sourceFindingId: entry.sourceFindingId,
      finalDisposition: decision?.finalDisposition || "still_open",
      evidenceRefs: decision?.evidenceRefs || [],
    }).toJSON();
    });
  return [...deferred, ...reviewHandoffs];
}

function latestImplReviewRecord(flowState) {
  return latestReviewConvergenceRecords(flowState).find((record) => (
    record.phase === "impl" && (record.taskId ?? null) === null
  )) || null;
}

function readCanonicalImplReviewEvidence(specDir, flowState) {
  const record = latestImplReviewRecord(flowState);
  return record == null ? null : new CanonicalReviewEvidenceProjection({ specDir, record });
}

function readRejectedImplReviewTriageForVerdict(specDir, verdict) {
  return verdict === "REJECTED" ? readRejectedImplReviewTriage(specDir) : null;
}

function inspectDeferredSources(specDir, deferredFindings, flowState) {
  const blockers = [];
  const evidence = [];
  const sourceCache = new Map();
  const canonicalCache = new Map();
  const reviewHandoffs = new Map(reviewHandoffFindings(flowState).map((entry) => [entry.findingId, entry]));
  const canonicalRecords = new Map(latestReviewConvergenceRecords(flowState).map((record) => [
    record.canonicalEvidenceRef,
    record,
  ]));
  const addMissing = (finding) => blockers.push(new MechanicalBlocker({
    blockerId: `M-deferred-${blockers.length + 1}`,
    kind: "missing_deferred_source",
    summary: `Deferred source evidence is missing: ${finding.sourceArtifact}#${finding.sourceFindingId}.`,
  }).toJSON());

  for (const finding of deferredFindings) {
    const handoff = reviewHandoffs.get(finding.findingId);
    let sourceFinding = null;
    try {
      if (handoff) {
        const record = handoff.record;
        if (record.canonicalEvidenceRef !== finding.sourceArtifact) {
          addMissing(finding);
          continue;
        }
        if (!canonicalCache.has(record)) {
          canonicalCache.set(record, new CanonicalReviewEvidenceProjection({ specDir, record }));
        }
        sourceFinding = canonicalCache.get(record).findFinding(finding.sourceFindingId);
      } else {
        const canonicalRecord = canonicalRecords.get(finding.sourceArtifact);
        if (canonicalRecord) {
          if (!canonicalCache.has(canonicalRecord)) {
            canonicalCache.set(
              canonicalRecord,
              new CanonicalReviewEvidenceProjection({ specDir, record: canonicalRecord }),
            );
          }
          sourceFinding = canonicalCache.get(canonicalRecord)
            .findFinding(finding.sourceFindingId);
        } else {
          if (!sourceCache.has(finding.sourceArtifact)) {
            sourceCache.set(
              finding.sourceArtifact,
              readBoundedSourceArtifact(specDir, finding.sourceArtifact),
            );
          }
          sourceFinding = findSourceFinding(
            sourceCache.get(finding.sourceArtifact),
            finding.sourceStep,
            finding.sourceFindingId,
          );
        }
      }
    } catch (_) {
      sourceFinding = null;
    }
    if (!sourceFinding) {
      addMissing(finding);
      continue;
    }
    evidence.push(new DeferredFindingEvidenceProjection({ finding, sourceFinding }).toJSON());
  }
  return { blockers, evidence };
}

export function classifyMechanicalBlockers(input = {}) {
  const blockers = [];
  const add = (kind, summary) => blockers.push(new MechanicalBlocker({
    blockerId: `M-${blockers.length + 1}`,
    kind,
    summary,
  }).toJSON());
  if (input.tests?.missing) add("missing_tests", "Test evidence is missing.");
  if (input.tests?.failed) add("failed_tests", "Test evidence contains failures.");
  for (const id of input.tests?.missingRequired || []) add("missing_required_tests", `Required test coverage is missing for ${id}.`);
  for (const file of input.artifacts?.missing || []) add("missing_artifact", `Required artifact is missing: ${file}.`);
  for (const file of input.artifacts?.invalidSchemas || []) add("invalid_schema", `Required artifact is invalid: ${file}.`);
  return blockers;
}

function requirementList(specDir) {
  return readJson(path.join(specDir, "spec.json")).requirements || [];
}

function validateRequirementSummaryMembership(summary, requirements) {
  const expected = requirements.filter((entry) => entry.testable !== false).map((entry) => entry.id);
  const actual = Array.isArray(summary) ? summary.map((entry) => entry?.id) : [];
  if (new Set(actual).size !== actual.length) throw new Error("test-execute summary contains duplicate requirement ids");
  const missing = expected.filter((id) => !actual.includes(id));
  const unknown = actual.filter((id) => !expected.includes(id));
  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(`test-execute summary membership invalid: missing=${missing.join(",")} unknown=${unknown.join(",")}`);
  }
  return missing;
}

function readScenarioRawEvidence(specDir) {
  const file = path.join(specDir, "tests/.raw/scenario-validity.log");
  if (!fs.existsSync(file)) throw new Error("scenario-validity raw evidence is missing");
  const size = fs.statSync(file).size;
  if (size > MAX_ACCEPTANCE_RAW_EVIDENCE_BYTES) {
    throw new Error(`scenario-validity raw evidence exceeds ${MAX_ACCEPTANCE_RAW_EVIDENCE_BYTES} bytes`);
  }
  return fs.readFileSync(file, "utf8");
}

function validateImplReviewEvidence(artifact) {
  if (!artifact || typeof artifact !== "object") throw new Error("impl-review artifact must be an object");
  if (!["PASS", "ADVISORY", "REJECTED"].includes(artifact.verdict)) throw new Error("impl-review verdict is invalid");
  if (!Array.isArray(artifact.blockingFindings)) throw new Error("impl-review blockingFindings must be an array");
  if (!Array.isArray(artifact.nonBlockingImprovements)) throw new Error("impl-review nonBlockingImprovements must be an array");
  if (!artifact.summary || typeof artifact.summary !== "object") throw new Error("impl-review summary is required");
  if (artifact.summary.blocking !== artifact.blockingFindings.length) throw new Error("impl-review blocking summary is inconsistent");
  if (artifact.summary.nonBlocking !== artifact.nonBlockingImprovements.length) throw new Error("impl-review non-blocking summary is inconsistent");
  const expectedVerdict = artifact.blockingFindings.length > 0
    ? "REJECTED"
    : artifact.nonBlockingImprovements.length > 0 ? "ADVISORY" : "PASS";
  if (artifact.verdict !== expectedVerdict) throw new Error("impl-review verdict does not match findings");
  for (const finding of artifact.blockingFindings) requireString(finding?.findingId, "impl-review findingId");
}

function validateImplGateEvidence(artifact) {
  if (!artifact || typeof artifact !== "object") throw new Error("impl-gate artifact must be an object");
  if (!["pass", "fail"].includes(artifact.verdict)) throw new Error("impl-gate verdict is invalid");
  if (artifact.phase !== "integration") throw new Error("impl-gate phase must be integration");
  if (!Array.isArray(artifact.evaluations)) throw new Error("impl-gate evaluations must be an array");
  if (!Array.isArray(artifact.issues)) throw new Error("impl-gate issues must be an array");
  const hasFailure = artifact.issues.length > 0 || artifact.evaluations.some((entry) => entry?.result === "fail");
  if ((artifact.verdict === "pass") === hasFailure) throw new Error("impl-gate verdict does not match evaluations");
}

function validateRetroEvidence(artifact, requirements) {
  if (!artifact || typeof artifact !== "object") throw new Error("retro artifact must be an object");
  if (artifact.mode !== "result-file") throw new Error("retro mode must be result-file");
  if (Number.isNaN(Date.parse(artifact.date))) throw new Error("retro date must be an ISO timestamp");
  if (!Array.isArray(artifact.requirements)) throw new Error("retro requirements must be an array");
  if (!artifact.summary || typeof artifact.summary !== "object") throw new Error("retro summary is required");
  const expectedCount = requirements.filter((entry) => entry.testable !== false).length;
  if (artifact.requirements.length !== expectedCount || artifact.summary.total !== expectedCount) {
    throw new Error("retro requirement count is inconsistent");
  }
  if (!Number.isInteger(artifact.summary.not_done) || artifact.summary.not_done < 0) {
    throw new Error("retro summary.not_done is invalid");
  }
  for (const entry of artifact.requirements) {
    if (!new Set(["done", "not_done", "not_applicable"]).has(entry?.status)) {
      throw new Error("retro requirement status is invalid");
    }
  }
}

function mechanicalArtifactState({ root, specDir, fingerprint, requirements, flowState }) {
  const missing = [];
  const invalidSchemas = [];
  const artifacts = {};
  let repairEvidenceProjection = null;
  let canonicalImplReviewEvidence = null;
  for (const file of REQUIRED_MECHANICAL_ARTIFACTS) {
    try {
      const value = readBoundedSourceArtifact(specDir, file);
      if (!value) missing.push(file);
      else artifacts[file] = value;
    } catch (_) {
      invalidSchemas.push(file);
    }
  }
  if (artifacts["scenario-validity-result.json"]) {
    try {
      const rawText = readScenarioRawEvidence(specDir);
      validateScenarioValidityResult(artifacts["scenario-validity-result.json"], {
        root,
        specDir,
        requirements,
        rawText,
      });
    } catch (_) {
      invalidSchemas.push("scenario-validity-result.json");
    }
  }
  let missingRequired = [];
  if (artifacts["test-execute-result.json"]) {
    try {
      validateTestExecuteResultV2(artifacts["test-execute-result.json"]);
      missingRequired = validateRequirementSummaryMembership(
        artifacts["test-execute-result.json"].summary,
        requirements,
      );
    } catch (_) {
      invalidSchemas.push("test-execute-result.json");
      const present = new Set((artifacts["test-execute-result.json"].summary || []).map((entry) => entry?.id));
      missingRequired = requirements
        .filter((entry) => entry.testable !== false && !present.has(entry.id))
        .map((entry) => entry.id);
    }
  }
  if (artifacts["test-result-review.json"]) {
    try {
      validateTestResultReview(artifacts["test-result-review.json"]);
    } catch (_) {
      invalidSchemas.push("test-result-review.json");
    }
  }
  if (latestImplReviewRecord(flowState)) {
    try {
      canonicalImplReviewEvidence = readCanonicalImplReviewEvidence(specDir, flowState);
    } catch (_) {
      invalidSchemas.push("impl-review.json");
    }
  }
  const implReviewVerdict = canonicalImplReviewEvidence?.evidence.disposition.value
    || artifacts["impl-review.json"]?.verdict;
  let rejectedReviewTriage = null;
  try {
    rejectedReviewTriage = readRejectedImplReviewTriageForVerdict(specDir, implReviewVerdict);
  } catch (_) {
    invalidSchemas.push("impl-triage.json");
  }
  if (artifacts["impl-review.json"]) {
    try {
      validateImplReviewEvidence(artifacts["impl-review.json"]);
      if (canonicalImplReviewEvidence) {
        const canonical = canonicalImplReviewEvidence.evidence;
        const artifactFindingIds = [
          ...artifacts["impl-review.json"].blockingFindings,
          ...artifacts["impl-review.json"].nonBlockingImprovements,
        ].map((finding) => finding.findingId);
        const canonicalFindingIds = canonical.findings.map((finding) => finding.findingId);
        if (
          artifacts["impl-review.json"].verdict !== canonical.disposition.value
          || JSON.stringify(artifactFindingIds) !== JSON.stringify(canonicalFindingIds)
        ) {
          throw new Error("impl-review phase artifact does not match canonical typed evidence");
        }
      }
    } catch (_) {
      invalidSchemas.push("impl-review.json");
    }
  }
  if (artifacts["impl-gate-result.json"]) {
    try {
      validateImplGateEvidence(artifacts["impl-gate-result.json"]);
    } catch (_) {
      invalidSchemas.push("impl-gate-result.json");
    }
  }
  if (artifacts["retro.json"]) {
    try {
      validateRetroEvidence(artifacts["retro.json"], requirements);
    } catch (_) {
      invalidSchemas.push("retro.json");
    }
  }
  if (fs.existsSync(path.join(specDir, "impl-repair.json"))) {
    try {
      const ledger = readImplRepairLedger(specDir);
      if (!ledger || ledger.entries.length === 0) throw new Error("impl-repair ledger must contain an entry");
      repairEvidenceProjection = ledger.toProjection(fingerprint);
      if (!repairEvidenceProjection.currentFingerprintMatched) {
        throw new Error("impl-repair ledger does not end at the current fingerprint");
      }
    } catch (_) {
      invalidSchemas.push("impl-repair.json");
    }
  }
  for (const file of FINGERPRINTED_INPUT_ARTIFACTS) {
    if (!artifacts[file]) continue;
    if (file === "impl-review.json" && canonicalImplReviewEvidence) continue;
    try {
      assertRepairFingerprint({ artifact: artifacts[file], fingerprint, label: file });
    } catch (_) {
      invalidSchemas.push(file);
    }
  }
  const testSummary = artifacts["test-execute-result.json"]?.summary || [];
  const failed = artifacts["scenario-validity-result.json"]?.result !== "pass"
    || testSummary.some((entry) => entry.result === "fail")
    || artifacts["test-result-review.json"]?.verdict !== "pass"
    || (!rejectedReviewTriage && !["PASS", "ADVISORY"].includes(implReviewVerdict))
    || artifacts["impl-gate-result.json"]?.verdict !== "pass"
    || Number(artifacts["retro.json"]?.summary?.not_done || 0) > 0;
  return {
    artifacts,
    canonicalImplReviewEvidence,
    repairEvidenceProjection,
    blockers: classifyMechanicalBlockers({
      tests: {
        missing: !artifacts["test-execute-result.json"],
        failed,
        missingRequired,
      },
      artifacts: { missing, invalidSchemas: [...new Set(invalidSchemas)] },
    }),
  };
}

export function buildAcceptanceReviewContext({ root, state, diff }) {
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec, state });
  const requirements = requirementList(specDir);
  const mechanical = mechanicalArtifactState({
    root,
    specDir,
    fingerprint,
    requirements,
    flowState: state,
  });
  const deferredFindings = buildDeferredFindingsFromEvidence(specDir, state);
  const deferredSources = inspectDeferredSources(specDir, deferredFindings, state);
  const mechanicalBlockers = [
    ...mechanical.blockers,
    ...deferredSources.blockers,
    ...(typeof state.request === "string" && state.request.trim() !== "" ? [] : [new MechanicalBlocker({
      blockerId: "M-request",
      kind: "missing_request",
      summary: "The original flow request is missing.",
    }).toJSON()]),
  ];
  const evidenceRefresh = new AcceptanceEvidenceRefresh({
    fingerprint,
    artifacts: mechanical.artifacts,
    blockers: mechanicalBlockers,
    deferredFindings,
    fingerprintExemptArtifacts: mechanical.canonicalImplReviewEvidence
      ? ["impl-review.json"]
      : [],
  });
  const repairPath = path.join(specDir, "impl-repair.json");
  const implReview = mechanical.artifacts["impl-review.json"];
  const rejectedReviewTriage = readRejectedImplReviewTriageForVerdict(specDir, implReview?.verdict);
  const repairEvidence = fs.existsSync(repairPath)
    ? {
        kind: "repair-audit",
        ref: "impl-repair.json",
        artifact: mechanical.repairEvidenceProjection || { currentFingerprintMatched: false, repairs: [] },
      }
    : rejectedReviewTriage
      ? { kind: "no-repair", ref: "impl-triage.json", artifact: rejectedReviewTriage }
      : { kind: "no-repair", ref: "acceptance:no-repair", artifact: { reason: "No implementation repair was required." } };
  return {
    root,
    specDir,
    fingerprint,
    requirementIds: requirements.map((entry) => entry.id),
    evidence: {
      originalRequest: typeof state.request === "string" && state.request.trim() !== "" ? state.request : null,
      requirements,
      diff,
      repairEvidence,
      testEvidence: new AcceptanceTestEvidenceProjection(mechanical.artifacts).toJSON(),
      reviewEvidence: mechanical.canonicalImplReviewEvidence?.toJSON() || null,
      deferredFindings,
      deferredFindingEvidence: deferredSources.evidence,
    },
    mechanicalBlockers,
    deferredFindings,
    evidenceRefresh,
  };
}

export function artifactFromAcceptanceJudgments({
  context,
  requirementJudgments,
  deferredFindingDispositions = [],
}) {
  const missingReason = context.mechanicalBlockers.map((entry) => entry.summary).join("; ") || "Mechanical evidence is unavailable.";
  const bindings = context.mechanicalBlockers.length > 0 ? null : new AcceptanceEvidenceBindings(context);
  const judgments = context.mechanicalBlockers.length > 0
    ? context.requirementIds.map((requirementId) => new RequirementAcceptanceJudgment({
      requirementId,
      status: "notVerifiable",
      requestRefs: ["flow.request"],
      requirementRefs: [`spec.json#${requirementId}`],
      diffRefs: [],
      repairRefs: [context.evidence.repairEvidence.ref],
      testRefs: [],
      missingEvidence: [missingReason],
    }).toJSON())
    : requirementJudgments.map((judgment) => bindings.validate(judgment).toJSON());
  const deferredFindings = context.mechanicalBlockers.length > 0
    ? context.deferredFindings
    : resolveDeferredFindings({
        context,
        bindings,
        dispositionJudgments: deferredFindingDispositions,
      });
  return normalizeArtifact({
    version: 2,
    repairFingerprint: context.fingerprint.hash,
    mechanicalBlockers: context.mechanicalBlockers,
    hardBlockers: context.mechanicalBlockers.length > 0
      ? []
      : deferredFindingBlockers(deferredFindings),
    requirementJudgments: judgments,
    deferredFindings,
    userDecision: null,
  });
}

function markStep(state, id, status) {
  const step = findStepById(state.steps || [], id);
  if (!step) return;
  step.status = status;
  if (status === "pending") {
    delete step.startedAt;
    delete step.finishedAt;
  }
}

function resetSteps(state, ids, inProgress = null) {
  for (const id of ids) markStep(state, id, id === inProgress ? "in_progress" : "pending");
}

function acceptanceArtifactPath(state) {
  return path.posix.join(path.posix.dirname(state.spec.split(path.sep).join("/")), ACCEPTANCE_REVIEW_ARTIFACT_FILE);
}

export function applyAcceptanceReviewResult({
  root,
  flowManager,
  artifact,
  evidenceRefresh = null,
}) {
  const state = flowManager.load();
  if (!state?.spec) throw new Error("active flow spec is required");
  ensureRepairFingerprintContract({ root, state, flowManager });
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const requirements = requirementList(specDir);
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec, state });
  if (requireString(artifact.repairFingerprint, "repairFingerprint") !== fingerprint.hash) {
    throw new Error("acceptance-review repairFingerprint does not match current inputs");
  }
  const normalized = prepareAcceptanceReviewArtifact({
    specDir,
    artifact,
    requirementIds: requirements.map((entry) => entry.id),
    flowState: state,
  });
  const refreshResult = evidenceRefresh instanceof AcceptanceEvidenceRefresh
    ? evidenceRefresh.recover({
        specDir,
        flowManager,
        acceptancePath: path.join(specDir, ACCEPTANCE_REVIEW_ARTIFACT_FILE),
      })
    : null;
  if (refreshResult) {
    return {
      verdict: normalized.verdict,
      artifactPath: acceptanceArtifactPath(state),
      artifact: normalized,
      path: path.join(specDir, ACCEPTANCE_REVIEW_ARTIFACT_FILE),
      evidenceRefresh: refreshResult.toJSON(),
    };
  }
  const written = persistAcceptanceReviewArtifact({
    specDir,
    normalized,
    fingerprint,
  });
  const next = written.artifact;
  if (next.verdict === "repair_required") {
    const findings = next.requirementJudgments
      .filter((judgment) => judgment.status === "notMet")
      .map((judgment) => ({
        findingId: `acceptance:${judgment.requirementId}`,
        summary: `Acceptance judgment is notMet for ${judgment.requirementId}.`,
        suggestion: `Repair ${judgment.requirementId} and regenerate evidence.`,
      }));
    prepareImplTriageArtifact({
      specDir,
      sourceStep: "acceptance-review",
      sourceArtifact: ACCEPTANCE_REVIEW_ARTIFACT_FILE,
      findings,
      fingerprint,
    });
  }
  flowManager.mutate((current) => {
    current.acceptanceReview = {
      verdict: next.verdict,
      artifactPath: acceptanceArtifactPath(current),
      requirementJudgments: next.requirementJudgments,
      mechanicalBlockers: next.mechanicalBlockers,
      deferredFindings: next.deferredFindings,
      updatedAt: new Date().toISOString(),
    };
    if (next.verdict === "pass") {
      markStep(current, "acceptance-review", "done");
      markStep(current, "acceptance-decision", "done");
      markStep(current, "final-regression", "in_progress");
    } else if (next.verdict === "repair_required") {
      resetSteps(current, flowLeafIdsBetween("impl-triage", "finalize-cleanup"), "impl-triage");
      markStep(current, "acceptance-review", "done");
      markStep(current, "impl-triage", "in_progress");
    } else if (next.verdict === "user_decision_required") {
      markStep(current, "acceptance-review", "done");
      markStep(current, "acceptance-decision", "in_progress");
      markStep(current, "final-regression", "pending");
    } else {
      markStep(current, "acceptance-review", "in_progress");
      markStep(current, "acceptance-decision", "pending");
      markStep(current, "final-regression", "pending");
    }
  });
  return { verdict: next.verdict, artifactPath: acceptanceArtifactPath(state), artifact: next, path: written.path };
}

function appendRiskDecisionIssue(root, state, appendIssueLog) {
  appendIssueLog(root, state.spec, {
    step: "acceptance-decision",
    reason: "User explicitly selected accept_risk_and_continue for unresolved acceptance risk.",
    trigger: "flow set acceptance-decision",
    resolution: "continue to final-regression with accepted risk",
    taskId: null,
    timestamp: new Date().toISOString(),
  });
}

function appendRollbackError(rollbackError, cause) {
  return rollbackError == null
    ? cause
    : new AggregateError([rollbackError, cause], "acceptance decision rollback failed", { cause: rollbackError });
}

export function applyAcceptanceDecision({ root, flowManager, choice, appendIssueLog = appendIssueLogEntry }) {
  if (!USER_DECISION_CHOICES.has(choice)) throw new Error(`invalid acceptance decision choice: ${choice}`);
  const state = flowManager.load();
  if (!state?.spec) throw new Error("active flow spec is required");
  const registrySnapshot = state.worktree
    ? AcceptanceDecisionRegistrySnapshot.capture(flowManager, state)
    : null;
  ensureRepairFingerprintContract({ root, state, flowManager });
  const specDir = resolveSpecDir(path.resolve(root, state.spec));
  const issueLogSnapshot = AcceptanceDecisionIssueLogSnapshot.capture(specDir);
  const file = path.join(specDir, ACCEPTANCE_REVIEW_ARTIFACT_FILE);
  const artifact = readJson(file);
  const previousArtifact = clone(artifact);
  const previousState = clone(state);
  if (artifact.verdict !== "user_decision_required") {
    throw new Error(`acceptance-decision is not available for verdict: ${artifact.verdict}`);
  }
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec, state });
  assertRepairFingerprint({ artifact, fingerprint, label: ACCEPTANCE_REVIEW_ARTIFACT_FILE });
  const userDecision = { choice, decidedAt: new Date().toISOString() };
  artifact.userDecision = userDecision;
  const written = writeAcceptanceReviewArtifact({
    specDir,
    artifact,
    requirementIds: requirementList(specDir).map((entry) => entry.id),
    fingerprint,
    flowState: state,
  });
  const decidedArtifact = written.artifact;
  const mutateDecision = registrySnapshot == null
    ? (mutator) => flowManager.mutate(mutator)
    : (mutator) => {
      if (typeof flowManager.mutateExactTarget !== "function") {
        throw acceptanceDecisionRegistryError(
          "ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH",
          "managed-worktree acceptance decision requires exact target mutation",
        );
      }
      return flowManager.mutateExactTarget(registrySnapshot.target.expectation, mutator);
    };
  const rollbackDecision = registrySnapshot == null
    ? (mutator) => flowManager.mutate(mutator)
    : (mutator) => registrySnapshot.targetMutation.mutate(mutator);
  let stateMutated = false;
  let registryVerification = null;
  try {
    mutateDecision((current) => {
      current.acceptanceReview = current.acceptanceReview || { verdict: decidedArtifact.verdict };
      current.acceptanceReview.userDecision = userDecision;
      markStep(current, "acceptance-decision", "done");
      if (choice === "accept_risk_and_continue") markStep(current, "final-regression", "in_progress");
      else current.acceptanceReview.status = "aborted";
    });
    stateMutated = true;
    registryVerification = registrySnapshot?.verify(flowManager) ?? null;
    if (choice === "accept_risk_and_continue") appendRiskDecisionIssue(root, state, appendIssueLog);
  } catch (error) {
    let rollbackError = null;
    if (stateMutated) {
      try {
        rollbackDecision((current) => replaceState(current, previousState));
      } catch (cause) {
        rollbackError = cause;
      }
    }
    try {
      writeAcceptanceReviewArtifact({
        specDir,
        artifact: previousArtifact,
        requirementIds: requirementList(specDir).map((entry) => entry.id),
        fingerprint,
        flowState: previousState,
      });
    } catch (cause) {
      rollbackError = appendRollbackError(rollbackError, cause);
    }
    try {
      issueLogSnapshot.restore();
    } catch (cause) {
      rollbackError = appendRollbackError(rollbackError, cause);
    }
    if (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "acceptance decision registry verification and rollback both failed",
        { cause: error },
      );
    }
    throw error;
  }
  return {
    verdict: decidedArtifact.verdict,
    choice,
    userDecision,
    ...(registryVerification && { registryVerification }),
  };
}

export { ACCEPTANCE_FINAL_DISPOSITIONS };
