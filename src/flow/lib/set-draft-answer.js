import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { DraftLifecycle } from "./draft-lifecycle.js";

function parseDraft(bytes) {
  try {
    const value = JSON.parse(bytes.toString("utf8"));
    return new DraftLifecycle(value);
  } catch (cause) {
    throw new Error(`canonical draft is invalid: ${cause.message}`, { cause });
  }
}

export default class SetDraftAnswerCommand extends FlowCommand {
  execute(ctx) {
    const dropping = ctx.drop === true;
    if (!ctx.questionId || (dropping && !ctx.droppedReason) || (!dropping && (!ctx.answer || !ctx.why))) {
      return Envelope.fail(
        "set",
        "draft-answer",
        "INVALID_USAGE",
        "usage: flow set draft-answer <questionId> (--answer <text> --why <text> [--considered <text>] | --drop --dropped-reason <text>)",
      );
    }
    if (dropping && (ctx.answer || ctx.why || ctx.considered)) {
      return Envelope.fail(
        "set",
        "draft-answer",
        "INVALID_USAGE",
        "--drop cannot be combined with --answer, --why, or --considered",
      );
    }
    if (!dropping && ctx.droppedReason) {
      return Envelope.fail(
        "set",
        "draft-answer",
        "INVALID_USAGE",
        "--dropped-reason requires --drop",
      );
    }
    if (ctx.flowState.currentNodeId !== "draft-refine") {
      return Envelope.fail(
        "set",
        "draft-answer",
        "DRAFT_ANSWER_NOT_ACTIVE",
        "draft answers can be recorded only while draft-refine is active",
      );
    }
    if (ctx.flowState.autoApprove === true) {
      return Envelope.fail(
        "set",
        "draft-answer",
        "DRAFT_ANSWER_AUTO_APPROVE_ACTIVE",
        "manual draft answers are unavailable while autoApprove is active",
      );
    }

    const source = ctx.flowManager.readArtifact({
      specId: ctx.flowState.specId,
      logicalKey: "draft",
      consumerNodeId: "draft-refine",
    });
    let draft;
    try {
      draft = parseDraft(source.bytes).resolveQuestion({
        questionId: ctx.questionId,
        answer: dropping ? null : ctx.answer,
        why: dropping ? null : ctx.why,
        considered: dropping ? "" : (ctx.considered || ""),
        droppedReason: dropping ? ctx.droppedReason : null,
      });
    } catch (error) {
      return Envelope.fail("set", "draft-answer", "INVALID_DRAFT_ANSWER", error.message);
    }

    ctx.flowManager.publishArtifacts({
      specId: ctx.flowState.specId,
      nodeId: "draft-refine",
      artifactWrites: [{
        logicalKey: "draft",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify(draft, null, 2)}\n`, "utf8"),
      }],
    });
    return {
      questionId: ctx.questionId,
      status: dropping ? "dropped" : "answered",
      nextQuestionId: new DraftLifecycle(draft).nextUnresolvedQuestion()?.id ?? null,
    };
  }
}
