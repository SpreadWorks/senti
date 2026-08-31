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

function exactObject(value, keys, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `${field} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `${field} has an invalid schema`);
  }
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

/** A parent-selected, concrete spec-test repair surface. */
export class TestReviewRepairScope {
  constructor({ finding, testPaths = [] } = {}) {
    if (!(finding instanceof TestReviewRepairFinding)) throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "repair scope requires a canonical finding");
    const paths = [...new Set(testPaths)].sort();
    for (const candidate of paths) this.#assertTestPath(candidate);
    const raw = String(finding.document.target || "GLOBAL").trim().replaceAll("\\", "/");
    const explicit = this.#explicitPath(raw, paths);
    const uncoveredRequirement = /^R\d+$/i.test(raw);
    this.finding = finding;
    // A bare requirement id denotes uncovered coverage, so no existing test
    // can be claimed as its exact repair target. Create a deterministic new
    // spec-local test instead of modifying an arbitrary sorted file.
    this.targetFile = explicit ?? (uncoveredRequirement
      ? `repair-${finding.fingerprint.slice(0, 16)}.test.js`
      : paths[0] ?? `repair-${finding.fingerprint.slice(0, 16)}.test.js`);
    this.operation = explicit !== null || (!uncoveredRequirement && paths.length > 0) ? "modify" : "create";
    this.repairScope = requiredString(
      finding.document.requiredChange || finding.document.issue || finding.document.title,
      "test review repair scope", MAX_TEXT_LENGTH,
    );
    this.#assertTestPath(this.targetFile);
    Object.freeze(this);
  }

  #assertTestPath(value) {
    if (typeof value !== "string" || value.length === 0 || value.startsWith("/") || value.includes("\\")
      || value.split("/").some((part) => part === "" || part === "." || part === "..")
      || value.startsWith(".raw/") || !/\.(?:test|spec)\.(?:[cm]?js|ts)$/.test(value)) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "repair target must be a normalized spec test file");
    }
  }

  #explicitPath(raw, paths) {
    if (raw === "GLOBAL" || /^R\d+$/i.test(raw)) return null;
    const locator = raw.replace(/:(?:requirement|line)\b.*$/i, "").replace(/:(?:R\d+|\d+(?::\d+)?)$/i, "");
    if (paths.includes(locator)) return locator;
    if (locator.includes("/") || /\.(?:test|spec)\./.test(locator)) {
      this.#assertTestPath(locator);
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "explicit repair target is not a canonical spec test file");
    }
    return null;
  }

  toJSON() { return { finding: this.finding.toJSON(), targetFile: this.targetFile, operation: this.operation, repairScope: this.repairScope }; }

  static fromWorkerJSON(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).sort().join(",") !== "finding,operation,repairScope,targetFile") {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "worker-visible repair scope is invalid");
    }
    const finding = new TestReviewRepairFinding(value.finding);
    const scope = new TestReviewRepairScope({ finding, testPaths: value.operation === "modify" ? [value.targetFile] : [] });
    if (scope.targetFile !== value.targetFile || scope.operation !== value.operation || scope.repairScope !== value.repairScope) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "worker-visible repair scope does not satisfy canonical invariants");
    }
    return scope;
  }
}

/** Exact worker capability for one canonical test-review repair finding. */
export class WorkerVisibleTestReviewRepair {
  constructor(value = {}) {
    exactObject(value, [
      "version", "sourceStepId", "targetStepId", "sourceArtifact", "sourceAttempt",
      "sourceArtifactDigest", "sourceEvidenceId", "sourceTestRevision", "blockingFindings", "workerScope",
    ], "worker-visible selected repair contract");
    if (value.version !== 1 || value.sourceStepId !== "test-review" || value.targetStepId !== "test"
      || value.sourceArtifact !== "test-review.json" || !Number.isSafeInteger(value.sourceAttempt) || value.sourceAttempt < 1) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "worker-visible selected repair contract has invalid identity");
    }
    this.version = 1;
    this.sourceStepId = "test-review";
    this.targetStepId = "test";
    this.sourceArtifact = "test-review.json";
    this.sourceAttempt = value.sourceAttempt;
    this.sourceArtifactDigest = requiredDigest(value.sourceArtifactDigest, "worker-visible repair sourceArtifactDigest");
    this.sourceEvidenceId = requiredDigest(value.sourceEvidenceId, "worker-visible repair sourceEvidenceId");
    try {
      this.sourceTestRevision = WorkerArtifactRevision.from(value.sourceTestRevision);
    } catch (cause) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `worker-visible repair source revision is invalid: ${cause.message}`);
    }
    if (this.sourceTestRevision.stepId !== "test") {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "worker-visible repair source revision must belong to test");
    }
    if (!Array.isArray(value.blockingFindings) || value.blockingFindings.length !== 1) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "worker-visible selected repair contract requires one finding");
    }
    this.blockingFindings = Object.freeze(value.blockingFindings.map((finding) => new TestReviewRepairFinding(finding)));
    this.workerScope = TestReviewRepairScope.fromWorkerJSON(value.workerScope);
    if (this.workerScope.finding.findingId !== this.blockingFindings[0].findingId
      || this.workerScope.finding.fingerprint !== this.blockingFindings[0].fingerprint) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "worker-visible repair scope does not bind its selected finding");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      sourceStepId: this.sourceStepId,
      targetStepId: this.targetStepId,
      sourceArtifact: this.sourceArtifact,
      sourceAttempt: this.sourceAttempt,
      sourceArtifactDigest: this.sourceArtifactDigest,
      sourceEvidenceId: this.sourceEvidenceId,
      sourceTestRevision: this.sourceTestRevision.toJSON(),
      blockingFindings: this.blockingFindings.map((finding) => finding.toJSON()),
      workerScope: this.workerScope.toJSON(),
    };
  }
}

/** Parse the worker-visible subset without admitting an unchecked raw object. */
export function parseWorkerVisibleTestReviewRepair(value) {
  return value instanceof WorkerVisibleTestReviewRepair ? value : new WorkerVisibleTestReviewRepair(value);
}

/** A sealed handoff receipt that proves one repair finding was checkpointed. */
class TestReviewRepairProgressHandoff {
  constructor(value = {}) {
    exactObject(value, ["handoffDigest", "requestDigest", "payloadDigest"], "test review repair progress handoff");
    this.handoffDigest = requiredDigest(value.handoffDigest, "test review repair progress handoffDigest");
    this.requestDigest = requiredDigest(value.requestDigest, "test review repair progress requestDigest");
    this.payloadDigest = requiredDigest(value.payloadDigest, "test review repair progress payloadDigest");
    Object.freeze(this);
  }

  toJSON() {
    return {
      handoffDigest: this.handoffDigest,
      requestDigest: this.requestDigest,
      payloadDigest: this.payloadDigest,
    };
  }
}

class TestReviewRepairProgressEntry {
  constructor(value = {}) {
    exactObject(value, ["findingId", "fingerprint", "status", "handoff"], "test review repair progress entry");
    const { findingId, fingerprint, status = "pending", handoff = null } = value;
    this.findingId = requiredString(findingId, "test review repair progress findingId", 500);
    this.fingerprint = requiredDigest(fingerprint, "test review repair progress fingerprint");
    if (!["pending", "done"].includes(status)) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair progress status is invalid");
    }
    this.status = status;
    this.handoff = handoff === null ? null : handoff instanceof TestReviewRepairProgressHandoff
      ? handoff
      : new TestReviewRepairProgressHandoff(handoff);
    if ((this.status === "done") !== (this.handoff !== null)) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair progress completion receipt is invalid");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      fingerprint: this.fingerprint,
      status: this.status,
      handoff: this.handoff?.toJSON() ?? null,
    };
  }
}

/**
 * Binds compact canonical evidence to the rich, sealed test-review artifact.
 * Review evidence intentionally records only stable review identities.  Repair
 * needs the original target and requested change, so it may use them only
 * after count, order, and immutable identity agree with that evidence.
 */
class CanonicalTestReviewRepairFindingBinding {
  constructor({ evidenceFindings, artifactFindings } = {}) {
    if (!Array.isArray(evidenceFindings) || !Array.isArray(artifactFindings)
      || evidenceFindings.length === 0 || evidenceFindings.length !== artifactFindings.length) {
      throw new TestReviewRepairError(
        "TEST_REVIEW_REPAIR_EVIDENCE_INVALID",
        "canonical test-review evidence must bind every original blocking finding",
      );
    }
    this.findings = Object.freeze(artifactFindings.map((artifactFinding, index) => {
      const evidenceFinding = evidenceFindings[index];
      const finding = new TestReviewRepairFinding(artifactFinding);
      if (evidenceFinding === null || typeof evidenceFinding !== "object" || Array.isArray(evidenceFinding)
        || finding.findingId !== evidenceFinding.findingId || finding.fingerprint !== evidenceFinding.fingerprint) {
        throw new TestReviewRepairError(
          "TEST_REVIEW_REPAIR_EVIDENCE_INVALID",
          "canonical test-review evidence does not match its original blocking finding",
        );
      }
      return finding;
    }));
    Object.freeze(this);
  }
}

/** A structurally complete persisted repair episode, before matching it to current evidence. */
class TestReviewRepairProgressEpisode {
  constructor(value = {}) {
    exactObject(value, ["version", "sourceArtifactDigest", "sourceEvidenceId", "sourceTestRevision", "entries"], "test review repair progress artifact");
    if (value.version !== 1) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair progress version is invalid");
    }
    this.version = 1;
    this.sourceArtifactDigest = requiredDigest(value.sourceArtifactDigest, "test review repair progress sourceArtifactDigest");
    this.sourceEvidenceId = requiredDigest(value.sourceEvidenceId, "test review repair progress sourceEvidenceId");
    try {
      this.sourceTestRevision = WorkerArtifactRevision.from(value.sourceTestRevision);
    } catch (cause) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `test review repair progress source revision is invalid: ${cause.message}`);
    }
    if (this.sourceTestRevision.stepId !== "test") {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair progress source revision must belong to test");
    }
    if (!Array.isArray(value.entries) || value.entries.length === 0) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair progress entries are invalid");
    }
    this.entries = Object.freeze(value.entries.map((entry) => new TestReviewRepairProgressEntry(entry)));
    if (new Set(this.entries.map((entry) => entry.findingId)).size !== this.entries.length) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair progress duplicates a finding");
    }
    Object.freeze(this);
  }

  static fromJSON(value) { return new TestReviewRepairProgressEpisode(value); }

  assertFlow(state) {
    try {
      this.sourceTestRevision.assertFlow(state);
    } catch (cause) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `test review repair progress lineage is invalid: ${cause.message}`);
    }
    return this;
  }

  matchesArtifact(repair) { return this.sourceArtifactDigest === repair.sourceArtifactDigest; }

  materialize(repair) {
    if (!this.matchesArtifact(repair)
      || this.sourceEvidenceId !== repair.sourceEvidenceId
      || JSON.stringify(this.sourceTestRevision.toJSON()) !== JSON.stringify(repair.sourceTestRevision.toJSON())) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_STALE", "test review repair progress belongs to different canonical evidence");
    }
    return new TestReviewRepairProgress({ repair, entries: this.entries });
  }
}

/** Canonical, parent-owned checkpoint for a frozen review repair episode. */
export class TestReviewRepairProgress {
  constructor({ repair, entries } = {}) {
    if (!(repair instanceof CanonicalTestReviewRepair)) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair progress requires canonical repair evidence");
    }
    if (!Array.isArray(entries) || entries.length !== repair.blockingFindings.length) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair progress entries do not match findings");
    }
    this.version = 1;
    this.sourceArtifactDigest = repair.sourceArtifactDigest;
    this.sourceEvidenceId = repair.sourceEvidenceId;
    this.sourceTestRevision = repair.sourceTestRevision.toJSON();
    this.entries = Object.freeze(entries.map((entry) => entry instanceof TestReviewRepairProgressEntry
      ? entry : new TestReviewRepairProgressEntry(entry)));
    for (const finding of repair.blockingFindings) {
      const entry = this.entries.find((candidate) => candidate.findingId === finding.findingId);
      if (!entry || entry.fingerprint !== finding.fingerprint) {
        throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair progress does not bind canonical findings");
      }
    }
    if (new Set(this.entries.map((entry) => entry.findingId)).size !== this.entries.length) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair progress duplicates a finding");
    }
    Object.freeze(this);
  }

  static start(repair) {
    return new TestReviewRepairProgress({ repair, entries: repair.blockingFindings.map((finding) => ({
      findingId: finding.findingId, fingerprint: finding.fingerprint, status: "pending", handoff: null,
    })) });
  }

  static fromJSON(value, repair) {
    return TestReviewRepairProgressEpisode.fromJSON(value).materialize(repair);
  }

  nextFinding(repair) {
    const entry = this.entries.find((candidate) => candidate.status === "pending") ?? null;
    return entry === null ? null : repair.blockingFindings.find((finding) => finding.findingId === entry.findingId) ?? null;
  }

  markComplete(repair, findingId, handoff) {
    const current = this.entries.find((entry) => entry.findingId === findingId);
    if (!current || current.status !== "pending") {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test review repair completion does not target a pending finding");
    }
    return new TestReviewRepairProgress({ repair, entries: this.entries.map((entry) => (
      entry.findingId === findingId
        ? new TestReviewRepairProgressEntry({ findingId: entry.findingId, fingerprint: entry.fingerprint, status: "done", handoff })
        : entry
    )) });
  }

  get complete() { return this.entries.every((entry) => entry.status === "done"); }
  toJSON() { return { version: this.version, sourceArtifactDigest: this.sourceArtifactDigest, sourceEvidenceId: this.sourceEvidenceId, sourceTestRevision: this.sourceTestRevision, entries: this.entries.map((entry) => entry.toJSON()) }; }
}

/**
 * Recognize a committed checkpoint from the sealed request capability alone.
 * This intentionally does not rebind the request to current repair state:
 * after publication, current progress has advanced and the old request must
 * still be identifiable for replay cleanup.
 */
export function testReviewRepairProgressReceiptForSelectedContract({
  state, progressDocument, selectedContract, requestDigest,
} = {}) {
  const selected = parseWorkerVisibleTestReviewRepair(selectedContract);
  const episode = TestReviewRepairProgressEpisode.fromJSON(progressDocument).assertFlow(state);
  if (episode.sourceArtifactDigest !== selected.sourceArtifactDigest
    || episode.sourceEvidenceId !== selected.sourceEvidenceId
    || JSON.stringify(episode.sourceTestRevision.toJSON()) !== JSON.stringify(selected.sourceTestRevision.toJSON())) {
    return null;
  }
  const selectedFinding = selected.blockingFindings[0];
  const entry = episode.entries.find((candidate) => (
    candidate.findingId === selectedFinding.findingId
    && candidate.fingerprint === selectedFinding.fingerprint
    && candidate.handoff?.requestDigest === requestDigest
  ));
  return entry?.handoff?.handoffDigest ?? null;
}

/** Resolve only the progress record owned by this immutable review episode. */
export function canonicalTestReviewRepairProgress({ flowManager, state, repair, consumerNodeId } = {}) {
  const artifact = flowManager.readArtifact({
    specId: state.specId,
    logicalKey: "test.review.repair.progress",
    consumerNodeId,
    optional: true,
  });
  if (artifact === null) return TestReviewRepairProgress.start(repair);
  let value;
  try {
    value = JSON.parse(artifact.bytes.toString("utf8"));
  } catch (cause) {
    throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", `test review repair progress is not JSON: ${cause.message}`);
  }
  // Validate the complete persisted episode before deciding whether it belongs
  // to current evidence. A digest mismatch is ordinary immutable history;
  // malformed or unbound history is never a reason to silently reset state.
  const episode = TestReviewRepairProgressEpisode.fromJSON(value).assertFlow(state);
  if (!episode.matchesArtifact(repair)) return TestReviewRepairProgress.start(repair);
  return episode.materialize(repair);
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

  /**
   * A repair worker is deliberately scoped to one finding.  The parent keeps
   * the complete canonical evidence and chooses subsequent work units.
   */
  forFinding(findingId, testPaths = []) {
    const finding = this.blockingFindings.find((entry) => entry.findingId === findingId);
    if (!finding) {
      throw new TestReviewRepairError("TEST_REVIEW_REPAIR_INVALID", "test-review repair finding is not canonical evidence");
    }
    const value = this.toWorkerJSON();
    value.blockingFindings = [finding.toJSON()];
    value.workerScope = new TestReviewRepairScope({ finding, testPaths }).toJSON();
    return new WorkerVisibleTestReviewRepair(value);
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
  const artifactRevision = WorkerArtifactRevision.from(artifact.sourceTestArtifactRevision);
  const findingBinding = new CanonicalTestReviewRepairFindingBinding({
    evidenceFindings: evidence.blockingFindings,
    artifactFindings: artifact.blockingFindings,
  });
  const repair = new CanonicalTestReviewRepair({
    state,
    attempt: current.attempt,
    artifactDigest: current.descriptor.hash,
    evidenceId: evidence.identity.evidenceDigest,
    sourceTestRevision: artifactRevision.toJSON(),
    blockingFindings: findingBinding.findings,
  });
  const progress = canonicalTestReviewRepairProgress({ flowManager, state, repair, consumerNodeId });
  // A checkpoint is published atomically with the repaired test tree, but it
  // deliberately keeps the test Attempt open for the next finding.  Such a
  // tree does not yet have the final confirmation required by
  // CanonicalTestSourceRevision.  The checkpoint is the canonical authority
  // for that in-progress repair episode; only a fresh episode needs the
  // fully-finalized tree comparison.
  if (progress.entries.every((entry) => entry.status === "pending") && artifactRevision.digest !== store.testSourceRevision().digest) {
    throw new TestReviewRepairError(
      "TEST_REVIEW_REPAIR_REVISION_MISMATCH",
      "cataloged test-review evidence targets a stale test revision",
    );
  }
  return repair;
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
