import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFailedEvaluations,
  GateIssueLogEntry,
} from "../../../src/flow/lib/run-gate.js";

describe("buildFailedEvaluations (REQ-4)", () => {
  it("extracts only FAIL evaluations as { guardrail_id, reason } pairs", () => {
    const evaluations = [
      { guardrail_id: "g1", result: "pass", reason: "ok" },
      { guardrail_id: "g2", result: "fail", reason: "bad 1" },
      { guardrail_id: "g3", result: "skip", reason: "n/a" },
      { guardrail_id: "g4", result: "fail", reason: "bad 2" },
    ];
    assert.deepEqual(buildFailedEvaluations(evaluations), [
      { guardrail_id: "g2", reason: "bad 1" },
      { guardrail_id: "g4", reason: "bad 2" },
    ]);
  });

  it("returns empty array when no FAIL evaluations are present", () => {
    const evaluations = [
      { guardrail_id: "g1", result: "pass", reason: "ok" },
    ];
    assert.deepEqual(buildFailedEvaluations(evaluations), []);
  });

  it("returns empty array for null or undefined input", () => {
    assert.deepEqual(buildFailedEvaluations(null), []);
    assert.deepEqual(buildFailedEvaluations(undefined), []);
  });
});

describe("appendIssueLogFromGateResult (REQ-4)", () => {
  const phase = "task-impl";

  it("writes failedEvaluations alongside the legacy flat reason field", () => {
    const entry = new GateIssueLogEntry({
      ctx: {
        phase,
        gitState: { headSha: "h", worktreeHash: "w" },
      },
      result: {
        result: "fail",
        artifacts: {
          phase,
          level: "child",
          evaluations: [
            { guardrail_id: "g-pass", result: "pass", reason: "ok" },
            { guardrail_id: "g-fail-1", result: "fail", reason: "bad one" },
            { guardrail_id: "g-fail-2", result: "fail", reason: "bad two" },
          ],
          issues: ["bad one", "bad two"],
        },
      },
    }).toJSON();

    assert.equal(entry.phase, phase);
    assert.equal(typeof entry.reason, "string");
    assert.match(entry.reason, /bad one/);
    assert.deepEqual(entry.failedEvaluations, [
      { guardrail_id: "g-fail-1", reason: "bad one" },
      { guardrail_id: "g-fail-2", reason: "bad two" },
    ]);
  });

  it("omits failedEvaluations when no FAIL evaluations are present", () => {
    const entry = new GateIssueLogEntry({
      ctx: { phase },
      result: {
        result: "fail",
        artifacts: {
          phase,
          level: "child",
          evaluations: [],
          issues: ["structural issue"],
        },
      },
    }).toJSON();

    assert.equal("failedEvaluations" in entry, false);
  });
});
