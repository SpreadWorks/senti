import {
  SpecRepairOperationBatch,
  validateSpecRepairTriageTargets,
} from "./spec-repair-operations.js";

const SPEC_TRIAGE_DECISIONS = new Set([
  "apply",
  "invalid",
  "already_resolved",
  "downgraded_to_non_blocking",
]);
function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

function stableFindingId(finding) {
  if (!nonEmpty(finding?.findingId)) throw artifactError(["spec-review: every blocking finding requires a stable findingId"]);
  return finding.findingId;
}

function artifactError(issues) {
  const error = new Error(issues.join("; "));
  error.code = "SPEC_REVIEW_ARTIFACT_INVALID";
  error.issues = Object.freeze([...issues]);
  return error;
}

export class SpecReviewArtifact {
  constructor(document) {
    if (!document || typeof document !== "object" || Array.isArray(document)) {
      throw artifactError(["spec-review: spec-review.json must contain an object"]);
    }
    this.document = Object.freeze(structuredClone(document));
    this.blockingFindings = Object.freeze(
      (Array.isArray(document.blockingFindings) ? document.blockingFindings : [])
        .map((finding) => Object.freeze({ ...(finding || {}) })),
    );
    const findingIds = this.blockingFindings.map((finding) => stableFindingId(finding));
    if (new Set(findingIds).size !== findingIds.length) {
      throw artifactError(["spec-review: blocking findings must not duplicate findingId values"]);
    }
    this.rejected = document.verdict === "REJECTED";
    Object.freeze(this);
  }
}

export class SpecTriageArtifact {
  constructor(document, review) {
    if (!(review instanceof SpecReviewArtifact)) {
      throw new Error("SpecTriageArtifact requires a SpecReviewArtifact");
    }
    const issues = [];
    if (document?.version !== 1) issues.push("spec-triage: spec-triage.json version must be 1");
    if (document?.phase !== "spec-triage") {
      issues.push('spec-triage: spec-triage.json phase must be "spec-triage"');
    }
    if (document?.sourceReview !== "spec-review.json") {
      issues.push('spec-triage: spec-triage.json sourceReview must be "spec-review.json"');
    }
    if (!nonEmpty(document?.summary)) {
      issues.push("spec-triage: spec-triage.json summary must be non-empty");
    }
    if (!Array.isArray(document?.items)) {
      issues.push("spec-triage: spec-triage.json items must be an array");
      throw artifactError(issues);
    }
    if (document.items.length !== review.blockingFindings.length) {
      issues.push(
        `spec-triage: spec-triage.json items length ${document.items.length} does not match blockingFindings length ${review.blockingFindings.length}`,
      );
    }
    const findingsById = new Map(review.blockingFindings.map((finding) => [finding.findingId, finding]));
    const seenFindingIds = new Set();
    for (let index = 0; index < document.items.length; index += 1) {
      const item = document.items[index];
      const prefix = `spec-triage: items[${index}]`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        issues.push(`${prefix} must be an object`);
        continue;
      }
      if (!nonEmpty(item.title)) issues.push(`${prefix}.title must be non-empty`);
      if (!nonEmpty(item.target)) issues.push(`${prefix}.target must be non-empty`);
      const finding = findingsById.get(item.findingId);
      if (!finding) {
        issues.push(`${prefix}.findingId must identify exactly one canonical blocking finding`);
      } else if (seenFindingIds.has(item.findingId)) {
        issues.push(`${prefix}.findingId must not duplicate another triage item`);
      } else {
        seenFindingIds.add(item.findingId);
      }
      if (finding && item.title !== finding.title) {
        issues.push(`${prefix}.title must match the identified canonical blocking finding title`);
      }
      if (finding && item.target !== finding.target) {
        issues.push(`${prefix}.target must match the identified canonical blocking finding target`);
      }
      if (!SPEC_TRIAGE_DECISIONS.has(item.decision)) {
        issues.push(`${prefix}.decision must be one of ${[...SPEC_TRIAGE_DECISIONS].join(", ")}`);
      }
      if (!nonEmpty(item.rationale)) issues.push(`${prefix}.rationale must be non-empty`);
      if (!nonEmpty(item.evidence)) issues.push(`${prefix}.evidence must be non-empty`);
      if (item.decision === "apply") {
        if (!Array.isArray(item.allowedTargets) || item.allowedTargets.length === 0) {
          issues.push(`${prefix}.allowedTargets must be a non-empty array for apply`);
        }
        if (!Array.isArray(item.requiredTargets) || item.requiredTargets.length === 0) {
          issues.push(`${prefix}.requiredTargets must be a non-empty array for apply`);
        }
      } else if (Object.hasOwn(item, "allowedTargets") || Object.hasOwn(item, "requiredTargets")) {
        issues.push(`${prefix} may declare repair targets only for apply`);
      }
    }
    if (issues.length > 0) throw artifactError(issues);
    this.document = Object.freeze(structuredClone(document));
    this.items = Object.freeze(this.document.items);
    Object.freeze(this);
  }
}

export class SpecRepairArtifact {
  constructor(document, triage) {
    if (!(triage instanceof SpecTriageArtifact)) {
      throw new Error("SpecRepairArtifact requires a SpecTriageArtifact");
    }
    try {
      this.batch = new SpecRepairOperationBatch(document);
    } catch (cause) {
      throw artifactError([`spec-repair: ${cause.message}`]);
    }
    this.document = Object.freeze(structuredClone(document));
    this.operations = this.batch.operations;
    Object.freeze(this);
  }
}

export function validateSpecTriageDocument({ review, triage, spec = null }) {
  const artifact = new SpecTriageArtifact(triage, new SpecReviewArtifact(review));
  try {
    validateSpecRepairTriageTargets(artifact.document, spec);
  } catch (cause) {
    throw artifactError([`spec-triage: ${cause.message}`]);
  }
  return artifact;
}

export function validateSpecRepairDocument({ review, triage, repair, spec = null }) {
  const reviewArtifact = new SpecReviewArtifact(review);
  const triageArtifact = new SpecTriageArtifact(triage, reviewArtifact);
  try {
    validateSpecRepairTriageTargets(triageArtifact.document, spec);
  } catch (cause) {
    throw artifactError([`spec-triage: ${cause.message}`]);
  }
  return new SpecRepairArtifact(repair, triageArtifact);
}
