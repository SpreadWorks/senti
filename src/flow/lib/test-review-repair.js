import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { findActiveNode } from "../definition.js";
import { ReviewTargetAuthority } from "./review-target-authority.js";
import { WorkerArtifactRevision } from "./worker-artifact-revision.js";

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_ARTIFACT_BYTES = 2 * 1024 * 1024;
const MAX_FINDINGS = 100;
const MAX_TEXT_LENGTH = 4000;

function requiredString(value, field, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `${field} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `${field} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function requiredDigest(value, field) {
  const digest = requiredString(value, field, 64);
  if (!SHA256.test(digest)) {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `${field} must be a SHA-256 digest`);
  }
  return digest;
}

function requiredTimestamp(value, field) {
  const timestamp = requiredString(value, field, 100);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `${field} must be an ISO timestamp`);
  }
  return new Date(Date.parse(timestamp)).toISOString();
}

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function frozenDocument(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `${field} must be an object`);
  }
  return deepFreeze(structuredClone(value));
}

function findingIdentity(finding) {
  return `${finding?.findingId}\u0000${finding?.fingerprint}`;
}

function hasDuplicateFindingField(findings, field) {
  const values = findings.map((finding) => finding?.[field]);
  return new Set(values).size !== values.length;
}

export class TestReviewRepairError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "TestReviewRepairError";
    this.code = code;
  }
}

export class TestReviewRepairFinding {
  constructor(input = {}) {
    this.findingId = requiredString(input.findingId, "test review repair findingId", 500);
    this.fingerprint = requiredDigest(input.fingerprint, "test review repair finding fingerprint");
    this.document = frozenDocument(input, "test review repair finding");
    Object.freeze(this);
  }

  toJSON() {
    return structuredClone(this.document);
  }
}

function flowIssue(state) {
  return Object.hasOwn(state || {}, "issue") ? state.issue : null;
}

function latestTestReviewRecord(state, { treeSha, targetStateDigest }) {
  const records = Array.isArray(state?.reviewConvergence?.records)
    ? state.reviewConvergence.records
    : [];
  return [...records].reverse().find((record) => (
    record?.phase === "test"
    && record?.taskId == null
    && record?.treeSha === treeSha
    && record?.targetStateDigest === targetStateDigest
  )) || null;
}

function readTestReviewArtifact(root, state) {
  const specDir = resolveSpecDir(path.resolve(root, relativeFlowSpecFile(state)));
  const file = path.join(specDir, "test-review.json");
  let stat;
  try {
    stat = fs.lstatSync(file);
  } catch (cause) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_EVIDENCE_MISSING",
      `canonical test-review evidence is unavailable: ${cause.message}`,
    );
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_ARTIFACT_BYTES) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_EVIDENCE_INVALID",
      "canonical test-review evidence must be a bounded regular file",
    );
  }
  const bytes = fs.readFileSync(file);
  let artifact;
  try {
    artifact = JSON.parse(bytes.toString("utf8"));
  } catch (cause) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_EVIDENCE_INVALID",
      `canonical test-review evidence is malformed JSON: ${cause.message}`,
    );
  }
  if (
    artifact?.phase !== "test"
    || artifact?.verdict !== "REJECTED"
    || !Array.isArray(artifact.blockingFindings)
    || !Array.isArray(artifact.advisoryFindings)
    || artifact.blockingFindings.length === 0
    || artifact.blockingFindings.length + artifact.advisoryFindings.length > MAX_FINDINGS
    || artifact.toolingOutcome != null
  ) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_EVIDENCE_INVALID",
      "canonical test-review evidence must be a REJECTED test review with blocking findings",
    );
  }
  let artifactTestRevision;
  try {
    artifactTestRevision = WorkerArtifactRevision.from(artifact.sourceTestArtifactRevision);
    artifactTestRevision.assertFlow(state);
  } catch (cause) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_REVISION_MISMATCH",
      `canonical test-review evidence has no valid source test revision: ${cause.message}`,
    );
  }
  if (artifactTestRevision.stepId !== "test") {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_REVISION_MISMATCH",
      "canonical test-review evidence source revision does not belong to test",
    );
  }
  const blockingFindings = artifact.blockingFindings.map((finding) => new TestReviewRepairFinding(finding));
  const advisoryFindings = artifact.advisoryFindings.map((finding) => new TestReviewRepairFinding(finding));
  const findings = [...blockingFindings, ...advisoryFindings];
  for (const field of ["findingId", "fingerprint"]) {
    if (hasDuplicateFindingField(findings, field)) {
      throw new TestReviewRepairError(
        "TEST_REVIEW_REPAIR_EVIDENCE_INVALID",
        `canonical test-review evidence contains duplicate ${field} values`,
      );
    }
  }
  return {
    artifact,
    artifactDigest: digest(bytes),
    artifactTestRevision,
    blockingFindings,
    advisoryFindings,
    findings,
  };
}

export class TestReviewRepairRecord {
  constructor(input = {}) {
    if (input.version !== 1) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair version must be 1");
    }
    this.version = 1;
    this.runId = requiredString(input.runId, "test review repair runId", 500);
    this.specId = requiredString(input.specId, "test review repair specId", 500);
    this.issue = input.issue == null ? null : Number(input.issue);
    if (this.issue != null && (!Number.isSafeInteger(this.issue) || this.issue <= 0)) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair issue must be a positive integer or null");
    }
    this.sourceStepId = requiredString(input.sourceStepId, "test review repair sourceStepId", 100);
    this.targetStepId = requiredString(input.targetStepId, "test review repair targetStepId", 100);
    if (this.sourceStepId !== "test-review" || this.targetStepId !== "test") {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair route must be test-review to test");
    }
    this.sourceArtifact = requiredString(input.sourceArtifact, "test review repair sourceArtifact", 500);
    if (this.sourceArtifact !== "test-review.json") {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair source artifact must be test-review.json");
    }
    this.sourceArtifactDigest = requiredDigest(input.sourceArtifactDigest, "test review repair sourceArtifactDigest");
    this.sourceEvidenceId = requiredDigest(input.sourceEvidenceId, "test review repair sourceEvidenceId");
    this.sourceTargetStateDigest = requiredDigest(input.sourceTargetStateDigest, "test review repair sourceTargetStateDigest");
    this.sourceTestRevision = WorkerArtifactRevision.from(input.sourceTestRevision);
    if (this.sourceTestRevision.stepId !== "test") {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair source revision must belong to test");
    }
    if (!Array.isArray(input.blockingFindings) || input.blockingFindings.length === 0) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair requires blocking findings");
    }
    if (input.blockingFindings.length > MAX_FINDINGS) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `test review repair findings exceed ${MAX_FINDINGS}`);
    }
    this.blockingFindings = Object.freeze(input.blockingFindings.map((finding) => (
      finding instanceof TestReviewRepairFinding ? finding : new TestReviewRepairFinding(finding)
    )));
    if (new Set(this.blockingFindings.map((finding) => finding.findingId)).size !== this.blockingFindings.length) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair findings contain duplicate findingId values");
    }
    if (new Set(this.blockingFindings.map((finding) => finding.fingerprint)).size !== this.blockingFindings.length) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair findings contain duplicate fingerprint values");
    }
    this.requestedAt = requiredTimestamp(input.requestedAt, "test review repair requestedAt");
    Object.freeze(this);
  }

  static create({ state, source, requestedAt = new Date().toISOString() }) {
    return new TestReviewRepairRecord({
      version: 1,
      runId: state?.runId,
      specId: state?.specId,
      issue: flowIssue(state),
      sourceStepId: "test-review",
      targetStepId: "test",
      sourceArtifact: "test-review.json",
      sourceArtifactDigest: source.artifactDigest,
      sourceEvidenceId: source.reviewRecord.evidence.evidenceId,
      sourceTargetStateDigest: source.reviewRecord.targetStateDigest,
      sourceTestRevision: source.testRevision.toJSON(),
      blockingFindings: source.blockingFindings,
      requestedAt,
    });
  }

  static from(value) {
    return value instanceof TestReviewRepairRecord ? value : new TestReviewRepairRecord(value);
  }

  static forTarget(state, stepId) {
    if (state?.testReviewRepair == null || stepId !== "test") return null;
    const record = TestReviewRepairRecord.from(state.testReviewRepair);
    record.assertActiveState(state);
    return record;
  }

  assertFlow(state) {
    if (
      state?.runId !== this.runId
      || state?.specId !== this.specId
      || flowIssue(state) !== this.issue
    ) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_STALE", "test review repair does not match Flow identity");
    }
  }

  assertActiveState(state) {
    this.assertFlow(state);
    const revision = WorkerArtifactRevision.from(state?.specTestArtifactRevision);
    if (revision.digest !== this.sourceTestRevision.digest) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_STALE", "test review repair source test revision changed");
    }
  }

  matchesSource(source) {
    return source?.artifactDigest === this.sourceArtifactDigest
      && source?.reviewRecord?.evidence?.evidenceId === this.sourceEvidenceId
      && source?.reviewRecord?.targetStateDigest === this.sourceTargetStateDigest
      && source?.testRevision?.digest === this.sourceTestRevision.digest;
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      issue: this.issue,
      sourceStepId: this.sourceStepId,
      targetStepId: this.targetStepId,
      sourceArtifact: this.sourceArtifact,
      sourceArtifactDigest: this.sourceArtifactDigest,
      sourceEvidenceId: this.sourceEvidenceId,
      sourceTargetStateDigest: this.sourceTargetStateDigest,
      sourceTestRevision: this.sourceTestRevision.toJSON(),
      blockingFindings: this.blockingFindings.map((finding) => finding.toJSON()),
      requestedAt: this.requestedAt,
    };
  }

  toWorkerJSON() {
    return {
      sourceArtifact: this.sourceArtifact,
      sourceArtifactDigest: this.sourceArtifactDigest,
      sourceEvidenceId: this.sourceEvidenceId,
      sourceTargetStateDigest: this.sourceTargetStateDigest,
      sourceTestRevision: this.sourceTestRevision.toJSON(),
      blockingFindings: this.blockingFindings.map((finding) => finding.toJSON()),
    };
  }
}

export class TestReviewRepairCompletion {
  constructor(input = {}) {
    if (input.version !== 1) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair completion version must be 1");
    }
    this.version = 1;
    this.repair = TestReviewRepairRecord.from(input.repair);
    this.publishedTestRevisionDigest = requiredDigest(
      input.publishedTestRevisionDigest,
      "test review repair publishedTestRevisionDigest",
    );
    if (this.publishedTestRevisionDigest === this.repair.sourceTestRevision.digest) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_NO_PROGRESS", "test review repair completion requires a new test revision");
    }
    this.handoffDigest = requiredDigest(input.handoffDigest, "test review repair handoffDigest");
    this.completedAt = requiredTimestamp(input.completedAt, "test review repair completedAt");
    Object.freeze(this);
  }

  static from(value) {
    return value instanceof TestReviewRepairCompletion
      ? value
      : new TestReviewRepairCompletion(value);
  }

  toJSON() {
    return {
      version: this.version,
      repair: this.repair.toJSON(),
      publishedTestRevisionDigest: this.publishedTestRevisionDigest,
      handoffDigest: this.handoffDigest,
      completedAt: this.completedAt,
    };
  }
}

export function inspectTestReviewRepair({ root, executionRoot = root, state }) {
  if (findActiveNode(state)?.stepId !== "test-review") return null;
  if (state.testReviewRepair != null) {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_CONFLICT", "another test review repair is already active");
  }
  let testRevision;
  try {
    testRevision = WorkerArtifactRevision.from(state.specTestArtifactRevision);
    testRevision.assertFlow(state);
  } catch (cause) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_REVISION_MISSING",
      `test review repair requires the current canonical test revision: ${cause.message}`,
    );
  }
  if (testRevision.stepId !== "test") {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_REVISION_MISMATCH", "canonical test revision does not belong to the test step");
  }
  const authority = new ReviewTargetAuthority({
    executionRoot,
    artifactRoot: root,
    flowState: state,
  });
  const treeSha = authority.resolveTreeSha();
  const targetState = authority.captureTargetStateForPhase("test");
  const reviewRecord = latestTestReviewRecord(state, {
    treeSha,
    targetStateDigest: targetState.digest,
  });
  if (
    reviewRecord?.evidence?.disposition !== "REJECTED"
    || !Number.isSafeInteger(reviewRecord.semanticAttempts)
    || !Number.isSafeInteger(reviewRecord.semanticMaxAttempts)
    || reviewRecord.semanticAttempts < 1
    || reviewRecord.semanticAttempts >= reviewRecord.semanticMaxAttempts
    || !SHA256.test(reviewRecord.evidence?.evidenceId || "")
    || !Array.isArray(reviewRecord.handoffFindings)
    || reviewRecord.handoffFindings.length === 0
  ) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_CONVERGENCE_MISMATCH",
      "current test-review convergence does not authorize a semantic repair",
    );
  }
  const artifact = readTestReviewArtifact(root, state);
  if (artifact.artifactTestRevision.digest !== testRevision.digest) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_REVISION_MISMATCH",
      "canonical test-review evidence targets a stale canonical test revision",
    );
  }
  const artifactFindingIdentities = new Set(artifact.findings.map(findingIdentity));
  const convergenceFindingIdentities = new Set(reviewRecord.handoffFindings.map(findingIdentity));
  if (
    reviewRecord.handoffFindings.length !== artifact.findings.length
    || ["findingId", "fingerprint"].some((field) => (
      hasDuplicateFindingField(reviewRecord.handoffFindings, field)
    ))
    || artifactFindingIdentities.size !== convergenceFindingIdentities.size
    || [...artifactFindingIdentities].some((identity) => !convergenceFindingIdentities.has(identity))
  ) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_FINDINGS_MISMATCH",
      "canonical test-review findings do not match the current convergence evidence",
    );
  }
  return Object.freeze({
    ...artifact,
    reviewRecord,
    testRevision,
    reason: reviewRecord.blocker?.reason
      || "Blocking test-review findings require a changed canonical test revision before review can continue.",
  });
}
