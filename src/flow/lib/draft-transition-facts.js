/**
 * Read-only facts for the definition-owned draft-refinement boundary.
 *
 * draft.json is the canonical authority. This module validates and projects
 * that artifact into typed facts, but never decides whether a worker may run.
 */
import { DraftLifecycle } from "./draft-lifecycle.js";

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

export class DraftQuestionFact {
  constructor({ id, status, question } = {}) {
    this.id = requireString(id, "draft question id");
    if (!["pending", "approved"].includes(status)) {
      throw new Error("draft question fact requires an unresolved status");
    }
    this.status = status;
    this.question = requireString(question, "draft question text");
    Object.freeze(this);
  }
}

export class DraftTransitionFacts {
  constructor({ nextQuestion = null } = {}) {
    if (nextQuestion !== null && !(nextQuestion instanceof DraftQuestionFact)) {
      throw new Error("draft transition facts require a typed next question");
    }
    this.nextQuestion = nextQuestion;
    Object.freeze(this);
  }

  static fromDraft(draft) {
    if (!(draft instanceof DraftLifecycle)) {
      throw new Error("draft transition facts require a DraftLifecycle");
    }
    const question = draft.nextUnresolvedQuestion();
    return new DraftTransitionFacts({
      nextQuestion: question === null
        ? null
        : new DraftQuestionFact({
            id: question.id,
            status: question.status,
            question: question.question,
          }),
    });
  }
}

export class DraftTransitionFactsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DraftTransitionFactsError";
    this.code = code;
  }
}

export function readDraftTransitionFacts({ flowManager, flowState } = {}) {
  const source = flowManager.readArtifact({
    specId: flowState.specId,
    logicalKey: "draft",
    consumerNodeId: "draft-refine",
    optional: true,
  });
  if (source === null) return null;

  let draft;
  try {
    draft = new DraftLifecycle(JSON.parse(source.bytes.toString("utf8")));
  } catch (cause) {
    throw new DraftTransitionFactsError(
      "DRAFT_QUESTION_SOURCE_INVALID",
      `canonical draft question source is invalid: ${cause.message}`,
    );
  }
  const structureIssues = draft.validateQuestionStructure();
  if (structureIssues.length > 0) {
    throw new DraftTransitionFactsError(
      "DRAFT_SCHEMA_INVALID",
      `canonical draft question schema is invalid: ${structureIssues.join("; ")}. Run the guarded reopen-draft command to regenerate the draft`,
    );
  }
  return DraftTransitionFacts.fromDraft(draft);
}
