import path from "node:path";

import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { buildRepairFingerprint } from "./impl-repair-artifacts.js";
import { ReviewTargetState } from "./review-convergence.js";
import { resolveCurrentReviewTreeSha } from "./review-evidence-store.js";

function requireRoot(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty path`);
  }
  return path.resolve(value);
}

/**
 * Binds review code identity to the execution checkout while keeping mutable
 * Flow artifacts under the base-side artifact authority.
 */
export class ReviewTargetAuthority {
  constructor({ executionRoot, artifactRoot, flowState } = {}) {
    if (!flowState || typeof flowState !== "object" || Array.isArray(flowState)) {
      throw new Error("review target authority requires flowState");
    }
    this.executionRoot = requireRoot(executionRoot, "executionRoot");
    this.artifactRoot = requireRoot(artifactRoot, "artifactRoot");
    this.flowState = flowState;
    this.specPath = relativeFlowSpecFile(flowState);
    Object.freeze(this);
  }

  static fromContext(ctx = {}) {
    return new ReviewTargetAuthority({
      executionRoot: ctx.executionRoot || ctx.root,
      artifactRoot: ctx.root,
      flowState: ctx.flowState,
    });
  }

  resolveTreeSha() {
    return resolveCurrentReviewTreeSha(this.executionRoot, this.specPath);
  }

  captureFingerprint() {
    return buildRepairFingerprint({
      root: this.executionRoot,
      artifactRoot: this.artifactRoot,
      specPath: this.specPath,
      state: this.flowState,
    });
  }

  captureTargetState(fingerprint = this.captureFingerprint()) {
    return ReviewTargetState.fromRepairFingerprint(fingerprint);
  }
}
