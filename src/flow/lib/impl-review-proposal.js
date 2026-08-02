import crypto from "crypto";
import { validateSchema } from "../../lib/schema-validate.js";
import { WorkUnitToolingFailure } from "./work-unit.js";

const IMPL_REVIEW_PROPOSAL_SCHEMA_VERSION = "impl-review-proposals-v2";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requireText(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string`);
  }
  if (value.includes("\0")) throw new Error(`${name} must not contain NUL`);
  return value.trim();
}

function normalizeRequirementIds(requirementIds) {
  if (!(requirementIds instanceof Set)) {
    throw new Error("impl review proposal requirementIds must be a Set");
  }
  return [...new Set([...requirementIds].map((id) => requireText(id, "requirementId")))].sort();
}

function normalizeFile(value) {
  const file = requireText(value, "file").replace(/\\/g, "/");
  if (file.startsWith("/") || /^[A-Za-z]:\//.test(file)) {
    throw new Error("file must be repository-relative");
  }
  if (file.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("file must be a normalized repository-relative path");
  }
  return file;
}

function proposalSchema(requirementIds) {
  return {
    type: "object",
    required: ["title", "file", "issue", "suggestion", "requirementId"],
    additionalProperties: false,
    properties: {
      title: { type: "string", minLength: 1, pattern: "\\S" },
      file: { type: "string", minLength: 1, pattern: "\\S" },
      issue: { type: "string", minLength: 1, pattern: "\\S" },
      suggestion: { type: "string", minLength: 1, pattern: "\\S" },
      requirementId: { type: "string", enum: [...requirementIds] },
    },
  };
}

function responseSchema(requirementIds) {
  const proposals = requirementIds.length > 0
    ? { type: "array", items: proposalSchema(requirementIds) }
    : { type: "array", maxItems: 0 };
  return {
    type: "object",
    required: ["proposals"],
    additionalProperties: false,
    properties: {
      proposals,
    },
  };
}

function fmtFallback(schema) {
  return [
    "Return only JSON that satisfies the supplied schema.",
    "Use an empty proposals array when no proposal is backed by an allowed requirement.",
    JSON.stringify(schema, null, 2),
  ].join("\n");
}

export class ImplReviewProposal {
  #requirementIds;

  constructor(input, { requirementIds }) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("impl review proposal must be an object");
    }
    this.#requirementIds = new Set(normalizeRequirementIds(requirementIds));
    this.title = requireText(input.title, "title");
    this.file = normalizeFile(input.file);
    this.issue = requireText(input.issue, "issue");
    this.suggestion = requireText(input.suggestion, "suggestion");
    this.requirementId = requireText(input.requirementId, "requirementId");
    if (!this.#requirementIds.has(this.requirementId)) {
      throw new Error(`requirementId is not present in the active spec: ${this.requirementId}`);
    }
    Object.freeze(this);
  }

  retarget(file) {
    return new ImplReviewProposal({ ...this.toJSON(), file }, { requirementIds: this.#requirementIds });
  }

  toJSON() {
    return {
      title: this.title,
      file: this.file,
      issue: this.issue,
      suggestion: this.suggestion,
      requirementId: this.requirementId,
    };
  }
}

export class ImplReviewProposalBatch {
  constructor(proposals = []) {
    if (!Array.isArray(proposals) || proposals.some((proposal) => !(proposal instanceof ImplReviewProposal))) {
      throw new Error("impl review proposal batch requires ImplReviewProposal values");
    }
    this.proposals = Object.freeze([...proposals]);
    Object.freeze(this);
  }

  toJSON() {
    return { proposals: this.proposals.map((proposal) => proposal.toJSON()) };
  }
}

export class ImplReviewProposalPrompt {
  constructor({ userPrompt, systemPrompt, jsonSchema, fmtFallback: fallback }) {
    this.userPrompt = requireText(userPrompt, "userPrompt");
    this.systemPrompt = requireText(systemPrompt, "systemPrompt");
    this.jsonSchema = jsonSchema;
    this.fmtFallback = requireText(fallback, "fmtFallback");
    Object.freeze(this);
  }
}

export class ImplReviewProposalContract {
  constructor(requirementIds) {
    this.schemaVersion = IMPL_REVIEW_PROPOSAL_SCHEMA_VERSION;
    this.allowedRequirementIds = Object.freeze(normalizeRequirementIds(requirementIds));
    this.jsonSchema = deepFreeze(responseSchema(this.allowedRequirementIds));
    this.schemaDigest = crypto.createHash("sha256").update(JSON.stringify(this.jsonSchema)).digest("hex");
    this.fmtFallback = fmtFallback(this.jsonSchema);
    Object.freeze(this);
  }

  prompt({ userPrompt, systemPrompt }) {
    return new ImplReviewProposalPrompt({
      userPrompt,
      systemPrompt,
      jsonSchema: this.jsonSchema,
      fmtFallback: this.fmtFallback,
    });
  }

  parse(rawResponse) {
    if (typeof rawResponse !== "string" || rawResponse.trim() === "") {
      throw new WorkUnitToolingFailure({
        failureKind: "parser_failure",
        message: "impl review proposal response must be non-empty JSON",
        rawResponse,
      });
    }
    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch (cause) {
      throw new WorkUnitToolingFailure({
        failureKind: "parser_failure",
        message: `impl review proposal response is not JSON: ${cause.message}`,
        rawResponse,
        cause,
      });
    }
    return this.fromJSON(parsed, rawResponse);
  }

  fromJSON(value, rawResponse = null) {
    const errors = validateSchema(value, this.jsonSchema);
    if (errors.length > 0) {
      throw new WorkUnitToolingFailure({
        failureKind: "schema_failure",
        message: `impl review proposal response failed schema validation: ${errors.join("; ")}`,
        rawResponse,
      });
    }
    try {
      return new ImplReviewProposalBatch(
        value.proposals.map((proposal) => new ImplReviewProposal(proposal, {
          requirementIds: new Set(this.allowedRequirementIds),
        })),
      );
    } catch (cause) {
      throw new WorkUnitToolingFailure({
        failureKind: "schema_failure",
        message: `impl review proposal invariant failed: ${cause.message}`,
        rawResponse,
        cause,
      });
    }
  }
}

export { IMPL_REVIEW_PROPOSAL_SCHEMA_VERSION };
