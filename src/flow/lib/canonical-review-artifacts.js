/**
 * Version-1 review execution boundary.
 *
 * Review providers still receive the established prompt and return the same
 * JSON/Markdown-shaped worker output.  Their intermediate files, however,
 * are work-unit data rather than Flow authority.  This module gives
 * RunReviewCommand one typed place to create that transient surface and to
 * turn the reviewed JSON into Store-owned attempt history and immutable
 * evidence publications.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  CanonicalCommandResultArtifact,
  CanonicalCommandResultPublication,
  attachCanonicalCommandResultArtifact,
  attachCanonicalCommandResultPublications,
} from "./canonical-command-result.js";
import {
  ReviewDisposition,
  ReviewEvidence,
  ReviewProvenance,
  ReviewTargetState,
} from "./review-convergence.js";
import { DraftReviewEvidenceSet } from "./draft-review-artifacts.js";
import { CanonicalTestSourceRevision } from "./canonical-test-artifacts.js";
import { CanonicalReviewInputDescriptor } from "./review-work-unit-input.js";
import { draftReviewRouteForRetryPhase, draftReviewSourceStepIds } from "./draft-review-routes.js";
import { ReviewWorkUnit, ReviewWorkUnitOutput, ReviewWorkUnitOutputReceipt } from "./review-work-unit.js";
import { renderTaskMarkdown } from "../../spec/commands/render.js";

const PHASES = new Set(["draft-questions", "draft-coverage", "spec", "test", "impl"]);
const ATTACHED_REVIEW_WORK_UNIT = Symbol("canonical-review-work-unit");

function isIsoTimestamp(value) {
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Date.parse(value));
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function requiredFlowManager(value) {
  if (
    !value
    || typeof value.readArtifact !== "function"
    || typeof value.activityLedger !== "function"
  ) {
    throw new Error("canonical review source requires the FlowManager catalog surface");
  }
  return value;
}

function jsonObject(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be a JSON object`);
  }
  return value;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function phase(value) {
  const resolved = requiredText(value, "canonical review phase");
  if (!PHASES.has(resolved)) throw new Error(`unsupported canonical review phase: ${resolved}`);
  return resolved;
}

/**
 * The catalog descriptor is the authoritative association between one
 * immutable draft payload and its producing Activity.  A V1 worker handoff
 * writes the payload and confirms the producer Attempt in the same Version
 * transaction, so that Activity is both publication and finalization proof.
 */
class CanonicalDraftSourceProducerActivity {
  constructor({ descriptor, activity, reviewPhase, allowedSteps } = {}) {
    if (descriptor === null || typeof descriptor !== "object" || Array.isArray(descriptor)) {
      throw new Error("canonical draft source requires a catalog descriptor");
    }
    if (activity === null || typeof activity !== "object" || Array.isArray(activity)) {
      throw new Error(`canonical draft source has no authorized ${reviewPhase} producer Activity`);
    }
    if (
      activity.id !== descriptor.activityId
      || descriptor.logicalKey !== "draft"
      || activity.type !== "result_confirmed"
      || activity.transition?.operation !== "confirm_attempt"
      || activity.transition?.nodeId !== activity.nodeId
      || activity.transition?.status !== "done"
      || activity.nodeId !== descriptor.publicationStep
      || !allowedSteps.has(activity.nodeId)
      || typeof activity.attemptId !== "string"
      || activity.attemptId.trim() === ""
      || !Number.isSafeInteger(activity.sequence)
      || activity.sequence < 1
      || activity.result?.outcome !== "passed"
      || !isIsoTimestamp(activity.result?.confirmedAt)
    ) {
      throw new Error(`canonical draft source has no authorized ${reviewPhase} producer Activity`);
    }
    this.nodeId = activity.nodeId;
    this.finalizedAt = activity.result.confirmedAt;
    Object.freeze(this);
  }
}

function nodeIdFor({ phase: reviewPhase, taskId = null }) {
  if (reviewPhase !== "impl") {
    return reviewPhase === "draft-questions"
      ? "draft-questions-review"
      : reviewPhase === "draft-coverage"
        ? "draft-coverage-review"
        : `${reviewPhase}-review`;
  }
  return taskId === null ? "impl-review" : `${taskId}-review`;
}

function logicalKeyFor({ phase: reviewPhase, taskId = null }) {
  if (reviewPhase === "draft-questions") return "draft.questions.review";
  if (reviewPhase === "draft-coverage") return "draft.coverage.review";
  if (reviewPhase === "spec") return "spec.review";
  if (reviewPhase === "test") return "test.review";
  return taskId === null ? "impl.review" : "task.review";
}

function reviewOutputFor({ phase: reviewPhase, taskId = null }) {
  return ReviewWorkUnitOutput.forReview({ phase: reviewPhase, taskId });
}

function normalizedVerdict(value) {
  const verdict = requiredText(value, "canonical review verdict");
  if (!new Set(["PASS", "ADVISORY", "REJECTED"]).has(verdict)) {
    throw new Error(`canonical review verdict is invalid: ${verdict}`);
  }
  return verdict;
}

function findingLists(artifact, reviewPhase) {
  const blocking = [
    artifact.blockingFindings,
    artifact.blocking,
    artifact.findings,
    artifact.comments,
    artifact.proposals,
    artifact.questions,
    artifact.issues,
  ].find(Array.isArray) || [];
  const advisory = [
    artifact.advisoryFindings,
    artifact.nonBlockingImprovements,
    artifact.improvements,
  ].find(Array.isArray) || [];
  const repairTargets = (reviewPhase === "draft-questions" || reviewPhase === "draft-coverage")
    && Array.isArray(artifact.repairTargets)
    ? artifact.repairTargets
    : [];
  return Object.freeze({ blocking, advisory: [...advisory, ...repairTargets] });
}

function reviewFinding(input, reviewPhase, bucket, index, sourceName, usedIds, usedFingerprints) {
  const source = jsonObject(input, "canonical review finding");
  const identity = stableJson(source);
  const fallbackId = `${reviewPhase}-${bucket}-${String(index + 1).padStart(3, "0")}`;
  let findingId = String(
    source.findingId || source.id || source.proposalId || source.findingKey || fallbackId,
  ).trim() || fallbackId;
  if (usedIds.has(findingId) && usedIds.get(findingId) !== identity) {
    let suffix = 2;
    while (usedIds.has(`${fallbackId}-${suffix}`)) suffix += 1;
    findingId = `${fallbackId}-${suffix}`;
  }
  usedIds.set(findingId, identity);
  let fingerprint = typeof source.fingerprint === "string" && /^[a-f0-9]{64}$/.test(source.fingerprint)
    ? source.fingerprint
    : sha256(identity);
  if (usedFingerprints.has(fingerprint) && usedFingerprints.get(fingerprint) !== identity) {
    let suffix = 2;
    while (usedFingerprints.has(sha256(`${identity}:${suffix}`))) suffix += 1;
    fingerprint = sha256(`${identity}:${suffix}`);
  }
  usedFingerprints.set(fingerprint, identity);
  const summary = String(
    source.summary || source.title || source.issue || source.improvement || source.rationale || "Review finding.",
  ).trim();
  if (summary === "") throw new Error("canonical review finding summary is required");
  return Object.freeze({
    findingId,
    summary,
    fingerprint,
    evidenceRefs: [`${sourceName}#${findingId}`],
    ...(source.disposition == null ? {} : { disposition: source.disposition }),
  });
}

function evidenceFor({ artifact, phase: reviewPhase, taskId, treeSha, targetStateDigest, capturedAt, sourceName }) {
  const verdict = normalizedVerdict(artifact.verdict);
  const lists = findingLists(artifact, reviewPhase);
  const usedIds = new Map();
  const usedFingerprints = new Map();
  const blockingFindings = lists.blocking.map((entry, index) => reviewFinding(
    entry, reviewPhase, "blocking", index, sourceName, usedIds, usedFingerprints,
  ));
  const advisoryFindings = lists.advisory.map((entry, index) => reviewFinding(
    entry, reviewPhase, "advisory", index, sourceName, usedIds, usedFingerprints,
  ));
  const disposition = new ReviewDisposition({
    value: verdict,
    blockingFindings,
    advisoryFindings,
  });
  return new ReviewEvidence({
    phase: reviewPhase,
    taskId,
    treeSha: requiredText(treeSha, "canonical review treeSha").toLowerCase(),
    targetStateDigest,
    provenance: new ReviewProvenance({
      provider: "sennel-review",
      invocationId: sha256(Buffer.from(`${stableJson(artifact)}\n`, "utf8")),
      capturedAt: capturedAt || artifact.generatedAt || new Date().toISOString(),
    }),
    disposition,
  });
}

function taskParameters(taskId) {
  return taskId === null ? {} : { taskId };
}

function handoffArtifactName(value) {
  return requiredText(value, "canonical draft review handoff artifact name");
}

function handoffDigest(value) {
  const digest = requiredText(value, "canonical draft review handoff artifact digest");
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error("canonical draft review handoff artifact digest must be a SHA-256 digest");
  }
  return digest;
}

/**
 * A reviewed JSON document already resolved through a signed worker-handoff
 * input or sealed payload.  It deliberately has no filesystem path: V1
 * review validation consumes catalog-authorized bytes, then keeps the
 * established draft-review validator focused on document semantics.
 */
export class CanonicalDraftReviewHandoffArtifact {
  constructor({ name, digest, document } = {}) {
    this.name = handoffArtifactName(name);
    this.digest = handoffDigest(digest);
    this.document = jsonObject(document, `${this.name} handoff document`);
    Object.freeze(this.document);
    Object.freeze(this);
  }

  static fromInput(input, expectedName) {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("canonical draft review handoff input is required");
    }
    if (input.name !== expectedName) {
      throw new Error(`canonical draft review handoff input is missing ${expectedName}`);
    }
    return new CanonicalDraftReviewHandoffArtifact({
      name: expectedName,
      digest: input.digest,
      document: input.document,
    });
  }

  static fromPayload({ name, digest, document } = {}) {
    return new CanonicalDraftReviewHandoffArtifact({ name, digest, document });
  }
}

function inputNamed(inputs, name) {
  if (!Array.isArray(inputs)) throw new Error("canonical draft review handoff inputs are required");
  const matches = inputs.filter((input) => input?.name === name);
  if (matches.length !== 1) throw new Error(`canonical draft review handoff requires exactly one ${name} input`);
  return CanonicalDraftReviewHandoffArtifact.fromInput(matches[0], name);
}

/**
 * Reuses the established draft review/triage/repair semantic validator while
 * making its sources typed V1 catalog snapshots instead of root-level files.
 * Revision binding is intentionally omitted only here: a Version-1 review
 * is bound by its immutable producer Attempt and catalog descriptor rather
 * than the retired mutable `draftArtifactRevision` state field.
 */
export class CanonicalDraftReviewHandoffEvidence {
  constructor({ route, state, review, triage = null, repair = null } = {}) {
    if (!route || typeof route !== "object") {
      throw new Error("canonical draft review handoff requires a review route");
    }
    if (state?.schemaRevision !== 3) {
      throw new Error("canonical draft review handoff requires a Version-1 Flow state");
    }
    if (!(review instanceof CanonicalDraftReviewHandoffArtifact) || review.name !== route.reviewArtifact) {
      throw new Error("canonical draft review handoff review artifact is invalid");
    }
    if (triage !== null && (!(triage instanceof CanonicalDraftReviewHandoffArtifact) || triage.name !== route.triageArtifact)) {
      throw new Error("canonical draft review handoff triage artifact is invalid");
    }
    if (repair !== null && (!(repair instanceof CanonicalDraftReviewHandoffArtifact) || repair.name !== route.repairArtifact)) {
      throw new Error("canonical draft review handoff repair artifact is invalid");
    }
    this.route = route;
    this.state = state;
    this.review = review;
    this.triage = triage;
    this.repair = repair;
    Object.freeze(this);
  }

  static fromInputs({ route, state, inputs, triage = null, repair = null } = {}) {
    return new CanonicalDraftReviewHandoffEvidence({
      route,
      state,
      review: inputNamed(inputs, route.reviewArtifact),
      triage: triage ?? (inputs.some((input) => input?.name === route.triageArtifact)
        ? inputNamed(inputs, route.triageArtifact)
        : null),
      repair,
    });
  }

  validateThrough(stepId) {
    return new DraftReviewEvidenceSet({
      route: this.route,
      state: this.state,
      reviewFile: this.review,
      triageFile: this.triage,
      repairFile: this.repair,
    }).validateThrough(stepId, { validateBinding: false });
  }
}

/** Catalog-bound draft input shared by fingerprinting and the worker surface. */
export class CanonicalDraftReviewSource {
  constructor({ flowManager, state, phase: reviewPhase } = {}) {
    this.flowManager = requiredFlowManager(flowManager);
    if (state?.schemaRevision !== 3 || typeof state.specId !== "string" || state.specId === "") {
      throw new Error("canonical draft review source requires a Version-1 Flow state");
    }
    this.state = state;
    this.phase = phase(reviewPhase);
    const sourceStepIds = draftReviewSourceStepIds(this.phase);
    if (sourceStepIds === null) throw new Error(`canonical draft source is unavailable for ${this.phase}`);
    const allowed = new Set(sourceStepIds);
    const resolved = this.flowManager.readArtifact({
      specId: state.specId,
      logicalKey: "draft",
      consumerNodeId: nodeIdFor({ phase: this.phase }),
    });
    const ledger = this.flowManager.activityLedger(state.specId);
    const publication = ledger.find((candidate) => candidate.id === resolved.descriptor.activityId) ?? null;
    const producer = new CanonicalDraftSourceProducerActivity({
      descriptor: resolved.descriptor,
      activity: publication,
      reviewPhase: this.phase,
      allowedSteps: allowed,
    });
    this.descriptor = resolved.descriptor;
    this.bytes = Buffer.from(resolved.bytes);
    this.sourceNodeId = producer.nodeId;
    this.finalizedAt = producer.finalizedAt;
    Object.freeze(this);
  }

  revision() {
    return Object.freeze({
      version: 1,
      runId: this.state.runId,
      specId: this.state.specId,
      sourceStepId: this.sourceNodeId,
      digest: this.descriptor.hash,
      byteLength: this.descriptor.size,
      finalizedAt: this.finalizedAt,
    });
  }

  targetState() {
    return new ReviewTargetState({
      digest: this.descriptor.hash,
      entries: [{
        path: this.descriptor.relativePath,
        contentHash: this.descriptor.hash,
        mode: "100644",
      }],
    });
  }

  materialize(workUnit, { write = true } = {}) {
    if (!(workUnit instanceof CanonicalReviewWorkUnit)) {
      throw new Error("canonical draft source requires a review work unit");
    }
    const input = {
      logicalKey: "draft",
      logicalPath: "draft.json",
      mediaType: "application/json",
      bytes: this.bytes,
      root: true,
    };
    if (!write) {
      workUnit.workUnit.declareInput(input);
      return null;
    }
    const sourcePath = workUnit.workUnit.writeInput(input).sourcePath;
    return Object.freeze({
      logicalPath: "draft.json",
      sourcePath,
      revision: this.revision(),
    });
  }
}

/**
 * A transient worker directory derived from an active Attempt through the
 * Store's typed runtime artifact boundary.  No caller constructs a Version
 * path or writes an authority artifact here.
 */
export class CanonicalReviewWorkUnit {
  constructor({ flowManager, state, phase: reviewPhase, taskId = null, executionRoot, treeSha, targetStateDigest } = {}) {
    if (!flowManager || typeof flowManager.readArtifact !== "function") {
      throw new Error("canonical review work unit requires FlowManager catalog reads");
    }
    if (state?.schemaRevision !== 3 || typeof state.specId !== "string" || state.specId === "") {
      throw new Error("canonical review work unit requires a Version-1 Flow state");
    }
    this.flowManager = flowManager;
    this.state = state;
    this.phase = phase(reviewPhase);
    this.taskId = taskId == null ? null : requiredText(taskId, "canonical review taskId");
    this.nodeId = nodeIdFor({ phase: this.phase, taskId: this.taskId });
    const typed = flowManager.canonicalState(state.specId);
    if (typed?.attempt?.nodeId !== this.nodeId) {
      throw new Error(`canonical review requires active Attempt for ${this.nodeId}`);
    }
    this.attemptId = requiredText(typed.attempt.id, "canonical review Attempt id");
    this.workUnit = new ReviewWorkUnit({
      executionRoot,
      runId: state.runId,
      specId: state.specId,
      phase: this.phase,
      taskId: this.taskId,
      nodeId: this.nodeId,
      attemptId: this.attemptId,
      target: { treeSha, targetStateDigest },
      output: reviewOutputFor({ phase: this.phase, taskId: this.taskId }),
    });
  }

  prepare() {
    this.workUnit.prepare();
    return Object.freeze({ directory: this.workUnit.directory });
  }

  finalize() {
    return this.workUnit.finalize();
  }

  #materializeCatalogInput({ logicalKey, logicalPath, optional = false }, { write = true } = {}) {
    const resolved = this.flowManager.readArtifact({
      specId: this.state.specId,
      logicalKey,
      consumerNodeId: this.nodeId,
      optional,
    });
    if (resolved === null) return null;
    const input = {
      logicalKey,
      logicalPath,
      mediaType: resolved.descriptor.mediaType,
      bytes: resolved.bytes,
    };
    if (!write) {
      this.workUnit.declareInput(input);
      return null;
    }
    const sourcePath = this.workUnit.writeInput(input).sourcePath;
    return new CanonicalReviewInputDescriptor({
      version: 1,
      logicalKey,
      logicalPath,
      sourcePath,
      digest: resolved.descriptor.hash,
      byteLength: resolved.descriptor.size,
    });
  }

  /** The Spec is catalog-resolved once by the parent for every review phase. */
  materializeSpecRecord(options) {
    return this.#materializeCatalogInput({ logicalKey: "spec.record", logicalPath: "spec.json" }, options);
  }

  /**
   * Flow-level implementation review consumes the shared map when one has
   * been published. The child decides whether absence is valid only after it
   * knows whether there is an implementation diff; it never invents a map.
   */
  materializeFileMap(options) {
    if (this.phase !== "impl" || this.taskId !== null) return null;
    return this.#materializeCatalogInput({
      logicalKey: "file.map",
      logicalPath: "file-map.json",
      optional: true,
    }, options);
  }

  /**
   * Render the already-authoritative task document only inside the transient
   * work unit.  The logical path remains the familiar task view path, so the
   * worker prompt and CLI option contract do not change while V1 keeps
   * spec.json.tasks[] as the sole durable Task specification.
   */
  materializeTaskSpec({ write = true } = {}) {
    if (this.taskId === null) return null;
    const task = this.state.tasks?.find((candidate) => candidate.id === this.taskId) ?? null;
    if (task === null) throw new Error(`canonical review Task is absent: ${this.taskId}`);
    const input = {
      logicalKey: "task.spec",
      logicalPath: "task-spec.md",
      mediaType: "text/markdown",
      bytes: Buffer.from(renderTaskMarkdown(task), "utf8"),
    };
    if (!write) {
      this.workUnit.declareInput(input);
      return null;
    }
    const sourcePath = this.workUnit.writeInput(input).sourcePath;
    const logicalPath = path.posix.join(
      path.posix.dirname(this.flowManager.specLocation(this.state.specId).relativeSpecFile),
      "tasks",
      `${this.taskId}.md`,
    );
    return Object.freeze({ taskId: this.taskId, logicalPath, sourcePath });
  }

  /** Materialize the catalog-authoritative draft under its worker-visible name. */
  materializeDraft(options) {
    if (this.phase !== "draft-questions" && this.phase !== "draft-coverage") return null;
    return new CanonicalDraftReviewSource({
      flowManager: this.flowManager,
      state: this.state,
      phase: this.phase,
    }).materialize(this, options);
  }

  /** Materialize catalog-resolved test inputs only in the transient work unit. */
  materializeTestSources(directory, { write = true } = {}) {
    if (this.phase !== "test") return null;
    const catalog = this.flowManager.artifactCatalog(this.state.specId);
    const sources = catalog.artifacts
      .filter((entry) => entry.logicalKey === "tests.source")
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    const testRoot = path.join(directory, "tests");
    for (const descriptor of sources) {
      const prefix = "artifacts/tests/";
      if (!descriptor.relativePath.startsWith(prefix)) {
        throw new Error("canonical test source catalog path is invalid");
      }
      const testPath = descriptor.relativePath.slice(prefix.length);
      const resolved = this.flowManager.readArtifact({
        specId: this.state.specId,
        logicalKey: "tests.source",
        parameters: { testPath },
        consumerNodeId: "test-review",
      });
      const input = {
        logicalKey: "tests.source",
        logicalPath: `tests/${testPath}`,
        mediaType: "text/plain",
        bytes: resolved.bytes,
      };
      if (!write) {
        this.workUnit.declareInput(input);
        continue;
      }
      const target = this.workUnit.writeInput(input).sourcePath;
      if (path.dirname(target) !== testRoot && !target.startsWith(`${testRoot}${path.sep}`)) {
        throw new Error("canonical test source work-unit path escapes its review directory");
      }
    }
    const ledger = typeof this.flowManager.activityLedger === "function"
      ? this.flowManager.activityLedger(this.state.specId)
      : [];
    if (!write) return null;
    return Object.freeze({
      directory,
      revision: CanonicalTestSourceRevision.fromCatalog({
        state: this.state,
        catalog,
        activities: ledger,
      }).toJSON(),
    });
  }

  /** Reconstruct the exact parent contract without touching worker files. */
  declareCanonicalInputs() {
    this.materializeSpecRecord({ write: false });
    this.materializeFileMap({ write: false });
    this.materializeDraft({ write: false });
    this.materializeTestSources(this.workUnit.directory, { write: false });
    this.materializeTaskSpec({ write: false });
    return this.workUnit.manifest();
  }
}

/** Turn a child worker's transient JSON artifact into one V1 command result. */
export class CanonicalReviewPromotion {
  constructor({ workUnit, phase: reviewPhase, taskId = null, treeSha, targetStateDigest } = {}) {
    if (!(workUnit instanceof ReviewWorkUnit)) throw new Error("canonical review promotion requires a sealed execution work unit");
    this.workUnit = workUnit;
    this.phase = phase(reviewPhase);
    this.taskId = taskId == null ? null : requiredText(taskId, "canonical review taskId");
    this.treeSha = requiredText(treeSha, "canonical review treeSha").toLowerCase();
    this.targetStateDigest = requiredText(targetStateDigest, "canonical review targetStateDigest").toLowerCase();
    Object.freeze(this);
  }

  sealedArtifact() {
    const sealed = this.workUnit.readSealedOutput();
    const artifact = jsonObject(JSON.parse(sealed.bytes.toString("utf8")), `canonical ${this.phase} review artifact`);
    const evidence = evidenceFor({
      artifact,
      phase: this.phase,
      taskId: this.taskId,
      treeSha: this.treeSha,
      targetStateDigest: this.targetStateDigest,
      sourceName: sealed.output.basename,
    });
    return Object.freeze({ sealed, artifact, evidence });
  }

  /**
   * Stdout is transient and is unavailable after a promotion crash.  Rebuild
   * the lifecycle result solely from the sealed artifact so replay preserves
   * the same PASS/ADVISORY/REJECTED route without another Agent invocation.
   */
  resultFromSealedArtifact() {
    const { artifact, evidence } = this.sealedArtifact();
    const verdict = normalizedVerdict(artifact.verdict);
    const findings = findingLists(artifact, this.phase);
    const blockingCount = findings.blocking.length;
    const advisoryCount = findings.advisory.length;
    const next = this.phase === "draft-questions" || this.phase === "draft-coverage"
      ? (verdict === "PASS" ? draftReviewRouteForRetryPhase(this.phase).passNextStepId : draftReviewRouteForRetryPhase(this.phase).triageStepId)
      : this.phase === "spec"
        ? (verdict === "REJECTED" ? "spec-triage" : "spec-gate")
        : this.phase === "test"
          ? (verdict === "REJECTED" ? null : "implement")
          : (verdict === "REJECTED" ? null : "impl-gate");
    return {
      result: "ok",
      changed: [],
      next,
      artifacts: {
        phase: this.phase,
        verdict,
        canonicalVerdict: verdict,
        evidenceDigest: evidence.identity.evidenceDigest,
        treeSha: this.treeSha,
        targetStateDigest: this.targetStateDigest,
        ...(this.phase === "spec" ? { proposalCount: blockingCount + advisoryCount } : {}),
        ...(this.phase === "test" ? { blockingCount, advisoryCount } : {}),
        ...(this.phase === "impl" ? { blockingCount, nonBlockingCount: advisoryCount } : {}),
        ...((this.phase === "draft-questions" || this.phase === "draft-coverage") ? {
          issueCount: blockingCount + advisoryCount,
          retryPhase: this.phase,
        } : {}),
        ...(this.taskId === null ? {} : { taskId: this.taskId }),
      },
    };
  }

  promote(result) {
    const { sealed, artifact, evidence } = this.sealedArtifact();
    const logicalKey = logicalKeyFor({ phase: this.phase, taskId: this.taskId });
    const normalizedArtifact = structuredClone(artifact);
    // `test-coverage.json` remains a logical document inside test.review;
    // its transient work-unit path is never a durable consumer path.
    if (this.phase === "test") normalizedArtifact.coverageArtifact = "test-coverage.json";
    normalizedArtifact.workerOutput = new ReviewWorkUnitOutputReceipt({
      digest: sealed.seal.output.digest,
      byteLength: sealed.seal.output.byteLength,
      mediaType: sealed.output.mediaType,
    }).toJSON();
    normalizedArtifact.canonicalEvidence = evidence.toJSON();
    normalizedArtifact.canonicalTarget = {
      treeSha: this.treeSha,
      targetStateDigest: this.targetStateDigest,
    };
    const artifactAttachment = new CanonicalCommandResultArtifact({
      logicalKey,
      payload: normalizedArtifact,
    });
    const evidencePublication = new CanonicalCommandResultPublication({
      logicalKey: "review.evidence",
      parameters: this.taskId === null
        ? { reviewStep: nodeIdFor({ phase: this.phase, taskId: null }), digest: evidence.identity.evidenceDigest }
        : { taskId: this.taskId, digest: evidence.identity.evidenceDigest },
      mediaType: "application/json",
      payload: evidence.toCanonicalJSON(),
    });
    result.artifacts ||= {};
    result.artifacts.phase = this.phase;
    result.artifacts.verdict = normalizedVerdict(artifact.verdict);
    result.artifacts.canonicalVerdict = result.artifacts.verdict;
    result.artifacts.evidenceDigest = evidence.identity.evidenceDigest;
    result.artifacts.treeSha = this.treeSha;
    result.artifacts.targetStateDigest = this.targetStateDigest;
    if (this.taskId !== null) result.artifacts.taskId = this.taskId;
    attachCanonicalCommandResultArtifact(result, artifactAttachment);
    attachCanonicalCommandResultPublications(result, [evidencePublication]);
    Object.defineProperty(result, ATTACHED_REVIEW_WORK_UNIT, {
      value: this.workUnit,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return result;
  }
}

/** The registry cleans this sealed worker surface only after Store confirmation. */
export function attachedCanonicalReviewWorkUnit(result) {
  const value = result?.[ATTACHED_REVIEW_WORK_UNIT] ?? null;
  return value instanceof ReviewWorkUnit ? value : null;
}

export function canonicalReviewArtifactFilename(value) {
  return reviewOutputFor({ phase: phase(value?.phase), taskId: value?.taskId ?? null }).basename;
}

export function canonicalReviewNodeId(value = {}) {
  return nodeIdFor({ phase: phase(value.phase), taskId: value.taskId ?? null });
}
