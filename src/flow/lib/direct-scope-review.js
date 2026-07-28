import crypto from "node:crypto";

import {
  DirectChangedPathFingerprint,
  DirectFlowTarget,
} from "./direct-flow-session.js";

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const MAX_REVIEW_PATHS = 200;

function requireString(value, field, max = 4000) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${field} exceeds ${max} characters`);
  return normalized;
}

function requireRevision(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function reviewedFingerprints(value, field, { allowEmpty = false } = {}) {
  if (
    !Array.isArray(value)
    || value.length > MAX_REVIEW_PATHS
    || (!allowEmpty && value.length === 0)
  ) {
    throw new Error(
      `${field} must be ${allowEmpty ? "an" : "a non-empty"} array of at most ${MAX_REVIEW_PATHS} entries`,
    );
  }
  const fingerprints = value
    .map((entry) => DirectChangedPathFingerprint.fromStored(entry))
    .sort((left, right) => (
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    ));
  const paths = fingerprints.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length) {
    throw new Error(`${field} must not contain duplicate paths`);
  }
  return fingerprints;
}

function stableReviewToken(review) {
  const canonical = JSON.stringify({
    target: review.target.toJSON(),
    planId: review.planId,
    planRevision: review.planRevision,
    sessionRevision: review.sessionRevision,
    sourceStep: review.sourceStep,
    currentFlowStateRevision: review.currentFlowStateRevision,
    featureHead: review.featureHead,
    pathFingerprints: review.pathFingerprints.map((entry) => entry.toJSON()),
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export class DirectScopeAdoption {
  constructor({ reviewToken, pathFingerprints }) {
    this.reviewToken = requireString(reviewToken, "direct scope adoption reviewToken", 64);
    if (!SHA256.test(this.reviewToken)) {
      throw new Error("direct scope adoption reviewToken must be SHA-256");
    }
    this.pathFingerprints = Object.freeze(reviewedFingerprints(
      pathFingerprints,
      "direct scope adoption pathFingerprints",
    ));
    Object.freeze(this);
  }

  get paths() {
    return this.pathFingerprints.map((entry) => entry.path);
  }

  toJSON() {
    return {
      reviewToken: this.reviewToken,
      pathFingerprints: this.pathFingerprints.map((entry) => entry.toJSON()),
    };
  }

  static fromStored(value) {
    return value instanceof DirectScopeAdoption ? value : new DirectScopeAdoption(value);
  }
}

export class DirectScopeReview {
  constructor({
    reviewToken = null,
    target,
    planId,
    planRevision,
    sessionRevision,
    sourceStep,
    currentFlowStateRevision,
    featureHead,
    pathFingerprints,
  }) {
    this.target = DirectFlowTarget.fromStored(target);
    this.planId = requireString(planId, "direct scope review planId", 100);
    this.planRevision = requireRevision(planRevision, "direct scope review planRevision");
    this.sessionRevision = requireRevision(sessionRevision, "direct scope review sessionRevision");
    this.sourceStep = requireString(sourceStep, "direct scope review sourceStep", 200);
    this.currentFlowStateRevision = requireString(
      currentFlowStateRevision,
      "direct scope review currentFlowStateRevision",
      64,
    );
    if (!SHA256.test(this.currentFlowStateRevision)) {
      throw new Error("direct scope review currentFlowStateRevision must be SHA-256");
    }
    this.featureHead = requireString(featureHead, "direct scope review featureHead", 128);
    if (!GIT_OBJECT_ID.test(this.featureHead)) {
      throw new Error("direct scope review featureHead is invalid");
    }
    this.pathFingerprints = Object.freeze(reviewedFingerprints(
      pathFingerprints,
      "direct scope review pathFingerprints",
    ));
    const expectedToken = stableReviewToken(this);
    this.reviewToken = reviewToken == null
      ? expectedToken
      : requireString(reviewToken, "direct scope review reviewToken", 64);
    if (this.reviewToken !== expectedToken) {
      throw new Error("direct scope review token does not match its evidence");
    }
    Object.freeze(this);
  }

  get paths() {
    return this.pathFingerprints.map((entry) => entry.path);
  }

  adopt(paths) {
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new Error("direct scope adoption paths must be a non-empty array");
    }
    if (new Set(paths).size !== paths.length) {
      throw new Error("direct scope adoption paths must not contain duplicates");
    }
    const selected = paths.map((reviewedPath) => {
      const fingerprint = this.pathFingerprints.find((entry) => entry.path === reviewedPath);
      if (!fingerprint) {
        throw new Error(
          `direct scope adoption must name an exact reviewed path: ${reviewedPath}`,
        );
      }
      return fingerprint;
    });
    return new DirectScopeAdoption({
      reviewToken: this.reviewToken,
      pathFingerprints: selected,
    });
  }

  toJSON() {
    return {
      reviewToken: this.reviewToken,
      planId: this.planId,
      planRevision: this.planRevision,
      sessionRevision: this.sessionRevision,
      sourceStep: this.sourceStep,
      currentFlowStateRevision: this.currentFlowStateRevision,
      featureHead: this.featureHead,
      paths: this.paths,
      pathFingerprints: this.pathFingerprints.map((entry) => entry.toJSON()),
    };
  }
}
