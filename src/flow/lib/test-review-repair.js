import { CanonicalTestArtifactStore } from "./canonical-test-artifacts.js";
import { canonicalRepairAttemptOwner } from "./repair-attempt-lineage.js";
import { WorkerArtifactRevision } from "./worker-artifact-revision.js";

const SHA256 = /^[a-f0-9]{64}$/;
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

function frozenDocument(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `${field} must be an object`);
  }
  return Object.freeze(structuredClone(value));
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

  toJSON() { return structuredClone(this.document); }
}

/**
 * Catalog-backed repair evidence for the schema-revision-three runtime.
 * The worker-visible shape stays stable, but identity comes solely from the
 * review Attempt, catalog descriptor, and current cataloged test tree.
 */
export class CanonicalTestReviewRepair {
  constructor({ state, attempt, artifactDigest, evidenceId, sourceTestRevision, blockingFindings } = {}) {
    if (state?.schemaRevision !== 3) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test-review repair requires a Version-1 Flow");
    }
    this.version = 1;
    this.runId = requiredString(state.runId, "test review repair runId", 500);
    this.specId = requiredString(state.specId, "test review repair specId", 500);
    this.sourceStepId = "test-review";
    this.targetStepId = "test";
    this.sourceArtifact = "test-review.json";
    this.sourceAttempt = Number(attempt);
    if (!Number.isSafeInteger(this.sourceAttempt) || this.sourceAttempt < 1) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair source Attempt is invalid");
    }
    this.sourceArtifactDigest = requiredDigest(artifactDigest, "test review repair sourceArtifactDigest");
    this.sourceEvidenceId = requiredDigest(evidenceId, "test review repair sourceEvidenceId");
    this.sourceTestRevision = WorkerArtifactRevision.from(sourceTestRevision);
    if (this.sourceTestRevision.stepId !== "test") {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair source revision must belong to test");
    }
    if (!Array.isArray(blockingFindings) || blockingFindings.length === 0) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair requires blocking findings");
    }
    this.blockingFindings = Object.freeze(blockingFindings.map((finding) => (
      finding instanceof TestReviewRepairFinding ? finding : new TestReviewRepairFinding(finding)
    )));
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      sourceStepId: this.sourceStepId,
      targetStepId: this.targetStepId,
      sourceArtifact: this.sourceArtifact,
      sourceAttempt: this.sourceAttempt,
      sourceArtifactDigest: this.sourceArtifactDigest,
      sourceEvidenceId: this.sourceEvidenceId,
      sourceTestRevision: this.sourceTestRevision.toJSON(),
      blockingFindings: this.blockingFindings.map((finding) => finding.toJSON()),
    };
  }

  toWorkerJSON() {
    const value = this.toJSON();
    delete value.runId;
    delete value.specId;
    return value;
  }

  references() {
    return {
      evaluations: [],
      findings: this.blockingFindings.map((finding) => ({ id: finding.findingId, label: "test-review" })),
      repairs: [],
      artifacts: [
        { id: this.sourceArtifactDigest, label: "test.review" },
        { id: this.sourceTestRevision.digest, label: "tests.source" },
      ],
    };
  }
}

function repairFromCatalog({ flowManager, state, consumerNodeId, reviewAttemptSequence = null }) {
  const store = new CanonicalTestArtifactStore({ flowManager, state });
  const current = store.readCurrentAttempt({ logicalKey: "test.review", consumerNodeId });
  if (reviewAttemptSequence !== null && current.attempt < reviewAttemptSequence) return null;
  if (reviewAttemptSequence !== null && current.attempt > reviewAttemptSequence) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_ATTEMPT_MISMATCH",
      "cataloged test-review evidence belongs to a future review Attempt",
    );
  }
  const artifact = current.payload;
  const evidence = artifact?.canonicalEvidence;
  if (
    artifact?.phase !== "test"
    || artifact?.verdict !== "REJECTED"
    || evidence?.disposition !== "REJECTED"
    || !Array.isArray(evidence.blockingFindings)
    || evidence.blockingFindings.length === 0
    || !SHA256.test(evidence?.identity?.evidenceDigest || "")
  ) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_EVIDENCE_INVALID",
      "cataloged test-review evidence must be a REJECTED review with blocking findings",
    );
  }
  const revision = store.testSourceRevision();
  const artifactRevision = WorkerArtifactRevision.from(artifact.sourceTestArtifactRevision);
  if (artifactRevision.digest !== revision.digest) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_REVISION_MISMATCH",
      "cataloged test-review evidence targets a stale test revision",
    );
  }
  return new CanonicalTestReviewRepair({
    state,
    attempt: current.attempt,
    artifactDigest: current.descriptor.hash,
    evidenceId: evidence.identity.evidenceDigest,
    sourceTestRevision: revision.toJSON(),
    blockingFindings: evidence.blockingFindings,
  });
}

export function inspectCanonicalTestReviewRepair({ flowManager, state } = {}) {
  if (state?.schemaRevision !== 3 || state.currentNodeId !== "test-review") return null;
  const typedState = typeof flowManager.canonicalState === "function"
    ? flowManager.canonicalState(state.specId)
    : state;
  return repairFromCatalog({
    flowManager,
    state: typedState,
    consumerNodeId: "test-review",
    reviewAttemptSequence: typedState.attempt.sequence,
  });
}

export function canonicalTestReviewRepairForTarget({ flowManager, state, targetStepId } = {}) {
  if (state?.schemaRevision !== 3 || targetStepId !== "test" || state.currentNodeId !== "test") return null;
  const typedState = typeof flowManager.canonicalState === "function"
    ? flowManager.canonicalState(state.specId)
    : state;
  const activity = canonicalRepairAttemptOwner({
    state: typedState,
    activities: flowManager.activityLedger(state.specId),
    targetStepId,
  });
  if (activity?.transition?.operation !== "repair_test_review") return null;
  const repair = repairFromCatalog({ flowManager, state: typedState, consumerNodeId: "test" });
  if (!activity.references?.artifacts?.some((reference) => reference.id === repair.sourceArtifactDigest)) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_STALE",
      "test-review repair Activity does not reference the current review evidence",
    );
  }
  return repair;
}

/** Retired state-blob APIs remain explicit rejection points during alpha. */
export class TestReviewRepairRecord {
  constructor() {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_INVALID",
      "mutable test-review repair records are retired; use the canonical Activity and catalog",
    );
  }
  static from(value) { return new TestReviewRepairRecord(value); }
  static forTarget() { return null; }
}

export class TestReviewRepairCompletion extends TestReviewRepairRecord {}

export function inspectTestReviewRepair() { return null; }
