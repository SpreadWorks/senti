/**
 * Draft lifecycle model and validation.
 *
 * draft.json is the source of truth for draft-time questions. Question state
 * lives in qa[].status, so no parallel questions[] structure is needed.
 */

export const DRAFT_LEGACY_QA_ERROR =
  "draft.json schema changed; run reopen-draft to regenerate qa[] with id/status, or abort and restart this flow";

export const DRAFT_QA_STATUSES = Object.freeze([
  "pending",
  "approved",
  "answered",
  "dropped",
]);

export const DRAFT_QA_CATEGORIES = Object.freeze([
  "goal-confirmation",
  "impact-scope",
  "acceptance-criteria",
  "constraint-non-goal",
  "risk-migration-policy",
  "user-visible-behavior",
  "dependency-integration-boundary",
  "implementation-policy",
  "follow-up-coverage",
]);

const DRAFT_DEV_TYPE_ENUM = Object.freeze([
  "feature",
  "bugfix",
  "refactor",
  "docs",
  "chore",
  "test",
  "other",
]);

const DRAFT_TOP_LEVEL_FIELDS = Object.freeze([
  "devType",
  "goal",
  "analysis",
  "decisionMap",
  "scopeVerification",
  "impactOnExisting",
  "qa",
  "openQuestions",
  "approval",
]);

const DRAFT_QA_ANSWER_REQUIRED_FIELDS = Object.freeze(["answer", "evidence", "why"]);
const DRAFT_QA_RESPONSE_FIELDS = Object.freeze([...DRAFT_QA_ANSWER_REQUIRED_FIELDS, "considered"]);
const DRAFT_QA_FIELDS = Object.freeze([
  "id",
  "status",
  "category",
  "question",
  ...DRAFT_QA_RESPONSE_FIELDS,
  "droppedReason",
]);
const DRAFT_QA_PENDING_APPROVED_EMPTY_FIELDS = Object.freeze([...DRAFT_QA_RESPONSE_FIELDS, "droppedReason"]);
const DRAFT_QA_UNRESOLVED_STATUSES = new Set(["pending", "approved"]);

const DRAFT_DECISION_MAP_FIELDS = Object.freeze([
  "knownFacts",
  "decisionPoints",
  "resolvedByProjectRules",
  "requiresUserJudgment",
  "deferredToSpec",
]);

const AMBIGUOUS_TOKENS = Object.freeze([
  "適切に",
  "必要なら",
  "できるだけ",
  "いい感じ",
  "なるべく",
  "適宜",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isEmptyString(value) {
  return typeof value === "string" && value.trim() === "";
}

function pushEmptyFieldIssues(issues, index, status, raw, fields) {
  for (const field of fields) {
    if (!isEmptyString(raw[field])) {
      issues.push(`qa[${index}]: ${field} must be empty when status is ${status}`);
    }
  }
}

function unknownFields(obj, allowed) {
  return Object.keys(obj).filter((key) => !allowed.includes(key));
}

function normalizeText(value) {
  return String(value || "").toLowerCase().trim().replace(/\s+/g, " ");
}

export class DraftQaEntry {
  constructor(raw, index) {
    if (!isObject(raw)) throw new Error(`qa[${index}] must be an object`);
    if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.status)) {
      throw new Error(DRAFT_LEGACY_QA_ERROR);
    }
    this.raw = raw;
    this.index = index;
    this.id = raw.id;
    this.status = raw.status;
    this.category = raw.category;
    this.question = raw.question;
    this.answer = raw.answer;
    this.evidence = raw.evidence;
    this.why = raw.why;
    this.considered = raw.considered;
    this.droppedReason = raw.droppedReason;
  }

  validate() {
    const issues = [];
    for (const field of unknownFields(this.raw, DRAFT_QA_FIELDS)) {
      issues.push(`qa[${this.index}]: unknown field "${field}"`);
    }
    if (!DRAFT_QA_STATUSES.includes(this.status)) {
      issues.push(`qa[${this.index}]: invalid status "${this.status}"`);
    }
    if (!DRAFT_QA_CATEGORIES.includes(this.category)) {
      issues.push(`qa[${this.index}]: invalid category "${this.category || ""}"`);
    }
    if (!isNonEmptyString(this.question)) {
      issues.push(`qa[${this.index}]: missing or empty question`);
    }
    if (typeof this.raw.considered !== "string") {
      issues.push(`qa[${this.index}]: considered must be a string`);
    }

    if (this.status === "pending" || this.status === "approved") {
      issues.push(`qa[${this.index}]: status ${this.status} blocks spec generation`);
      pushEmptyFieldIssues(issues, this.index, this.status, this.raw, DRAFT_QA_PENDING_APPROVED_EMPTY_FIELDS);
    }

    if (this.status === "answered") {
      for (const field of DRAFT_QA_ANSWER_REQUIRED_FIELDS) {
        if (!isNonEmptyString(this.raw[field])) {
          issues.push(`qa[${this.index}]: ${field} is required when status is answered`);
        }
      }
      if (normalizeText(this.answer).replace(/\s/g, "").length < 8) {
        issues.push(`qa[${this.index}]: answered entries require a non-shallow answer`);
      }
      if (!isEmptyString(this.raw.droppedReason)) {
        issues.push(`qa[${this.index}]: droppedReason must be empty when status is answered`);
      }
    }

    if (this.status === "dropped") {
      if (!isNonEmptyString(this.droppedReason)) {
        issues.push(`qa[${this.index}]: droppedReason is required when status is dropped`);
      }
      pushEmptyFieldIssues(issues, this.index, this.status, this.raw, DRAFT_QA_RESPONSE_FIELDS);
    }

    for (const [field, value] of [
      ["question", this.question],
      ["answer", this.answer],
      ["evidence", this.evidence],
      ["why", this.why],
      ["considered", this.considered],
      ["droppedReason", this.droppedReason],
    ]) {
      const text = normalizeText(value);
      if (AMBIGUOUS_TOKENS.some((token) => text.includes(token))) {
        issues.push(`qa[${this.index}]: ${field} contains ambiguous wording`);
      }
    }
    return issues;
  }

  resolve({ answer = null, why = null, considered = "", droppedReason = null } = {}) {
    if (!DRAFT_QA_UNRESOLVED_STATUSES.has(this.status)) {
      throw new Error(`qa[${this.index}]: status ${this.status} cannot be resolved again`);
    }
    const dropping = droppedReason !== null;
    const raw = {
      ...structuredClone(this.raw),
      status: dropping ? "dropped" : "answered",
      answer: dropping ? "" : answer,
      evidence: dropping ? "" : `Explicit user response recorded for ${this.id}.`,
      why: dropping ? "" : why,
      considered: dropping ? "" : considered,
      droppedReason: dropping ? droppedReason : "",
    };
    const resolved = new DraftQaEntry(raw, this.index);
    const issues = resolved.validate();
    if (issues.length > 0) throw new Error(issues.join("; "));
    return raw;
  }
}

export class DraftApproval {
  constructor(raw) {
    this.raw = raw;
  }

  validate() {
    if (!isObject(this.raw) || !this.raw.approved) {
      return ["draft approval is required: set approval.approved = true"];
    }
    return [];
  }
}

export class DraftDecisionMap {
  constructor(raw) {
    this.raw = raw;
  }

  validate() {
    const issues = [];
    if (!isObject(this.raw)) return ["missing decisionMap object"];

    for (const field of unknownFields(this.raw, DRAFT_DECISION_MAP_FIELDS)) {
      issues.push(`decisionMap: unknown field "${field}"`);
    }
    for (const field of DRAFT_DECISION_MAP_FIELDS) {
      const value = this.raw[field];
      if (!Array.isArray(value)) {
        issues.push(`decisionMap.${field} must be an array`);
        continue;
      }
      for (let i = 0; i < value.length; i++) {
        if (!isNonEmptyString(value[i])) {
          issues.push(`decisionMap.${field}[${i}] must be a non-empty string`);
        }
      }
    }
    return issues;
  }
}

export class DraftLifecycle {
  constructor(raw) {
    if (!isObject(raw)) throw new Error("draft must be a non-null object");
    this.raw = raw;
    this.qa = Array.isArray(raw.qa)
      ? raw.qa.map((entry, index) => new DraftQaEntry(entry, index))
      : [];
    this.decisionMap = new DraftDecisionMap(raw.decisionMap);
    this.approval = new DraftApproval(raw.approval);
  }

  validate() {
    const issues = [];
    for (const field of unknownFields(this.raw, DRAFT_TOP_LEVEL_FIELDS)) {
      issues.push(`unknown field "${field}"`);
    }

    if (!isNonEmptyString(this.raw.devType) || !DRAFT_DEV_TYPE_ENUM.includes(this.raw.devType)) {
      issues.push(
        `invalid devType "${this.raw.devType || ""}" (expected one of: ${DRAFT_DEV_TYPE_ENUM.join(", ")})`,
      );
    }
    if (!isNonEmptyString(this.raw.goal)) issues.push("missing or empty goal");

    const a = this.raw.analysis;
    if (!isObject(a)) {
      issues.push("missing analysis object");
    } else {
      for (const field of ["problem", "proposedApproach", "validation"]) {
        if (!isNonEmptyString(a[field])) issues.push(`missing or empty analysis.${field}`);
      }
    }

    issues.push(...this.decisionMap.validate());

    if (!Array.isArray(this.raw.qa)) {
      issues.push("missing qa array");
    } else {
      const ids = new Set();
      const questions = new Set();
      for (const entry of this.qa) issues.push(...entry.validate());
      for (const entry of this.qa) {
        if (!/^q\d+$/.test(entry.id)) {
          issues.push(`qa[${entry.index}]: id must match q<N>`);
        }
        if (ids.has(entry.id)) {
          issues.push(`qa[${entry.index}]: duplicate id "${entry.id}"`);
        }
        ids.add(entry.id);
        if (entry.status !== "dropped") {
          const normalizedQuestion = normalizeText(entry.question);
          if (normalizedQuestion && questions.has(normalizedQuestion)) {
            issues.push(`qa[${entry.index}]: duplicate question`);
          }
          questions.add(normalizedQuestion);
        }
      }
    }

    issues.push(...this.approval.validate());
    return issues;
  }

  countByStatus() {
    const counts = Object.fromEntries(DRAFT_QA_STATUSES.map((status) => [status, 0]));
    for (const entry of this.qa) counts[entry.status] += 1;
    return counts;
  }

  nextQaId() {
    const nums = this.qa
      .map((entry) => /^q(\d+)$/.exec(entry.id))
      .filter(Boolean)
      .map((match) => Number(match[1]));
    return `q${Math.max(0, ...nums) + 1}`;
  }

  nextUnresolvedQuestion() {
    return this.qa.find((entry) => DRAFT_QA_UNRESOLVED_STATUSES.has(entry.status)) ?? null;
  }

  resolveQuestion({ questionId, answer = null, why = null, considered = "", droppedReason = null } = {}) {
    const next = this.nextUnresolvedQuestion();
    if (next === null) throw new Error("draft has no unresolved question");
    if (questionId !== next.id) {
      throw new Error(`draft question changed: expected ${next.id}, got ${questionId || "(empty)"}`);
    }
    const draft = structuredClone(this.raw);
    draft.qa[next.index] = next.resolve({ answer, why, considered, droppedReason });
    return draft;
  }
}

export function parseDraftLifecycle(raw) {
  return new DraftLifecycle(raw);
}

export function validateDraftLifecycle(raw) {
  try {
    return parseDraftLifecycle(raw).validate();
  } catch (err) {
    return [err.message];
  }
}

export function countDraftLifecycleQa(raw) {
  return parseDraftLifecycle(raw).countByStatus();
}

export function nextDraftQaId(raw) {
  return parseDraftLifecycle(raw).nextQaId();
}
