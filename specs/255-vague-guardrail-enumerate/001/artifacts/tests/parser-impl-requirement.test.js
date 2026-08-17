// spec: R7
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("parseImplRequirementEvaluation (renamed, semantics unchanged)", () => {
  test("R7: parseImplRequirementEvaluation rejects unknown id (parity with old parser)", async () => {
    const { parseImplRequirementEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({ evaluations: [{ guardrail_id: "unknown", result: "pass", reason: "ok" }] });
    assert.throws(() => parseImplRequirementEvaluation(raw, ["R1"]), EvaluationSchemaError);
  });

  test("R7: parseImplRequirementEvaluation rejects duplicate id", async () => {
    const { parseImplRequirementEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({
      evaluations: [
        { guardrail_id: "R1", result: "pass", reason: "first" },
        { guardrail_id: "R1", result: "pass", reason: "duplicate" },
      ],
    });
    assert.throws(() => parseImplRequirementEvaluation(raw, ["R1"]), EvaluationSchemaError);
  });

  test("R7: parseImplRequirementEvaluation rejects missing required id", async () => {
    const { parseImplRequirementEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({ evaluations: [{ guardrail_id: "R1", result: "pass", reason: "ok" }] });
    assert.throws(() => parseImplRequirementEvaluation(raw, ["R1", "R2"]), EvaluationSchemaError);
  });

  test("R7: parseImplRequirementEvaluation requires reason on every entry (single-reason contract preserved)", async () => {
    const { parseImplRequirementEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({ evaluations: [{ guardrail_id: "R1", result: "pass" }] });
    assert.throws(() => parseImplRequirementEvaluation(raw, ["R1"]), EvaluationSchemaError);
  });

  test("R7: parseImplRequirementEvaluation accepts valid PASS/FAIL/SKIP entries with reason", async () => {
    const { parseImplRequirementEvaluation } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({
      evaluations: [
        { guardrail_id: "R1", result: "pass", reason: "implemented" },
        { guardrail_id: "R2", result: "fail", reason: "not implemented in diff" },
        { guardrail_id: "R3", result: "skip", reason: "needs runtime evidence" },
      ],
    });
    const parsed = parseImplRequirementEvaluation(raw, ["R1", "R2", "R3"]);
    assert.equal(parsed.length, 3);
    assert.equal(parsed[1].reason, "not implemented in diff");
  });
});
