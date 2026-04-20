import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseEvaluationResponse,
  EvaluationSchemaError,
} from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// REQ-5/6/7: 評価出力は構造化 schema、schema 不適合はエラー停止
// -----------------------------------------------------------------------------

describe("parseEvaluationResponse (REQ-5/6/7)", () => {
  const known = ["g1", "g2"];

  it("parses a well-formed JSON payload", () => {
    const resp = JSON.stringify({
      evaluations: [
        { guardrail_id: "g1", result: "pass", reason: "ok" },
        { guardrail_id: "g2", result: "fail", reason: "nope" },
      ],
    });
    const result = parseEvaluationResponse(resp, known);
    assert.equal(result.length, 2);
    assert.equal(result[0].guardrail_id, "g1");
    assert.equal(result[0].result, "pass");
    assert.equal(result[1].result, "fail");
  });

  it("strips code-fence wrappers before parsing", () => {
    const resp = "```json\n" + JSON.stringify({
      evaluations: [{ guardrail_id: "g1", result: "skip", reason: "n/a" }],
    }) + "\n```";
    const result = parseEvaluationResponse(resp, ["g1"]);
    assert.equal(result.length, 1);
    assert.equal(result[0].result, "skip");
  });

  it("throws on non-JSON free text (REQ-6: no silent PASS)", () => {
    assert.throws(
      () => parseEvaluationResponse("PASS: g1 — ok\nFAIL: g2 — bad", known),
      EvaluationSchemaError,
    );
  });

  it("throws on malformed JSON", () => {
    assert.throws(() => parseEvaluationResponse("{evaluations: not-json", known), EvaluationSchemaError);
  });

  it("throws when evaluations field is missing", () => {
    assert.throws(() => parseEvaluationResponse("{}", known), EvaluationSchemaError);
  });

  it("throws on unknown guardrail_id (REQ-7)", () => {
    const resp = JSON.stringify({
      evaluations: [{ guardrail_id: "unknown", result: "pass", reason: "x" }],
    });
    assert.throws(() => parseEvaluationResponse(resp, known), /unknown|guardrail_id/i);
  });

  it("throws on duplicate guardrail_id (REQ-7)", () => {
    const resp = JSON.stringify({
      evaluations: [
        { guardrail_id: "g1", result: "pass", reason: "a" },
        { guardrail_id: "g1", result: "fail", reason: "b" },
      ],
    });
    assert.throws(() => parseEvaluationResponse(resp, known), /duplicate|guardrail_id/i);
  });

  it("throws on invalid result value", () => {
    const resp = JSON.stringify({
      evaluations: [{ guardrail_id: "g1", result: "PASS", reason: "capitalized" }],
    });
    assert.throws(() => parseEvaluationResponse(resp, known), /result|pass|fail|skip/i);
  });

  it("throws when reason is missing", () => {
    const resp = JSON.stringify({
      evaluations: [{ guardrail_id: "g1", result: "pass" }],
    });
    assert.throws(() => parseEvaluationResponse(resp, known), /reason/i);
  });
});
