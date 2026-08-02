import path from "node:path";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { findActiveNode, resolveMaxAttempts } from "../definition.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { buildRepairFingerprint } from "./impl-repair-artifacts.js";
import { ReviewTargetState } from "./review-convergence.js";
import {
  ReviewEvidenceInput,
  ReviewEvidenceRegistrar,
  ReviewEvidenceStore,
  resolveCurrentReviewTreeSha,
} from "./review-evidence-store.js";
import { ReviewDisposition, ReviewEvidence } from "./review-convergence.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";

const PHASE_BY_REVIEW_STEP = Object.freeze({
  "draft-questions-review": "draft-questions",
  "draft-coverage-review": "draft-coverage",
  "spec-review": "spec",
  "test-review": "test",
  "impl-review": "impl",
  "task-review": "impl",
});

class FinalizedFlowReviewArtifact {
  constructor(providerArtifact, state) {
    if (!providerArtifact?.finalized || providerArtifact.verdict !== "PASS") {
      throw new Error("finalized PASS provider artifact is required");
    }
    if (providerArtifact.phase !== state?.phase) throw new Error("provider artifact phase does not match current state");
    if (providerArtifact.taskId !== null || state?.taskId !== null) {
      throw new Error("provider artifact task target does not match flow-level state");
    }
    if (providerArtifact.treeSha !== state.treeSha) throw new Error("provider artifact tree does not match current state");
    if (providerArtifact.targetStateDigest !== state.targetStateDigest) {
      throw new Error("provider artifact state digest does not match current state");
    }
    this.phase = state.phase;
    this.taskId = null;
    this.treeSha = state.treeSha;
    this.targetStateDigest = state.targetStateDigest;
    const provenance = providerArtifact.provenance || {
      provider: "senti-review",
      invocationId: "recovered-finalized-artifact",
      capturedAt: providerArtifact.generatedAt || new Date().toISOString(),
    };
    this.evidence = new ReviewEvidence({
      phase: this.phase,
      taskId: this.taskId,
      treeSha: this.treeSha,
      targetStateDigest: this.targetStateDigest,
      provenance,
      disposition: new ReviewDisposition({
        value: providerArtifact.verdict,
        blockingFindings: providerArtifact.blockingFindings || providerArtifact.findings || [],
        advisoryFindings: providerArtifact.advisoryFindings || [],
      }),
    });
    Object.freeze(this);
  }

  toRegistration() {
    return {
      phase: this.phase,
      taskId: this.taskId,
      treeSha: this.treeSha,
      targetStateDigest: this.targetStateDigest,
    };
  }
}

/**
 * Register an already-finalized flow-level provider artifact without invoking
 * the provider again. The canonical evidence store remains the registration
 * boundary; this adapter only verifies that the artifact still targets the
 * current flow state.
 */
export function recoverFinalizedFlowReviewEvidence({ providerArtifact, state, canonicalEvidenceStore } = {}) {
  if (!canonicalEvidenceStore || typeof canonicalEvidenceStore.register !== "function") {
    throw new Error("canonical evidence store must provide register");
  }
  const artifact = new FinalizedFlowReviewArtifact(providerArtifact, state);
  canonicalEvidenceStore.register(artifact.evidence);
  return artifact;
}

function currentReviewTarget(flowState, treeSha) {
  const active = findActiveNode(flowState);
  const phase = PHASE_BY_REVIEW_STEP[active?.stepId];
  if (!phase) {
    const error = new Error("review evidence can be registered only for the active review step");
    error.code = "REVIEW_TARGET_NOT_ACTIVE";
    throw error;
  }
  return {
    phase,
    taskId: active.scope === "task" ? active.taskId : null,
    treeSha,
    semanticMaxAttempts: resolveMaxAttempts({
      scope: active.scope,
      stepId: active.stepId,
      context: flowState,
    }),
  };
}

export default class SetReviewEvidenceCommand extends FlowCommand {
  execute(ctx) {
    if (typeof ctx.file !== "string" || ctx.file.trim() === "") {
      return Envelope.fail(
        "set",
        "review-evidence",
        "INVALID_USAGE",
        "usage: flow set review-evidence --file <path>",
      );
    }
    const specPath = relativeFlowSpecFile(ctx.flowState);
    const specDir = resolveSpecDir(path.resolve(ctx.root, specPath));
    let input;
    let target;
    try {
      input = ReviewEvidenceInput.fromFile({
        root: ctx.executionRoot || ctx.root,
        specDir,
        inputPath: ctx.file,
      });
      target = currentReviewTarget(
        ctx.flowState,
        resolveCurrentReviewTreeSha(ctx.executionRoot || ctx.root, specPath),
      );
      const fingerprint = buildRepairFingerprint({
        root: ctx.executionRoot || ctx.root,
        artifactRoot: ctx.root,
        specPath,
        state: ctx.flowState,
      });
      target.targetStateDigest = fingerprint.hash;
      target.targetState = ReviewTargetState.fromRepairFingerprint(fingerprint);
      input.validateTarget(target);
    } catch (error) {
      if (!error.code && /tree target mismatch/.test(error.message)) {
        error.code = "STALE_REVIEW_TARGET";
      } else if (!error.code) {
        error.code = "REVIEW_EVIDENCE_INVALID";
      }
      throw error;
    }

    const store = new ReviewEvidenceStore({ root: ctx.root, specDir });
    const registrar = new ReviewEvidenceRegistrar({ store });
    let registration;
    ctx.flowManager.mutate((flowState) => {
      registration = registrar.register({
        flowState,
        evidence: input.toEvidence(target),
        expectedRevision: flowState,
        configuredSemanticMaxAttempts: target.semanticMaxAttempts,
        targetStateDigest: target.targetStateDigest,
        targetState: target.targetState,
      });
      registration.applyTo(flowState);
    }, {
      expectedOriginal: ctx.flowState,
      passThroughError: (error) => typeof error?.code === "string" && error.code.startsWith("REVIEW_"),
    });

    return registration.toCommandResult({
      root: ctx.root,
      target,
      evidence: input.evidence,
    });
  }
}
