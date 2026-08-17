// spec: R5
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("EvaluationSchemaError code and gate envelope behavior", () => {
  test("R5: EvaluationSchemaError instance carries code 'EVALUATION_SCHEMA_ERROR'", async () => {
    const { EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const err = new EvaluationSchemaError("test message");
    assert.equal(err.code, "EVALUATION_SCHEMA_ERROR");
    assert.equal(err.name, "EvaluationSchemaError");
    assert.equal(err.message, "test message");
  });

  test("R5: parseGuardrailArticleEvaluation throws EvaluationSchemaError carrying the new code", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({ evaluations: [{ guardrail_id: "g1", result: "fail" }] });
    let caught = null;
    try {
      parseGuardrailArticleEvaluation(raw, ["g1"]);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof EvaluationSchemaError);
    assert.equal(caught.code, "EVALUATION_SCHEMA_ERROR");
  });

  test("R5: parseImplRequirementEvaluation throws EvaluationSchemaError carrying the new code", async () => {
    const { parseImplRequirementEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({ evaluations: [{ guardrail_id: "R1", result: "pass" }] });
    let caught = null;
    try {
      parseImplRequirementEvaluation(raw, ["R1"]);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof EvaluationSchemaError);
    assert.equal(caught.code, "EVALUATION_SCHEMA_ERROR");
  });
});
