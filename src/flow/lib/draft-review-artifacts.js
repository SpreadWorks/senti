import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";
import {
  DRAFT_REVIEW_ARTIFACT_LIMIT,
  DRAFT_REVIEW_ROUTES,
  DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT,
  draftReviewRouteForStepId,
} from "./draft-review-routes.js";
import {
  DraftArtifactRecoveryError,
  DraftArtifactRevision,
  completeDraftArtifactStep,
} from "./draft-artifact-promotion.js";
import {
  DraftReviewRevisionBinding,
  createDraftReviewRevisionBinding,
} from "./draft-review-revision.js";
import { StepTransitionCommitIntent } from "./step-transition-policy.js";

const MAX_DRAFT_CHANGED_FIELD_PATHS = 20;
const MAX_DRAFT_REVIEW_ARTIFACT_BYTES = 1024 * 1024;
const MAX_DRAFT_REVIEW_ROUTES_TO_VALIDATE = 8;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DRAFT_REVIEW_CLASSIFICATION_BY_ARRAY = Object.freeze({
  blockingFindings: "blocking",
  advisoryFindings: "advisory",
  repairTargets: "repair_target",
});
const ALLOWED_DRAFT_TRIAGE_DECISIONS = new Set([
  "apply",
  "invalid",
  "already_resolved",
  "downgraded_to_non_blocking",
  "requires_user_decision",
]);
const DRAFT_REVIEW_ITEM_FIELDS = Object.freeze(["title", "target", "rationale", "evidence"]);
const DRAFT_TRIAGE_ITEM_FIELDS = Object.freeze(["title", "target", "decision", "rationale", "evidence"]);
const DRAFT_REPAIR_ITEM_FIELDS = Object.freeze(["title", "target", "rationale", "evidence"]);
const DRAFT_REVIEW_CLASSIFICATIONS = Object.freeze(["blocking", "advisory", "repair_target"]);
const DRAFT_REVIEW_FIELD_MAX_CHARS = 1000;
const DRAFT_REVIEW_TRUNCATION_SUFFIX = " [truncated]";

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
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

function specDirForRoot(root, state) {
  void root;
  if (typeof state?.specDirectory !== "string" || state.specDirectory === "") {
    throw new Error("draft review filesystem projection is retired; use catalog handoff inputs");
  }
  return state.specDirectory;
}

export function normalizeDraftReviewText(value, fallback) {
  const text = typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
  return text.length > DRAFT_REVIEW_FIELD_MAX_CHARS
    ? `${text.slice(0, DRAFT_REVIEW_FIELD_MAX_CHARS - DRAFT_REVIEW_TRUNCATION_SUFFIX.length)}${DRAFT_REVIEW_TRUNCATION_SUFFIX}`
    : text;
}

export class DraftReviewFinding {
  constructor({ title, target, rationale, evidence, classification }) {
    if (!DRAFT_REVIEW_CLASSIFICATIONS.includes(classification)) {
      throw new Error(`invalid draft review classification: ${classification}`);
    }
    this.title = normalizeDraftReviewText(title, "Untitled finding");
    this.target = normalizeDraftReviewText(target, "GLOBAL");
    this.rationale = normalizeDraftReviewText(rationale, "Recorded by draft review.");
    this.evidence = normalizeDraftReviewText(evidence, "Draft review output.");
    this.classification = classification;
    Object.freeze(this);
  }

  static fromStored(value, classification) {
    if (value instanceof DraftReviewFinding) {
      if (value.classification !== classification) {
        throw new Error(`draft review finding classification must be ${classification}`);
      }
      return value;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("draft review finding must be an object");
    }
    if (value.classification != null && value.classification !== classification) {
      throw new Error(`draft review finding classification must be ${classification}`);
    }
    return new DraftReviewFinding({ ...value, classification });
  }

  toJSON() {
    return {
      title: this.title,
      target: this.target,
      rationale: this.rationale,
      evidence: this.evidence,
      classification: this.classification,
    };
  }
}

function normalizeDraftReviewFindings(value, field, classification) {
  if (!Array.isArray(value)) throw new Error(`draft review ${field} must be an array`);
  if (value.length > DRAFT_REVIEW_ARTIFACT_LIMIT) {
    throw new Error(`draft review ${field} exceeds ${DRAFT_REVIEW_ARTIFACT_LIMIT} items`);
  }
  return Object.freeze(value.map((item) => DraftReviewFinding.fromStored(item, classification)));
}

export class DraftReviewArtifactDocument {
  constructor({
    phase,
    sourceDraft,
    sourceDraftRevision,
    generatedAt = new Date().toISOString(),
    verdict = null,
    summary = null,
    blockingFindings = [],
    advisoryFindings = [],
    repairTargets = [],
  }) {
    this.version = 2;
    this.phase = requireString(phase, "draft review phase");
    this.sourceDraft = requireString(sourceDraft, "draft review sourceDraft");
    this.sourceDraftRevision = DraftArtifactRevision.from(sourceDraftRevision).toJSON();
    this.generatedAt = requireString(generatedAt, "draft review generatedAt");
    this.blockingFindings = normalizeDraftReviewFindings(blockingFindings, "blockingFindings", "blocking");
    this.advisoryFindings = normalizeDraftReviewFindings(advisoryFindings, "advisoryFindings", "advisory");
    this.repairTargets = normalizeDraftReviewFindings(repairTargets, "repairTargets", "repair_target");
    const derivedVerdict = this.blockingFindings.length > 0
      ? "REJECTED"
      : this.advisoryFindings.length > 0 || this.repairTargets.length > 0
        ? "ADVISORY"
        : "PASS";
    if (verdict != null && verdict !== derivedVerdict) {
      throw new Error(`draft review verdict must be ${derivedVerdict}`);
    }
    this.verdict = derivedVerdict;
    this.summary = summary == null
      ? derivedVerdict === "PASS"
        ? "No draft review findings recorded."
        : `${this.blockingFindings.length} blocking, ${this.advisoryFindings.length} advisory, ${this.repairTargets.length} repair target finding(s) recorded.`
      : requireString(summary, "draft review summary");
    Object.freeze(this.sourceDraftRevision);
    Object.freeze(this);
  }

  static fromStored(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 2) {
      throw new Error("draft review artifact version must be 2");
    }
    return new DraftReviewArtifactDocument(value);
  }

  toJSON() {
    return {
      version: this.version,
      phase: this.phase,
      sourceDraft: this.sourceDraft,
      sourceDraftRevision: { ...this.sourceDraftRevision },
      generatedAt: this.generatedAt,
      verdict: this.verdict,
      summary: this.summary,
      blockingFindings: this.blockingFindings.map((item) => item.toJSON()),
      advisoryFindings: this.advisoryFindings.map((item) => item.toJSON()),
      repairTargets: this.repairTargets.map((item) => item.toJSON()),
    };
  }
}

export function normalizeDraftReviewArtifactDocument(value) {
  return DraftReviewArtifactDocument.fromStored(value).toJSON();
}

export class DraftReviewArtifactFile {
  constructor({ specDir, filename }) {
    this.filename = requireString(filename, "draft review artifact filename");
    this.filePath = path.resolve(requireString(specDir, "draft review artifact specDir"), this.filename);
    let descriptor = null;
    try {
      const stat = fs.lstatSync(this.filePath);
      if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(this.filePath) !== this.filePath) {
        throw new Error("artifact must be a regular real file");
      }
      if (stat.size > MAX_DRAFT_REVIEW_ARTIFACT_BYTES) {
        const error = new Error(`artifact exceeds ${MAX_DRAFT_REVIEW_ARTIFACT_BYTES} bytes`);
        error.code = "DRAFT_ARTIFACT_TOO_LARGE";
        throw error;
      }
      descriptor = fs.openSync(this.filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
      const opened = fs.fstatSync(descriptor);
      if (!opened.isFile() || !sameFile(stat, opened)) {
        throw new Error("artifact identity changed while opening");
      }
      this.bytes = fs.readFileSync(descriptor);
    } finally {
      if (descriptor != null) fs.closeSync(descriptor);
    }
    try {
      this.document = JSON.parse(this.bytes.toString("utf8"));
    } catch (error) {
      throw new Error(`invalid JSON: ${error.message}`, { cause: error });
    }
    this.digest = sha256(this.bytes);
    Object.freeze(this);
  }

  static readIfExists(specDir, filename) {
    const filePath = path.resolve(specDir, filename);
    if (!fs.existsSync(filePath)) return null;
    try {
      return new DraftReviewArtifactFile({ specDir, filename });
    } catch (error) {
      error.artifactName = filename;
      throw error;
    }
  }
}

function validateArtifactObject(issues, artifactName, artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) {
    issues.push(`${artifactName}: artifact must be an object`);
    return false;
  }
  return true;
}

function validateRequiredString(issues, label, value) {
  if (typeof value !== "string" || value.trim() === "") issues.push(`${label} must be non-empty`);
}

function validateRequiredStringFields(issues, prefix, item, fields) {
  for (const field of fields) validateRequiredString(issues, `${prefix}.${field}`, item?.[field]);
}

function validateReviewRevision(
  issues,
  route,
  reviewFile,
  state,
  { requireCurrentRevision = false, validateBinding = true } = {},
) {
  const review = reviewFile.document;
  if (!validateArtifactObject(issues, `${route.reviewArtifact}: sourceDraftRevision`, review.sourceDraftRevision)) {
    issues.push(`${route.reviewArtifact}: version 2 requires sourceDraftRevision`);
    return;
  }
  validateRequiredStringFields(
    issues,
    `${route.reviewArtifact}: sourceDraftRevision`,
    review.sourceDraftRevision,
    ["runId", "specId", "sourceStepId", "digest", "finalizedAt"],
  );
  if (review.sourceDraftRevision.version !== 1) {
    issues.push(`${route.reviewArtifact}: sourceDraftRevision.version must be 1`);
  }
  if (!Number.isSafeInteger(review.sourceDraftRevision.byteLength) || review.sourceDraftRevision.byteLength < 1) {
    issues.push(`${route.reviewArtifact}: sourceDraftRevision.byteLength must be positive`);
  }
  if (!SHA256_PATTERN.test(review.sourceDraftRevision.digest || "")) {
    issues.push(`${route.reviewArtifact}: sourceDraftRevision.digest must be a SHA-256 digest`);
  }
  try {
    const revision = DraftArtifactRevision.from(review.sourceDraftRevision);
    revision.assertReviewSource(route.retryPhase);
    if (validateBinding) {
      revision.assertFlow(state);
      const stored = state?.draftReviewRevisions?.[route.retryPhase];
      if (stored && !requireCurrentRevision) {
        DraftReviewRevisionBinding.from(stored).assertMatches({ state, route, reviewFile, revision });
      } else {
        revision.assertCurrentReview(state, route.retryPhase);
      }
    }
  } catch (error) {
    issues.push(`${route.reviewArtifact}: invalid sourceDraftRevision: ${error.message}`);
  }
}

function validateDraftReviewRevisionBinding(issues, route, reviewFile, state, options = {}) {
  if (!reviewFile) {
    issues.push(`${route.reviewArtifact}: missing draft review artifact`);
    return false;
  }
  const review = reviewFile.document;
  if (!validateArtifactObject(issues, route.reviewArtifact, review)) return false;
  if (review.version !== 2) issues.push(`${route.reviewArtifact}: version must be 2`);
  if (review.version === 2) validateReviewRevision(issues, route, reviewFile, state, options);
  if (review.phase !== route.retryPhase) issues.push(`${route.reviewArtifact}: phase must be ${route.retryPhase}`);
  if (review.sourceDraft !== "draft.json") issues.push(`${route.reviewArtifact}: sourceDraft must be draft.json`);
  return true;
}

function validateDraftReviewArtifact(issues, route, reviewFile, state, options = {}) {
  if (!reviewFile) return void validateDraftReviewRevisionBinding(issues, route, reviewFile, state, options);
  const review = reviewFile.document;
  if (!validateArtifactObject(issues, route.reviewArtifact, review)) return;
  for (const field of ["version", "phase", "sourceDraft", "generatedAt", "verdict", "summary", "blockingFindings", "advisoryFindings", "repairTargets"]) {
    if (!(field in review)) issues.push(`${route.reviewArtifact}: missing field ${field}`);
  }
  validateDraftReviewRevisionBinding(issues, route, reviewFile, state, options);
  validateRequiredString(issues, `${route.reviewArtifact}: generatedAt`, review.generatedAt);
  validateRequiredString(issues, `${route.reviewArtifact}: summary`, review.summary);
  if (!["PASS", "ADVISORY", "REJECTED"].includes(review.verdict)) {
    issues.push(`${route.reviewArtifact}: verdict must be PASS, ADVISORY, or REJECTED`);
  }
  for (const [arrayField, classification] of Object.entries(DRAFT_REVIEW_CLASSIFICATION_BY_ARRAY)) {
    const items = review[arrayField];
    if (!Array.isArray(items)) {
      issues.push(`${route.reviewArtifact}: ${arrayField} must be an array`);
      continue;
    }
    if (items.length > DRAFT_REVIEW_ARTIFACT_LIMIT) {
      issues.push(`${route.reviewArtifact}: ${arrayField} must contain at most ${DRAFT_REVIEW_ARTIFACT_LIMIT} items`);
    }
    for (let index = 0; index < Math.min(items.length, DRAFT_REVIEW_ARTIFACT_LIMIT); index += 1) {
      const item = items[index];
      const prefix = `${route.reviewArtifact}: ${arrayField}[${index}]`;
      validateRequiredStringFields(issues, prefix, item, DRAFT_REVIEW_ITEM_FIELDS);
      if (item?.classification !== classification) issues.push(`${prefix}.classification must be ${classification}`);
    }
  }
  const blockingCount = Array.isArray(review.blockingFindings) ? review.blockingFindings.length : 0;
  const advisoryCount = Array.isArray(review.advisoryFindings) ? review.advisoryFindings.length : 0;
  const repairTargetCount = Array.isArray(review.repairTargets) ? review.repairTargets.length : 0;
  if (review.verdict === "PASS" && blockingCount + advisoryCount + repairTargetCount > 0) {
    issues.push(`${route.reviewArtifact}: PASS cannot include findings`);
  }
  if (review.verdict === "ADVISORY" && blockingCount > 0) {
    issues.push(`${route.reviewArtifact}: ADVISORY cannot include blocking findings`);
  }
  if (review.verdict === "ADVISORY" && advisoryCount + repairTargetCount === 0) {
    issues.push(`${route.reviewArtifact}: ADVISORY requires advisory findings or repair targets`);
  }
  if (review.verdict === "REJECTED" && blockingCount === 0) {
    issues.push(`${route.reviewArtifact}: REJECTED requires at least one blocking finding`);
  }
}

function draftFindingTitleTargetKey(item) {
  return [item?.title || "", item?.target || ""].join("\0");
}

function validateDraftTriageArtifact(issues, route, review, triageFile) {
  if (!triageFile) {
    issues.push(`${route.triageArtifact}: missing draft triage artifact`);
    return [];
  }
  const triage = triageFile.document;
  if (!validateArtifactObject(issues, route.triageArtifact, triage)) return [];
  if (triage.version !== 1) issues.push(`${route.triageArtifact}: version must be 1`);
  if (triage.phase !== route.triageStepId) issues.push(`${route.triageArtifact}: phase must be ${route.triageStepId}`);
  if (triage.sourceReview !== route.reviewArtifact) issues.push(`${route.triageArtifact}: sourceReview must be ${route.reviewArtifact}`);
  validateRequiredString(issues, `${route.triageArtifact}: summary`, triage.summary);
  if (!Array.isArray(triage.items)) {
    issues.push(`${route.triageArtifact}: items must be an array`);
    return [];
  }
  if (triage.items.length > DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT) {
    issues.push(`${route.triageArtifact}: items must contain at most ${DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT} items`);
  }
  const triageItems = triage.items.slice(0, DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT);
  const requiredItems = [
    ...(Array.isArray(review.blockingFindings) ? review.blockingFindings.slice(0, DRAFT_REVIEW_ARTIFACT_LIMIT) : []),
    ...(Array.isArray(review.repairTargets) ? review.repairTargets.slice(0, DRAFT_REVIEW_ARTIFACT_LIMIT) : []),
  ];
  const requiredCounts = new Map();
  const requiredItemsByKey = new Map();
  for (const item of requiredItems) {
    const key = draftFindingTitleTargetKey(item);
    requiredCounts.set(key, (requiredCounts.get(key) || 0) + 1);
    if (!requiredItemsByKey.has(key)) requiredItemsByKey.set(key, item);
  }
  const triageCounts = new Map();
  for (let index = 0; index < triageItems.length; index += 1) {
    const item = triageItems[index];
    const prefix = `${route.triageArtifact}: items[${index}]`;
    const key = draftFindingTitleTargetKey(item);
    const seenCount = (triageCounts.get(key) || 0) + 1;
    triageCounts.set(key, seenCount);
    const requiredCount = requiredCounts.get(key) || 0;
    if (requiredCount === 0) {
      issues.push(`${prefix} must match a blocking finding or repair target from ${route.reviewArtifact}`);
    } else if (seenCount > requiredCount) {
      issues.push(`${prefix} exceeds matching source review item count`);
    }
    validateRequiredStringFields(issues, prefix, item, DRAFT_TRIAGE_ITEM_FIELDS);
    if (!ALLOWED_DRAFT_TRIAGE_DECISIONS.has(item?.decision)) issues.push(`${prefix}.decision is invalid`);
    if (item?.decision === "requires_user_decision") issues.push(`${prefix}.decision requires user decision`);
  }
  for (const [key, requiredCount] of requiredCounts) {
    if ((triageCounts.get(key) || 0) < requiredCount) {
      issues.push(`${route.triageArtifact}: missing item for ${requiredItemsByKey.get(key).title}`);
    }
  }
  return triageItems;
}

function validateDraftRepairArtifact(issues, route, triageItems, repairFile) {
  if (!repairFile) {
    issues.push(`${route.repairArtifact}: missing draft repair artifact`);
    return;
  }
  const repair = repairFile.document;
  if (!validateArtifactObject(issues, route.repairArtifact, repair)) return;
  if (repair.version !== 1) issues.push(`${route.repairArtifact}: version must be 1`);
  if (repair.phase !== route.repairStepId) issues.push(`${route.repairArtifact}: phase must be ${route.repairStepId}`);
  if (repair.sourceTriage !== route.triageArtifact) issues.push(`${route.repairArtifact}: sourceTriage must be ${route.triageArtifact}`);
  validateRequiredString(issues, `${route.repairArtifact}: summary`, repair.summary);
  if (!Array.isArray(repair.items)) {
    issues.push(`${route.repairArtifact}: items must be an array`);
    return;
  }
  if (repair.items.length > DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT) {
    issues.push(`${route.repairArtifact}: items must contain at most ${DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT} items`);
  }
  const repairItems = repair.items.slice(0, DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT);
  const applyItems = triageItems.filter((item) => item?.decision === "apply");
  const applyCounts = new Map();
  const applyItemsByKey = new Map();
  for (const item of applyItems) {
    const key = draftFindingTitleTargetKey(item);
    applyCounts.set(key, (applyCounts.get(key) || 0) + 1);
    if (!applyItemsByKey.has(key)) applyItemsByKey.set(key, item);
  }
  if (repairItems.length !== applyItems.length) {
    issues.push(`${route.repairArtifact}: items length must match apply triage items length`);
  }
  const repairCounts = new Map();
  for (let index = 0; index < repairItems.length; index += 1) {
    const item = repairItems[index];
    const prefix = `${route.repairArtifact}: items[${index}]`;
    const key = draftFindingTitleTargetKey(item);
    const seenCount = (repairCounts.get(key) || 0) + 1;
    repairCounts.set(key, seenCount);
    validateRequiredStringFields(issues, prefix, item, DRAFT_REPAIR_ITEM_FIELDS);
    const applyCount = applyCounts.get(key) || 0;
    if (applyCount === 0) issues.push(`${prefix} must match an apply triage item`);
    else if (seenCount > applyCount) issues.push(`${prefix} exceeds matching apply triage item count`);
    if (!Array.isArray(item?.changedFieldPaths)) {
      issues.push(`${prefix}.changedFieldPaths must be an array`);
    } else if (item.changedFieldPaths.length > MAX_DRAFT_CHANGED_FIELD_PATHS) {
      issues.push(`${prefix}.changedFieldPaths must contain at most ${MAX_DRAFT_CHANGED_FIELD_PATHS} items`);
    } else {
      for (let changedIndex = 0; changedIndex < item.changedFieldPaths.length; changedIndex += 1) {
        validateRequiredString(issues, `${prefix}.changedFieldPaths[${changedIndex}]`, item.changedFieldPaths[changedIndex]);
      }
    }
  }
  for (const [key, applyCount] of applyCounts) {
    if ((repairCounts.get(key) || 0) < applyCount) {
      issues.push(`${route.repairArtifact}: missing item for apply triage ${applyItemsByKey.get(key).title}`);
    }
  }
}

export class DraftReviewEvidenceSet {
  constructor({ route, state, reviewFile, triageFile = null, repairFile = null }) {
    this.route = route;
    this.state = state;
    this.reviewFile = reviewFile;
    this.triageFile = triageFile;
    this.repairFile = repairFile;
    Object.freeze(this);
  }

  static canonical(specDir, route, state) {
    return new DraftReviewEvidenceSet({
      route,
      state,
      reviewFile: DraftReviewArtifactFile.readIfExists(specDir, route.reviewArtifact),
      triageFile: DraftReviewArtifactFile.readIfExists(specDir, route.triageArtifact),
      repairFile: DraftReviewArtifactFile.readIfExists(specDir, route.repairArtifact),
    });
  }

  static forCompletion({ canonicalSpecDir, route, state, stepId }) {
    return new DraftReviewEvidenceSet({
      route,
      state,
      reviewFile: DraftReviewArtifactFile.readIfExists(canonicalSpecDir, route.reviewArtifact),
      triageFile: DraftReviewArtifactFile.readIfExists(canonicalSpecDir, route.triageArtifact),
      repairFile: stepId === route.repairStepId
        ? DraftReviewArtifactFile.readIfExists(canonicalSpecDir, route.repairArtifact)
        : null,
    });
  }

  validateReview(options = {}) {
    const issues = [];
    validateDraftReviewArtifact(issues, this.route, this.reviewFile, this.state, options);
    return issues;
  }

  validateRevisionBinding(options = {}) {
    const issues = [];
    validateDraftReviewRevisionBinding(issues, this.route, this.reviewFile, this.state, options);
    return issues;
  }

  validateThrough(stepId = this.route.repairStepId, options = {}) {
    const issues = this.validateReview(options);
    if (!this.reviewFile) return { issues, triage: null };
    const triageItems = validateDraftTriageArtifact(
      issues,
      this.route,
      this.reviewFile.document,
      this.triageFile,
    );
    if (stepId === this.route.repairStepId) {
      validateDraftRepairArtifact(issues, this.route, triageItems, this.repairFile);
    }
    return { issues, triage: this.triageFile?.document ?? null };
  }
}

export class CanonicalDraftReviewWorkerArtifact {
  constructor(file) {
    if (!(file instanceof DraftReviewArtifactFile)) {
      throw new Error("canonical draft review worker artifact requires a draft review artifact file");
    }
    this.name = file.filename;
    this.digest = file.digest;
    this.document = deepFreeze(structuredClone(file.document));
    Object.freeze(this);
  }

  toJSON() {
    return {
      name: this.name,
      digest: this.digest,
      document: structuredClone(this.document),
    };
  }
}

export class CanonicalDraftReviewArtifactTarget {
  constructor({ specDir, filename }) {
    this.name = requireString(filename, "canonical draft review output artifact name");
    this.filePath = path.resolve(
      requireString(specDir, "canonical draft review output specDir"),
      this.name,
    );
    if (path.basename(this.filePath) !== this.name) {
      throw new Error("canonical draft review output artifact name must be a basename");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      name: this.name,
      filePath: this.filePath,
    };
  }
}

export class DraftReviewWorkerContext {
  constructor({ route, stepId, artifacts, outputArtifact }) {
    if (!route || typeof route !== "object" || draftReviewRouteForStepId(stepId) !== route) {
      throw new Error("draft review worker context requires a route");
    }
    this.version = 1;
    this.authority = "canonical-base";
    this.phase = route.retryPhase;
    this.stepId = requireString(stepId, "draft review worker stepId");
    if (!Array.isArray(artifacts) || artifacts.length === 0) {
      throw new Error("draft review worker context requires canonical artifacts");
    }
    this.artifacts = Object.freeze(artifacts.map((artifact) => {
      if (!(artifact instanceof CanonicalDraftReviewWorkerArtifact)) {
        throw new Error("draft review worker context artifact has an invalid type");
      }
      return artifact;
    }));
    const expectedNames = stepId === route.triageStepId
      ? [route.reviewArtifact]
      : [route.reviewArtifact, route.triageArtifact];
    if (this.artifacts.some((artifact, index) => artifact.name !== expectedNames[index])) {
      throw new Error("draft review worker context artifacts do not match the active route");
    }
    if (!(outputArtifact instanceof CanonicalDraftReviewArtifactTarget)) {
      throw new Error("draft review worker context requires a canonical output artifact target");
    }
    const expectedOutputName = stepId === route.triageStepId
      ? route.triageArtifact
      : route.repairArtifact;
    if (outputArtifact.name !== expectedOutputName) {
      throw new Error("draft review worker output artifact does not match the active route");
    }
    this.outputArtifact = outputArtifact;
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      authority: this.authority,
      phase: this.phase,
      stepId: this.stepId,
      artifacts: this.artifacts.map((artifact) => artifact.toJSON()),
      outputArtifact: this.outputArtifact.toJSON(),
    };
  }
}

export function resolveDraftReviewWorkerContext({ root, state, stepId } = {}) {
  const route = draftReviewRouteForStepId(stepId);
  if (!route || ![route.triageStepId, route.repairStepId].includes(stepId)) return null;
  const specDir = specDirForRoot(root, state);
  const evidence = DraftReviewEvidenceSet.canonical(specDir, route, state);
  const validation = stepId === route.triageStepId
    ? { issues: evidence.validateReview() }
    : evidence.validateThrough(route.triageStepId);
  if (validation.issues.length > 0) {
    throw new DraftReviewArtifactRecoveryError(
      "DRAFT_REVIEW_WORKER_INPUT_INVALID",
      validation.issues.join("; "),
      { data: { stepId } },
    );
  }
  const files = stepId === route.triageStepId
    ? [evidence.reviewFile]
    : [evidence.reviewFile, evidence.triageFile];
  return new DraftReviewWorkerContext({
    route,
    stepId,
    artifacts: files.map((file) => new CanonicalDraftReviewWorkerArtifact(file)),
    outputArtifact: new CanonicalDraftReviewArtifactTarget({
      specDir,
      filename: stepId === route.triageStepId ? route.triageArtifact : route.repairArtifact,
    }),
  });
}

export function validateDraftReviewArtifactSet(specDir, route, state) {
  return DraftReviewEvidenceSet.canonical(specDir, route, state).validateThrough();
}

export function validateDraftReviewArtifacts(root, specPath, draft, state) {
  const specDir = path.dirname(path.resolve(root, specPath));
  const issues = [];
  let coverageRequiresUserDecision = false;
  if (DRAFT_REVIEW_ROUTES.length > MAX_DRAFT_REVIEW_ROUTES_TO_VALIDATE) {
    throw new Error(`draft review route count exceeds ${MAX_DRAFT_REVIEW_ROUTES_TO_VALIDATE}`);
  }
  for (const route of DRAFT_REVIEW_ROUTES) {
    try {
      const result = validateDraftReviewArtifactSet(specDir, route, state);
      issues.push(...result.issues);
      if (route.key === "coverage" && Array.isArray(result.triage?.items)) {
        coverageRequiresUserDecision = result.triage.items
          .slice(0, DRAFT_TRIAGE_REPAIR_ARTIFACT_LIMIT)
          .some((item) => item?.decision === "requires_user_decision");
      }
    } catch (error) {
      const artifactName = error.artifactName || route.reviewArtifact;
      const detail = error.code === "DRAFT_ARTIFACT_TOO_LARGE" ? error.message : `invalid JSON: ${error.message}`;
      issues.push(`${artifactName}: ${detail}`);
    }
  }
  if (!coverageRequiresUserDecision && draft?.approval?.approved !== true) {
    issues.push("draft-review: draft approval.approved must be true after coverage repair when no user decision is unresolved");
  }
  return issues;
}

export function registerDraftReviewRevision({ root, state, flowManager, route, now = () => new Date() }) {
  const specDir = specDirForRoot(root, state);
  const evidence = DraftReviewEvidenceSet.canonical(specDir, route, state);
  const issues = evidence.validateReview({ requireCurrentRevision: true });
  if (issues.length > 0) throw new Error(issues.join("; "));
  const revision = DraftArtifactRevision.from(evidence.reviewFile.document.sourceDraftRevision);
  const binding = createDraftReviewRevisionBinding({
    phase: route.retryPhase,
    reviewArtifact: route.reviewArtifact,
    reviewArtifactDigest: evidence.reviewFile.digest,
    revision,
    recordedAt: now().toISOString(),
  });
  void flowManager;
  revision.assertCurrentReview(state, route.retryPhase);
  return binding;
}

export class DraftReviewArtifactRecoveryError extends Error {
  constructor(code, message, { cause = null, data = {} } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "DraftReviewArtifactRecoveryError";
    this.code = requireString(code, "draft review artifact error code");
    this.data = Object.freeze({ ...data });
  }
}

class DraftReviewArtifactCompletionIntent extends StepTransitionCommitIntent {
  constructor({ state, canonicalFile }) {
    super();
    this.runId = state.runId;
    this.specId = state.specId;
    this.canonicalFile = canonicalFile;
    Object.freeze(this);
  }

  assertBeforeTransition(state) {
    if (state?.runId !== this.runId || state?.specId !== this.specId) {
      throw new DraftReviewArtifactRecoveryError(
        "DRAFT_REVIEW_ARTIFACT_BINDING_MISMATCH",
        "draft review artifact does not match the active Flow target",
      );
    }
    const current = new DraftReviewArtifactFile({
      specDir: path.dirname(this.canonicalFile.filePath),
      filename: this.canonicalFile.filename,
    });
    if (current.digest !== this.canonicalFile.digest) {
      throw new DraftReviewArtifactRecoveryError(
        "DRAFT_REVIEW_ARTIFACT_CHANGED",
        "canonical draft review artifact changed before step completion",
      );
    }
  }

  applyTo() {}
}

class DraftReviewArtifactCompletion {
  constructor({ state, canonicalFile }) {
    this.artifact = canonicalFile.filename;
    this.digest = canonicalFile.digest;
    this.promoted = false;
    this.intent = new DraftReviewArtifactCompletionIntent({ state, canonicalFile });
    Object.freeze(this);
  }
}

class DraftReviewRepairCompletion {
  constructor({ artifactCompletion, draftCompletion }) {
    this.artifact = artifactCompletion.artifact;
    this.digest = artifactCompletion.digest;
    this.promoted = draftCompletion.promoted;
    this.revision = draftCompletion.revision;
    Object.freeze(this);
  }
}

function assertFlowIdentity(state, expected) {
  if (state?.runId !== expected.runId || state?.specId !== expected.specId) {
    throw new DraftReviewArtifactRecoveryError(
      "DRAFT_REVIEW_ARTIFACT_BINDING_MISMATCH",
      "active Flow identity changed before draft review artifact publication",
    );
  }
}

function findDraftReviewArtifactRecoveryCause(error) {
  const visited = new Set();
  let current = error;
  while (current instanceof Error && !visited.has(current)) {
    if (current instanceof DraftReviewArtifactRecoveryError) return current;
    visited.add(current);
    current = current.cause;
  }
  return null;
}

function withDraftReviewArtifactOperation({ mainRoot, processIdentitySource }, execute) {
  const operation = new RepositoryFlowOperationLock({
    mainRoot,
    ...(processIdentitySource && { processIdentitySource }),
  });
  const operationOwnerToken = operation.acquire();
  try {
    return execute(operationOwnerToken);
  } finally {
    operation.release();
  }
}

export function isDraftReviewArtifactStep(stepId) {
  const route = draftReviewRouteForStepId(stepId);
  return route != null && (stepId === route.triageStepId || stepId === route.repairStepId);
}

function draftReviewArtifactCompletion({
  mainRoot,
  executionRoot,
  current,
  transition,
}) {
  const route = draftReviewRouteForStepId(transition?.stepId);
  if (
    !route
    || !isDraftReviewArtifactStep(transition.stepId)
    || transition.requestedStatus !== "done"
  ) {
    throw new Error("draft review artifact completion requires a triage or repair done transition");
  }
  const canonicalSpecDir = specDirForRoot(mainRoot, current);
  const executionSpecDir = specDirForRoot(executionRoot, current);
  const targetArtifact = transition.stepId === route.triageStepId
    ? route.triageArtifact
    : route.repairArtifact;
  const canonicalFile = DraftReviewArtifactFile.readIfExists(canonicalSpecDir, targetArtifact);
  if (!canonicalFile && path.resolve(executionSpecDir) !== path.resolve(canonicalSpecDir)) {
    const misplacedFile = DraftReviewArtifactFile.readIfExists(executionSpecDir, targetArtifact);
    if (misplacedFile) {
      throw new DraftReviewArtifactRecoveryError(
        "DRAFT_REVIEW_ARTIFACT_WRONG_AUTHORITY",
        `${targetArtifact} exists only in the execution checkout; write it to the canonical output path before completing the step`,
        {
          data: {
            stepId: transition.stepId,
            canonicalPath: path.join(canonicalSpecDir, targetArtifact),
          },
        },
      );
    }
  }
  const sourceEvidence = DraftReviewEvidenceSet.forCompletion({
    canonicalSpecDir,
    route,
    state: current,
    stepId: transition.stepId,
  });
  const sourceValidation = sourceEvidence.validateThrough(transition.stepId);
  if (sourceValidation.issues.length > 0) {
    throw new DraftReviewArtifactRecoveryError(
      "DRAFT_REVIEW_ARTIFACT_INVALID",
      sourceValidation.issues.join("; "),
      { data: { stepId: transition.stepId } },
    );
  }
  return new DraftReviewArtifactCompletion({ state: current, canonicalFile });
}

export function completeDraftReviewArtifactStep({
  mainRoot,
  executionRoot,
  flowManager,
  state,
  transition,
  processIdentitySource,
} = {}) {
  try {
    return withDraftReviewArtifactOperation(
      { mainRoot, processIdentitySource },
      (operationOwnerToken) => {
        const current = flowManager.load(state.specId);
        assertFlowIdentity(current, state);
        const completion = draftReviewArtifactCompletion({
          mainRoot,
          executionRoot,
          current,
          transition,
        });
        flowManager.updateStepStatus(
          transition,
          {
            specId: state.specId,
            taskId: null,
            expectedOriginal: current,
            operationOwnerToken,
          },
          completion.intent,
        );
        return completion;
      },
    );
  } catch (cause) {
    if (cause instanceof DraftReviewArtifactRecoveryError) throw cause;
    throw new DraftReviewArtifactRecoveryError(
      "DRAFT_REVIEW_ARTIFACT_RECOVERY_REQUIRED",
      `draft review artifact publication did not complete: ${cause.message}`,
      { cause, data: { stepId: transition.stepId } },
    );
  }
}

export function completeDraftReviewRepairStep({
  mainRoot,
  executionRoot,
  flowManager,
  state,
  transition,
  faultInjector = () => {},
  processIdentitySource,
} = {}) {
  const route = draftReviewRouteForStepId(transition?.stepId);
  if (!route || transition.stepId !== route.repairStepId || transition.requestedStatus !== "done") {
    throw new Error("draft review repair completion requires a repair done transition");
  }
  try {
    return withDraftReviewArtifactOperation(
      { mainRoot, processIdentitySource },
      (operationOwnerToken) => {
        const current = flowManager.load(state.specId);
        assertFlowIdentity(current, state);
        const artifactCompletion = draftReviewArtifactCompletion({
          mainRoot,
          executionRoot,
          current,
          transition,
        });
        faultInjector({
          phase: "after-draft-review-artifact-validation",
          stepId: transition.stepId,
          artifact: artifactCompletion.artifact,
        });
        const draftCompletion = completeDraftArtifactStep({
          mainRoot,
          executionRoot,
          flowManager,
          state: current,
          transition,
          faultInjector,
          processIdentitySource,
          operationOwnerToken,
          evidenceIntent: artifactCompletion.intent,
        });
        return new DraftReviewRepairCompletion({ artifactCompletion, draftCompletion });
      },
    );
  } catch (cause) {
    const reviewCause = findDraftReviewArtifactRecoveryCause(cause);
    if (reviewCause) throw reviewCause;
    if (cause instanceof DraftArtifactRecoveryError) {
      throw cause;
    }
    throw new DraftReviewArtifactRecoveryError(
      "DRAFT_REVIEW_ARTIFACT_RECOVERY_REQUIRED",
      `draft review repair completion did not complete: ${cause.message}`,
      { cause, data: { stepId: transition.stepId } },
    );
  }
}
