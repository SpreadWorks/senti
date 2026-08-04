import fs from "node:fs";
import path from "node:path";

const SPEC_TRIAGE_DECISIONS = new Set([
  "apply",
  "invalid",
  "already_resolved",
  "downgraded_to_non_blocking",
]);
const SPEC_REPAIR_DECISIONS = new Set(["applied"]);

function nonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
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
    for (let index = 0; index < document.items.length; index += 1) {
      const item = document.items[index];
      const finding = review.blockingFindings[index];
      const prefix = `spec-triage: items[${index}]`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        issues.push(`${prefix} must be an object`);
        continue;
      }
      if (!nonEmpty(item.title)) issues.push(`${prefix}.title must be non-empty`);
      if (!nonEmpty(item.target)) issues.push(`${prefix}.target must be non-empty`);
      if (finding && item.title !== finding.title) {
        issues.push(`${prefix}.title must match blockingFindings[${index}].title`);
      }
      if (finding && item.target !== finding.target) {
        issues.push(`${prefix}.target must match blockingFindings[${index}].target`);
      }
      if (!SPEC_TRIAGE_DECISIONS.has(item.decision)) {
        issues.push(`${prefix}.decision must be one of ${[...SPEC_TRIAGE_DECISIONS].join(", ")}`);
      }
      if (!nonEmpty(item.rationale)) issues.push(`${prefix}.rationale must be non-empty`);
      if (!nonEmpty(item.evidence)) issues.push(`${prefix}.evidence must be non-empty`);
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
    const issues = [];
    if (document?.version !== 1) issues.push("spec-repair: spec-repair.json version must be 1");
    if (document?.phase !== "spec-repair") {
      issues.push('spec-repair: spec-repair.json phase must be "spec-repair"');
    }
    if (document?.sourceReview !== "spec-triage.json") {
      issues.push('spec-repair: spec-repair.json sourceReview must be "spec-triage.json"');
    }
    if (!nonEmpty(document?.summary)) {
      issues.push("spec-repair: spec-repair.json summary must be non-empty");
    }
    if (!Array.isArray(document?.items)) {
      issues.push("spec-repair: spec-repair.json items must be an array");
      throw artifactError(issues);
    }
    const applyItems = triage.items.filter((item) => item?.decision === "apply");
    if (document.items.length !== applyItems.length) {
      issues.push(
        `spec-repair: spec-repair.json items length ${document.items.length} does not match spec-triage apply item length ${applyItems.length}`,
      );
    }
    for (let index = 0; index < document.items.length; index += 1) {
      const item = document.items[index];
      const triageItem = applyItems[index];
      const prefix = `spec-repair: items[${index}]`;
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        issues.push(`${prefix} must be an object`);
        continue;
      }
      if (!nonEmpty(item.title)) issues.push(`${prefix}.title must be non-empty`);
      if (!nonEmpty(item.target)) issues.push(`${prefix}.target must be non-empty`);
      if (triageItem && item.title !== triageItem.title) {
        issues.push(`${prefix}.title must match spec-triage apply item ${index}.title`);
      }
      if (triageItem && item.target !== triageItem.target) {
        issues.push(`${prefix}.target must match spec-triage apply item ${index}.target`);
      }
      if (!SPEC_REPAIR_DECISIONS.has(item.decision)) {
        issues.push(`${prefix}.decision must be one of ${[...SPEC_REPAIR_DECISIONS].join(", ")}`);
      }
      if (!nonEmpty(item.rationale)) issues.push(`${prefix}.rationale must be non-empty`);
      if (!nonEmpty(item.evidence)) issues.push(`${prefix}.evidence must be non-empty`);
      if (!Array.isArray(item.changedFields)) {
        issues.push(`${prefix}.changedFields must be an array`);
      } else if (item.decision === "applied" && item.changedFields.length === 0) {
        issues.push(`${prefix}.changedFields must be non-empty when decision is applied`);
      }
    }
    if (issues.length > 0) throw artifactError(issues);
    this.document = Object.freeze(structuredClone(document));
    this.items = Object.freeze(this.document.items);
    Object.freeze(this);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function validateSpecTriageDocument({ review, triage }) {
  return new SpecTriageArtifact(triage, new SpecReviewArtifact(review));
}

export function validateSpecRepairDocument({ review, triage, repair }) {
  const reviewArtifact = new SpecReviewArtifact(review);
  const triageArtifact = new SpecTriageArtifact(triage, reviewArtifact);
  return new SpecRepairArtifact(repair, triageArtifact);
}

export function validateSpecRepairAudit(specDir) {
  const reviewPath = path.join(specDir, "spec-review.json");
  const triagePath = path.join(specDir, "spec-triage.json");
  const repairPath = path.join(specDir, "spec-repair.json");
  let review;
  try {
    review = fs.existsSync(reviewPath) ? readJson(reviewPath) : null;
  } catch (error) {
    return [`spec-repair: spec-review.json is invalid JSON: ${error.message}`];
  }
  if (!review || review.verdict !== "REJECTED") return [];
  if (!fs.existsSync(triagePath)) {
    return ["spec-triage: spec-review.json verdict is REJECTED but spec-triage.json is missing"];
  }
  let triage;
  try {
    triage = readJson(triagePath);
  } catch (error) {
    return [`spec-triage: spec-triage.json is invalid JSON: ${error.message}`];
  }
  try {
    validateSpecTriageDocument({ review, triage });
  } catch (error) {
    return error.issues || [error.message];
  }
  if (!fs.existsSync(repairPath)) {
    return ["spec-repair: spec-review.json verdict is REJECTED but spec-repair.json is missing"];
  }
  let repair;
  try {
    repair = readJson(repairPath);
  } catch (error) {
    return [`spec-repair: spec-repair.json is invalid JSON: ${error.message}`];
  }
  try {
    validateSpecRepairDocument({ review, triage, repair });
    return [];
  } catch (error) {
    return error.issues || [error.message];
  }
}
