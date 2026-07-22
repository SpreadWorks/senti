import path from "node:path";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { findActiveNode, resolveMaxAttempts } from "../definition.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import { buildRepairFingerprint } from "./impl-repair-artifacts.js";
import {
  ReviewEvidenceInput,
  ReviewEvidenceRegistrar,
  ReviewEvidenceStore,
  resolveCurrentReviewTreeSha,
} from "./review-evidence-store.js";

const PHASE_BY_REVIEW_STEP = Object.freeze({
  "draft-questions-review": "draft-questions",
  "draft-coverage-review": "draft-coverage",
  "spec-review": "spec",
  "test-review": "test",
  "impl-review": "impl",
  "task-review": "impl",
});

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
    const specDir = resolveSpecDir(path.resolve(ctx.root, ctx.flowState.spec));
    let input;
    let target;
    try {
      input = ReviewEvidenceInput.fromFile({
        root: ctx.root,
        specDir,
        inputPath: ctx.file,
      });
      target = currentReviewTarget(ctx.flowState, resolveCurrentReviewTreeSha(ctx.root));
      target.targetStateDigest = buildRepairFingerprint({
        root: ctx.root,
        specPath: ctx.flowState.spec,
        state: ctx.flowState,
      }).hash;
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
