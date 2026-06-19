import { specIdFromPath } from "./flow-helpers.js";
import { Envelope } from "./flow-envelope.js";

const MAX_TARGET_TOKEN_LENGTH = 300;

function normalizedToken(value, field) {
  if (value == null) return null;
  if (typeof value !== "string" || value.trim() === "" || value.length > MAX_TARGET_TOKEN_LENGTH) {
    throw new Error(`${field} must be a non-empty string up to ${MAX_TARGET_TOKEN_LENGTH} characters`);
  }
  return value.trim();
}

function normalizedIssue(value) {
  if (value == null) return null;
  const issue = Number(value);
  if (!Number.isSafeInteger(issue) || issue < 1) {
    throw new Error(`--expect-issue must be a positive integer: ${value}`);
  }
  return issue;
}

function normalizedSpec(value) {
  const token = normalizedToken(value, "--expect-spec");
  return token == null ? null : specIdFromPath(token);
}

function normalizedRunId(value) {
  return normalizedToken(value, "--expect-run-id");
}

function activeIssueOf(state) {
  return state?.issue == null ? null : Number(state.issue);
}

function activeSpecOf(state) {
  return state?.spec ? specIdFromPath(state.spec) : null;
}

function activeRunIdOf(state) {
  return state?.runId || null;
}

export class FlowTargetExpectation {
  constructor(input = {}) {
    this.issue = normalizedIssue(input.expectIssue);
    this.spec = normalizedSpec(input.expectSpec);
    this.runId = normalizedRunId(input.expectRunId ?? input.expectRunID);
    Object.freeze(this);
  }

  get empty() {
    return this.issue == null && this.spec == null && this.runId == null;
  }

  mismatchAgainst(state) {
    if (this.empty || !state) return null;
    const mismatches = {};
    const activeIssue = activeIssueOf(state);
    const activeSpec = activeSpecOf(state);
    const activeRunId = activeRunIdOf(state);
    if (this.issue != null && activeIssue !== this.issue) {
      mismatches.expectedIssue = this.issue;
      mismatches.activeIssue = activeIssue;
    }
    if (this.spec != null && activeSpec !== this.spec) {
      mismatches.expectedSpec = this.spec;
      mismatches.activeSpec = activeSpec;
    }
    if (this.runId != null && activeRunId !== this.runId) {
      mismatches.expectedRunId = this.runId;
      mismatches.activeRunId = activeRunId;
    }
    if (Object.keys(mismatches).length === 0) return null;
    return {
      ...mismatches,
      ...(this.issue != null && !("expectedIssue" in mismatches) && { expectedIssue: this.issue, activeIssue }),
      ...(this.spec != null && !("expectedSpec" in mismatches) && { expectedSpec: this.spec, activeSpec }),
      ...(this.runId != null && !("expectedRunId" in mismatches) && { expectedRunId: this.runId, activeRunId }),
    };
  }
}

function mismatchSummary(data) {
  if ("expectedIssue" in data && data.expectedIssue !== data.activeIssue) {
    return `Another flow is active for Issue #${data.activeIssue ?? "none"} and does not match the specified #${data.expectedIssue}.`;
  }
  if ("expectedSpec" in data && data.expectedSpec !== data.activeSpec) {
    return `Another flow is active for spec ${data.activeSpec ?? "none"} and does not match the specified spec ${data.expectedSpec}.`;
  }
  if ("expectedRunId" in data && data.expectedRunId !== data.activeRunId) {
    return `Another flow is active for runId ${data.activeRunId ?? "none"} and does not match the specified runId ${data.expectedRunId}.`;
  }
  return "Another flow is active and does not match the specified target.";
}

export function buildTargetMismatchEnvelope({ type, key, data }) {
  return Envelope.fail(
    type,
    key,
    "ACTIVE_FLOW_MISMATCH",
    [
      mismatchSummary(data),
      "Stop before dispatching next-action, repair, run, finalize, or cleanup.",
    ],
    data,
  );
}

export function targetMismatchEnvelopeForInput({ type, key, input, flowState }) {
  let expectation;
  try {
    expectation = new FlowTargetExpectation(input);
  } catch (err) {
    return Envelope.fail(type, key, "ARGS_ERROR", err.message);
  }
  const data = expectation.mismatchAgainst(flowState);
  if (!data) return null;
  return buildTargetMismatchEnvelope({ type, key, data });
}
