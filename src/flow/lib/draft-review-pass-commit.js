import path from "node:path";

import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import {
  findActiveNode,
  writeEmptyDraftReviewRouteArtifacts,
} from "../definition.js";
import {
  DraftArtifactPromotion,
  completeCanonicalDraftMutation,
} from "./draft-artifact-promotion.js";
import {
  DraftReviewArtifactFile,
  registerDraftReviewRevision,
} from "./draft-review-artifacts.js";
import { draftReviewRouteForStepId } from "./draft-review-routes.js";

export class DraftReviewPassCommitResult {
  constructor({ approvalEligible, state, route }) {
    if (typeof approvalEligible !== "boolean") {
      throw new Error("draft review PASS commit approvalEligible must be boolean");
    }
    if (!state || typeof state !== "object" || !route?.retryPhase) {
      throw new Error("draft review PASS commit result requires state and route");
    }
    this.approvalEligible = approvalEligible;
    this.state = state;
    this.route = route;
    Object.freeze(this);
  }

  toReviewCommandResult(phase = "draft") {
    return {
      result: "ok",
      changed: [
        this.route.reviewArtifact,
        this.route.triageArtifact,
        this.route.repairArtifact,
      ],
      artifacts: {
        phase,
        verdict: "PASS",
        issueCount: 0,
        retryPhase: this.route.retryPhase,
        canonicalVerdict: "PASS",
        recoveredInterruptedPassCommit: true,
      },
      next: null,
      output: "Recovered the interrupted draft review PASS commit without rerunning the provider.",
    };
  }
}

export class DraftReviewPassCommit {
  constructor({ root, flowManager, route }) {
    if (!root || !flowManager || !route?.reviewStepId) {
      throw new Error("draft review PASS commit requires root, flowManager, and route");
    }
    this.root = path.resolve(root);
    this.flowManager = flowManager;
    this.route = route;
    Object.freeze(this);
  }

  execute() {
    let state = this.flowManager.load();
    if (!state.draftReviewRevisions?.[this.route.retryPhase]) {
      registerDraftReviewRevision({
        root: this.root,
        state,
        flowManager: this.flowManager,
        route: this.route,
      });
      state = this.flowManager.load();
    }
    const specDir = path.dirname(path.resolve(this.root, relativeFlowSpecFile(state)));
    const reviewFile = new DraftReviewArtifactFile({
      specDir,
      filename: this.route.reviewArtifact,
    });
    if (reviewFile.document.verdict !== "PASS") {
      throw new Error(`draft review PASS commit requires a PASS ${this.route.reviewArtifact}`);
    }
    const emptyArtifacts = writeEmptyDraftReviewRouteArtifacts({
      specDir,
      route: this.route,
      generatedAt: reviewFile.document.generatedAt,
    });
    if (emptyArtifacts.approvalEligible) {
      completeCanonicalDraftMutation({
        root: this.root,
        flowManager: this.flowManager,
        state,
        sourceStepId: this.route.reviewStepId,
        mutateDocument(draft) {
          draft.approval = {
            ...(draft.approval || {}),
            approved: true,
            confirmedAt: reviewFile.document.generatedAt,
          };
          return draft;
        },
      });
    }
    return new DraftReviewPassCommitResult({
      approvalEligible: emptyArtifacts.approvalEligible,
      state: this.flowManager.load(),
      route: this.route,
    });
  }

  static recoverInterrupted({ root, flowManager }) {
    const state = flowManager.load();
    const sourceStepId = state.draftArtifactPromotion == null
      ? state.draftArtifactRevision?.sourceStepId
      : DraftArtifactPromotion.from(state.draftArtifactPromotion).sourceStepId;
    const route = draftReviewRouteForStepId(sourceStepId);
    if (
      !route
      || sourceStepId !== route.reviewStepId
      || findActiveNode(state)?.stepId !== route.reviewStepId
    ) return null;
    return new DraftReviewPassCommit({ root, flowManager, route }).execute();
  }
}
