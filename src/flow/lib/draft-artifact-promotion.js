import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { AtomicFile } from "../../lib/atomic-file.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";
import { StepTransitionCommitIntent } from "./step-transition-policy.js";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DRAFT_ARTIFACT_VERSION = 1;
export const DRAFT_ARTIFACT_FAILURE_MARKER_PREFIX = "SENTI_DRAFT_ARTIFACT_FAILURE ";

export const DRAFT_ARTIFACT_WRITER_STEPS = Object.freeze([
  "draft",
  "draft-questions-repair",
  "draft-refine",
  "draft-coverage-repair",
]);

const DRAFT_ARTIFACT_WRITER_STEP_SET = new Set(DRAFT_ARTIFACT_WRITER_STEPS);
const REVIEW_SOURCE_STEPS = Object.freeze({
  "draft-questions": new Set(["draft", "draft-questions-repair"]),
  "draft-coverage": new Set(["draft-refine", "draft-coverage-repair"]),
});

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function requireDigest(value, field) {
  const digest = requireString(value, field);
  if (!SHA256_PATTERN.test(digest)) throw new Error(`${field} must be a SHA-256 digest`);
  return digest;
}

function requireByteLength(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive safe integer`);
  }
  return value;
}

function requireIsoTimestamp(value, field) {
  const timestamp = requireString(value, field);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${field} must be an ISO timestamp`);
  return timestamp;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function draftArtifactPath(root, state) {
  return path.join(
    path.dirname(path.resolve(root, relativeFlowSpecFile(state))),
    "draft.json",
  );
}

export class DraftArtifactRecoveryError extends Error {
  constructor(code, message, { recoveryCommand = null, cause = null, data = {} } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "DraftArtifactRecoveryError";
    this.code = requireString(code, "draft artifact error code");
    this.recoveryCommand = recoveryCommand == null
      ? null
      : requireString(recoveryCommand, "draft artifact recovery command");
    this.data = Object.freeze({ ...data });
  }

  toMarkerLine() {
    return DRAFT_ARTIFACT_FAILURE_MARKER_PREFIX + JSON.stringify({
      code: this.code,
      message: this.message,
      recoveryCommand: this.recoveryCommand,
      data: this.data,
      retryBudgetConsumed: false,
    });
  }

  static fromMarkerLine(line) {
    if (typeof line !== "string" || !line.startsWith(DRAFT_ARTIFACT_FAILURE_MARKER_PREFIX)) {
      return null;
    }
    try {
      const input = JSON.parse(line.slice(DRAFT_ARTIFACT_FAILURE_MARKER_PREFIX.length));
      return new DraftArtifactRecoveryError(input.code, input.message, {
        recoveryCommand: input.recoveryCommand,
        data: input.data,
      });
    } catch {
      return null;
    }
  }
}

export class DraftArtifactSnapshot {
  constructor({ filePath, bytes }) {
    this.filePath = path.resolve(requireString(filePath, "draft artifact path"));
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw new Error("draft artifact bytes must be a non-empty Buffer");
    }
    let parsed;
    try {
      parsed = JSON.parse(bytes.toString("utf8"));
    } catch (cause) {
      throw new DraftArtifactRecoveryError(
        "DRAFT_ARTIFACT_INVALID",
        `draft artifact is not valid JSON: ${this.filePath}: ${cause.message}`,
        { cause },
      );
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new DraftArtifactRecoveryError(
        "DRAFT_ARTIFACT_INVALID",
        `draft artifact must contain a JSON object: ${this.filePath}`,
      );
    }
    this.bytes = Buffer.from(bytes);
    this.digest = sha256(this.bytes);
    this.byteLength = this.bytes.length;
    this.document = deepFreeze(structuredClone(parsed));
    Object.freeze(this);
  }
}

export class DraftArtifactRevision {
  constructor(input = {}) {
    if (input.version !== DRAFT_ARTIFACT_VERSION) {
      throw new Error(`draft artifact revision version must be ${DRAFT_ARTIFACT_VERSION}`);
    }
    this.version = DRAFT_ARTIFACT_VERSION;
    this.runId = requireString(input.runId, "draft artifact revision runId");
    this.specId = requireString(input.specId, "draft artifact revision specId");
    this.sourceStepId = requireString(input.sourceStepId, "draft artifact revision sourceStepId");
    this.digest = requireDigest(input.digest, "draft artifact revision digest");
    this.byteLength = requireByteLength(input.byteLength, "draft artifact revision byteLength");
    this.finalizedAt = requireIsoTimestamp(input.finalizedAt, "draft artifact revision finalizedAt");
    Object.freeze(this);
  }

  static from(value) {
    return value instanceof DraftArtifactRevision ? value : new DraftArtifactRevision(value);
  }

  assertFlow(state) {
    if (state?.runId !== this.runId || state?.specId !== this.specId) {
      throw new DraftArtifactRecoveryError(
        "DRAFT_ARTIFACT_BINDING_MISMATCH",
        "draft artifact revision does not match the active Flow target",
      );
    }
  }

  matchesSnapshot(snapshot) {
    return snapshot.digest === this.digest && snapshot.byteLength === this.byteLength;
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      sourceStepId: this.sourceStepId,
      digest: this.digest,
      byteLength: this.byteLength,
      finalizedAt: this.finalizedAt,
    };
  }
}

export class DraftArtifactPromotion {
  constructor(input = {}) {
    if (input.version !== DRAFT_ARTIFACT_VERSION) {
      throw new Error(`draft artifact promotion version must be ${DRAFT_ARTIFACT_VERSION}`);
    }
    this.version = DRAFT_ARTIFACT_VERSION;
    this.runId = requireString(input.runId, "draft artifact promotion runId");
    this.specId = requireString(input.specId, "draft artifact promotion specId");
    this.sourceStepId = requireString(input.sourceStepId, "draft artifact promotion sourceStepId");
    if (!DRAFT_ARTIFACT_WRITER_STEP_SET.has(this.sourceStepId)) {
      throw new Error(`unsupported draft artifact source step: ${this.sourceStepId}`);
    }
    this.expectedCanonicalDigest = requireDigest(
      input.expectedCanonicalDigest,
      "draft artifact promotion expectedCanonicalDigest",
    );
    this.sourceDigest = requireDigest(input.sourceDigest, "draft artifact promotion sourceDigest");
    this.byteLength = requireByteLength(input.byteLength, "draft artifact promotion byteLength");
    this.startedAt = requireIsoTimestamp(input.startedAt, "draft artifact promotion startedAt");
    Object.freeze(this);
  }

  static from(value) {
    return value instanceof DraftArtifactPromotion ? value : new DraftArtifactPromotion(value);
  }

  static create({ state, sourceStepId, source, canonical, now = () => new Date() }) {
    return new DraftArtifactPromotion({
      version: DRAFT_ARTIFACT_VERSION,
      runId: state.runId,
      specId: state.specId,
      sourceStepId,
      expectedCanonicalDigest: canonical.digest,
      sourceDigest: source.digest,
      byteLength: source.byteLength,
      startedAt: now().toISOString(),
    });
  }

  assertFlow(state, sourceStepId = this.sourceStepId) {
    if (
      state?.runId !== this.runId
      || state?.specId !== this.specId
      || sourceStepId !== this.sourceStepId
    ) {
      throw new DraftArtifactRecoveryError(
        "DRAFT_PROMOTION_BINDING_MISMATCH",
        "pending draft promotion does not match the active Flow transition",
      );
    }
  }

  matches(value) {
    try {
      const other = DraftArtifactPromotion.from(value);
      return JSON.stringify(this.toJSON()) === JSON.stringify(other.toJSON());
    } catch {
      return false;
    }
  }

  toRevision(finalizedAt = new Date().toISOString()) {
    return new DraftArtifactRevision({
      version: DRAFT_ARTIFACT_VERSION,
      runId: this.runId,
      specId: this.specId,
      sourceStepId: this.sourceStepId,
      digest: this.sourceDigest,
      byteLength: this.byteLength,
      finalizedAt,
    });
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      sourceStepId: this.sourceStepId,
      expectedCanonicalDigest: this.expectedCanonicalDigest,
      sourceDigest: this.sourceDigest,
      byteLength: this.byteLength,
      startedAt: this.startedAt,
    };
  }
}

class DraftArtifactBoundary {
  constructor({ canonicalPath, sourcePath, faultInjector = () => {} }) {
    this.canonicalPath = path.resolve(canonicalPath);
    this.sourcePath = path.resolve(sourcePath);
    this.faultInjector = faultInjector;
  }

  read(filePath, label) {
    const resolved = path.resolve(filePath);
    let stat;
    let descriptor = null;
    try {
      stat = fs.lstatSync(resolved);
      if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(resolved) !== resolved) {
        throw new Error(`${label} must be a regular real file: ${resolved}`);
      }
      descriptor = fs.openSync(resolved, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      const opened = fs.fstatSync(descriptor);
      if (!opened.isFile() || !sameFile(stat, opened)) {
        throw new Error(`${label} identity changed while opening: ${resolved}`);
      }
      return new DraftArtifactSnapshot({ filePath: resolved, bytes: fs.readFileSync(descriptor) });
    } catch (cause) {
      if (cause instanceof DraftArtifactRecoveryError) throw cause;
      throw new DraftArtifactRecoveryError(
        "DRAFT_ARTIFACT_UNAVAILABLE",
        `${label} is unavailable: ${cause.message}`,
        { cause },
      );
    } finally {
      if (descriptor != null) fs.closeSync(descriptor);
    }
  }

  source() {
    return this.read(this.sourcePath, "execution-checkout draft artifact");
  }

  canonical() {
    return this.read(this.canonicalPath, "canonical draft artifact");
  }

  publish(promotion, source) {
    const currentSource = this.source();
    const currentCanonical = this.canonical();
    if (
      currentSource.digest !== promotion.sourceDigest
      || currentSource.byteLength !== promotion.byteLength
      || source.digest !== promotion.sourceDigest
    ) {
      throw new DraftArtifactRecoveryError(
        "DRAFT_PROMOTION_SOURCE_CHANGED",
        "execution-checkout draft changed during canonical promotion; rerun the draft completion command",
      );
    }
    if (currentCanonical.digest === promotion.sourceDigest) return;
    if (currentCanonical.digest !== promotion.expectedCanonicalDigest) {
      throw draftConflict(promotion, currentCanonical, currentSource);
    }
    new AtomicFile(this.canonicalPath, {
      faultInjector: this.faultInjector,
      phaseNamespace: "draft",
    }).write(currentSource.bytes);
  }

  assertPublished(promotion) {
    const source = this.source();
    const canonical = this.canonical();
    if (
      source.digest !== promotion.sourceDigest
      || source.byteLength !== promotion.byteLength
    ) {
      throw new DraftArtifactRecoveryError(
        "DRAFT_PROMOTION_SOURCE_CHANGED",
        "execution-checkout draft changed before the completion transition; rerun the draft completion command",
      );
    }
    if (canonical.digest !== promotion.sourceDigest || canonical.byteLength !== promotion.byteLength) {
      throw new DraftArtifactRecoveryError(
        "DRAFT_PROMOTION_INCOMPLETE",
        "canonical draft does not match the pending promotion; rerun the draft completion command",
      );
    }
  }
}

function draftConflict(promotion, canonical, source) {
  return new DraftArtifactRecoveryError(
    "DRAFT_PROMOTION_CONFLICT",
    "canonical draft changed outside the pending promotion; inspect the two drafts before retrying",
    {
      data: {
        expectedCanonicalDigest: promotion.expectedCanonicalDigest,
        canonicalDigest: canonical.digest,
        sourceDigest: source.digest,
      },
    },
  );
}

class DraftArtifactCompletionIntent extends StepTransitionCommitIntent {
  constructor({ promotion, boundary, revision }) {
    super();
    this.promotion = DraftArtifactPromotion.from(promotion);
    this.boundary = boundary;
    this.revision = DraftArtifactRevision.from(revision);
    Object.freeze(this);
  }

  assertBeforeTransition(state) {
    this.promotion.assertFlow(state);
    if (!this.promotion.matches(state.draftArtifactPromotion)) {
      throw new DraftArtifactRecoveryError(
        "DRAFT_PROMOTION_CHANGED",
        "pending draft promotion changed before the completion transition",
      );
    }
    this.boundary.assertPublished(this.promotion);
  }

  applyTo(state) {
    state.draftArtifactRevision = this.revision.toJSON();
    delete state.draftArtifactPromotion;
  }
}

function assertFlowIdentity(state, expected) {
  if (state?.runId !== expected.runId || state?.specId !== expected.specId) {
    throw new DraftArtifactRecoveryError(
      "DRAFT_PROMOTION_BINDING_MISMATCH",
      "active Flow identity changed before draft promotion",
    );
  }
}

function persistPromotion(flowManager, state, promotion, operationOwnerToken) {
  flowManager.mutate((current) => {
    assertFlowIdentity(current, state);
    const pending = current.draftArtifactPromotion;
    if (pending && !promotion.matches(pending)) {
      DraftArtifactPromotion.from(pending).assertFlow(current, promotion.sourceStepId);
    }
    current.draftArtifactPromotion = promotion.toJSON();
  }, {
    specId: state.specId,
    expectedOriginal: state,
    operationOwnerToken,
  });
  return flowManager.load(state.specId);
}

function planPromotion({ state, sourceStepId, source, canonical, sameAuthority }) {
  const pending = state.draftArtifactPromotion == null
    ? null
    : DraftArtifactPromotion.from(state.draftArtifactPromotion);
  if (pending) {
    pending.assertFlow(state, sourceStepId);
    if (source.digest === pending.sourceDigest && source.byteLength === pending.byteLength) {
      if (
        canonical.digest !== pending.expectedCanonicalDigest
        && canonical.digest !== pending.sourceDigest
      ) {
        throw draftConflict(pending, canonical, source);
      }
      return pending;
    }
    if (
      canonical.digest !== pending.expectedCanonicalDigest
      && canonical.digest !== pending.sourceDigest
      && canonical.digest !== source.digest
    ) {
      throw draftConflict(pending, canonical, source);
    }
    return DraftArtifactPromotion.create({ state, sourceStepId, source, canonical });
  }

  const previous = state.draftArtifactRevision == null
    ? null
    : DraftArtifactRevision.from(state.draftArtifactRevision);
  if (previous) previous.assertFlow(state);
  if (!sameAuthority && previous == null) {
    throw new DraftArtifactRecoveryError(
      "DRAFT_PROMOTION_BASELINE_MISSING",
      "worktree draft promotion requires the canonical draft revision recorded during prepare",
      { recoveryCommand: `senti flow set step ${sourceStepId} done` },
    );
  }
  if (
    !sameAuthority
    && canonical.digest !== previous.digest
    && canonical.digest !== source.digest
  ) {
    throw new DraftArtifactRecoveryError(
      "DRAFT_PROMOTION_CANONICAL_STALE",
      "canonical draft no longer matches the expected revision recorded by the Flow",
      {
        recoveryCommand: `senti flow set step ${sourceStepId} done`,
        data: {
          expectedCanonicalDigest: previous.digest,
          canonicalDigest: canonical.digest,
          sourceDigest: source.digest,
        },
      },
    );
  }
  return DraftArtifactPromotion.create({ state, sourceStepId, source, canonical });
}

export function isDraftArtifactWriterStep(stepId) {
  return DRAFT_ARTIFACT_WRITER_STEP_SET.has(stepId);
}

export function createInitialDraftArtifactRevision({ state, draftPath, now = () => new Date() }) {
  const snapshot = new DraftArtifactBoundary({
    canonicalPath: draftPath,
    sourcePath: draftPath,
  }).canonical();
  return new DraftArtifactRevision({
    version: DRAFT_ARTIFACT_VERSION,
    runId: state.runId,
    specId: state.specId,
    sourceStepId: "prepare-spec",
    digest: snapshot.digest,
    byteLength: snapshot.byteLength,
    finalizedAt: now().toISOString(),
  });
}

export function completeDraftArtifactStep({
  mainRoot,
  executionRoot,
  flowManager,
  state,
  transition,
  faultInjector = () => {},
  processIdentitySource,
} = {}) {
  if (!isDraftArtifactWriterStep(transition?.stepId) || transition.requestedStatus !== "done") {
    throw new Error("draft artifact completion requires a supported done transition");
  }
  const canonicalPath = draftArtifactPath(mainRoot, state);
  const sourcePath = draftArtifactPath(executionRoot, state);
  const boundary = new DraftArtifactBoundary({ canonicalPath, sourcePath, faultInjector });
  const operation = new RepositoryFlowOperationLock({
    mainRoot,
    ...(processIdentitySource && { processIdentitySource }),
  });
  const operationOwnerToken = operation.acquire();
  try {
    let current = flowManager.load(state.specId);
    assertFlowIdentity(current, state);
    const source = boundary.source();
    const canonical = boundary.canonical();
    const promotion = planPromotion({
      state: current,
      sourceStepId: transition.stepId,
      source,
      canonical,
      sameAuthority: sourcePath === canonicalPath,
    });
    if (!promotion.matches(current.draftArtifactPromotion)) {
      current = persistPromotion(flowManager, current, promotion, operationOwnerToken);
    }
    boundary.publish(promotion, source);
    boundary.assertPublished(promotion);
    const revision = promotion.toRevision();
    flowManager.updateStepStatus(
      transition,
      {
        specId: state.specId,
        taskId: null,
        expectedOriginal: current,
        operationOwnerToken,
      },
      new DraftArtifactCompletionIntent({ promotion, boundary, revision }),
    );
    return {
      revision: revision.toJSON(),
      canonicalPath,
      promoted: sourcePath !== canonicalPath,
    };
  } catch (cause) {
    if (cause instanceof DraftArtifactRecoveryError) throw cause;
    throw new DraftArtifactRecoveryError(
      "DRAFT_PROMOTION_RECOVERY_REQUIRED",
      `draft promotion did not complete; rerun the draft completion command: ${cause.message}`,
      {
        cause,
        recoveryCommand: `senti flow set step ${transition.stepId} done`,
        data: { sourceStepId: transition.stepId },
      },
    );
  } finally {
    operation.release();
  }
}

function reviewRecoveryCommand(phase) {
  return [
    "senti flow run reopen-draft",
    `--reason "recover canonical draft authority before ${phase || "draft"} review"`,
  ].join(" ");
}

export function inspectCanonicalDraftRevision({ root, state, phase = null, expectedRevision = null } = {}) {
  if (state?.draftArtifactPromotion != null) {
    const pending = DraftArtifactPromotion.from(state.draftArtifactPromotion);
    throw new DraftArtifactRecoveryError(
      "DRAFT_PROMOTION_INCOMPLETE",
      "draft review cannot start while canonical draft promotion is incomplete",
      {
        recoveryCommand: `senti flow set step ${pending.sourceStepId} done`,
        data: { sourceStepId: pending.sourceStepId },
      },
    );
  }
  if (state?.draftArtifactRevision == null) return null;
  const revision = DraftArtifactRevision.from(state.draftArtifactRevision);
  revision.assertFlow(state);
  const allowedSources = REVIEW_SOURCE_STEPS[phase];
  if (allowedSources && !allowedSources.has(revision.sourceStepId)) {
    throw new DraftArtifactRecoveryError(
      "DRAFT_REVIEW_REVISION_STALE",
      `${phase} review requires a draft finalized by its immediately preceding draft-writing step`,
      {
        recoveryCommand: reviewRecoveryCommand(phase),
        data: { phase, sourceStepId: revision.sourceStepId },
      },
    );
  }
  if (expectedRevision) {
    const expected = DraftArtifactRevision.from(expectedRevision);
    if (expected.digest !== revision.digest || expected.sourceStepId !== revision.sourceStepId) {
      throw new DraftArtifactRecoveryError(
        "DRAFT_REVIEW_REVISION_CHANGED",
        "draft revision changed while review was running; start a fresh review",
        { data: { expectedDigest: expected.digest, currentDigest: revision.digest } },
      );
    }
  }
  const snapshot = new DraftArtifactBoundary({
    canonicalPath: draftArtifactPath(root, state),
    sourcePath: draftArtifactPath(root, state),
  }).canonical();
  if (!revision.matchesSnapshot(snapshot)) {
    throw new DraftArtifactRecoveryError(
      "DRAFT_REVIEW_CANONICAL_STALE",
      "canonical draft does not match the revision finalized by the preceding draft transition",
      {
        recoveryCommand: reviewRecoveryCommand(phase),
        data: {
          expectedDigest: revision.digest,
          canonicalDigest: snapshot.digest,
          sourceStepId: revision.sourceStepId,
        },
      },
    );
  }
  return Object.freeze({ revision, snapshot });
}

export function draftReviewTargetState(state, phase) {
  if (!String(phase || "").startsWith("draft-")) return null;
  if (state?.draftArtifactRevision == null) return null;
  const revision = DraftArtifactRevision.from(state.draftArtifactRevision);
  revision.assertFlow(state);
  return Object.freeze({
    digest: revision.digest,
    entries: Object.freeze([Object.freeze({
      path: path.posix.join(path.posix.dirname(relativeFlowSpecFile(state)), "draft.json"),
      contentHash: revision.digest,
      mode: "100644",
    })]),
  });
}
