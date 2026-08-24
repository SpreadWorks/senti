/** Read-only facts for the definition-owned draft question ledger boundary. */
import { DraftLifecycle } from "./draft-lifecycle.js";
import { DraftQuestionLedger } from "./draft-question-ledger.js";

export class DraftQuestionFact {
  constructor({ id, question, revision, publication, evidenceDigest } = {}) {
    if (typeof id !== "string" || id.trim() === "") throw new Error("draft question id must be a non-empty string");
    if (typeof question !== "string" || question.trim() === "") throw new Error("draft question text must be a non-empty string");
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("draft question revision is invalid");
    this.id = id; this.question = question; this.revision = revision;
    this.publication = typeof publication === "string" && publication.trim() !== "" ? publication : null;
    this.evidenceDigest = typeof evidenceDigest === "string" && /^[a-f0-9]{64}$/.test(evidenceDigest) ? evidenceDigest : null;
    Object.freeze(this);
  }
}
export class DraftTransitionFacts {
  constructor({ ledger, nextQuestion = null, candidateQuestion = null } = {}) {
    if (!(ledger instanceof DraftQuestionLedger)) throw new Error("draft transition facts require a typed ledger");
    if (nextQuestion !== null && !(nextQuestion instanceof DraftQuestionFact)) throw new Error("draft transition facts require a typed next question");
    if (candidateQuestion !== null && !(candidateQuestion instanceof DraftQuestionFact)) throw new Error("draft transition facts require a typed candidate question");
    this.ledger = ledger; this.nextQuestion = nextQuestion; this.candidateQuestion = candidateQuestion; Object.freeze(this);
  }
  static fromDraft(draft) {
    if (!(draft instanceof DraftLifecycle)) throw new Error("draft transition facts require a DraftLifecycle");
    if (draft.questionLedger === null) throw new Error(draft.validateQuestionStructure().join("; "));
    const question = draft.questionLedger.nextAwaiting();
    const candidate = draft.questionLedger.nextCandidate();
    return new DraftTransitionFacts({ ledger: draft.questionLedger, nextQuestion: question === null ? null : new DraftQuestionFact(question), candidateQuestion: candidate === null ? null : new DraftQuestionFact(candidate) });
  }
}
export class DraftTransitionFactsError extends Error { constructor(code, message) { super(message); this.name = "DraftTransitionFactsError"; this.code = code; } }
export function readDraftTransitionFacts({ flowManager, flowState } = {}) {
  const source = flowManager.readArtifact({ specId: flowState.specId, logicalKey: "draft", consumerNodeId: "draft-refine", optional: true });
  if (source === null) return null;
  try { return DraftTransitionFacts.fromDraft(new DraftLifecycle(JSON.parse(source.bytes.toString("utf8")))); }
  catch (cause) { throw new DraftTransitionFactsError("DRAFT_SCHEMA_INVALID", `canonical draft question ledger is invalid: ${cause.message}; run reopen-draft to regenerate a valid questionLedger`); }
}
