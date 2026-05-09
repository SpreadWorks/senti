// spec: R1 R2 R3 R4 R19 R20
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("parseGuardrailArticleEvaluation", () => {
  test("R1: GUARDRAIL_ARTICLE_EVAL_SCHEMA shape — article schema with optional reason and violations[{target, where, why_violates}]", async () => {
    const mod = await import("../../../src/flow/lib/run-gate.js");
    assert.ok(mod.GUARDRAIL_ARTICLE_EVAL_SCHEMA, "GUARDRAIL_ARTICLE_EVAL_SCHEMA must be exported");
    const itemProps = mod.GUARDRAIL_ARTICLE_EVAL_SCHEMA.properties.evaluations.items.properties;
    assert.ok(itemProps.guardrail_id, "entry has guardrail_id");
    assert.ok(itemProps.result, "entry has result");
    assert.ok(itemProps.reason, "entry has reason (optional)");
    assert.ok(itemProps.violations, "entry has violations (optional)");
    const vProps = itemProps.violations.items.properties;
    assert.ok(vProps.target, "violation has target");
    assert.ok(vProps.where, "violation has where");
    assert.ok(vProps.why_violates, "violation has why_violates");
  });

  test("R2: parseGuardrailArticleEvaluation rejects unknown guardrail id", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({ evaluations: [{ guardrail_id: "unknown-id", result: "pass", reason: "ok" }] });
    assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1"]), EvaluationSchemaError);
  });

  test("R2: parseGuardrailArticleEvaluation rejects duplicate guardrail id", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({
      evaluations: [
        { guardrail_id: "g1", result: "pass", reason: "ok" },
        { guardrail_id: "g1", result: "pass", reason: "again" },
      ],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1"]), EvaluationSchemaError);
  });

  test("R2: parseGuardrailArticleEvaluation rejects when known id is missing", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({ evaluations: [{ guardrail_id: "g1", result: "pass", reason: "ok" }] });
    assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1", "g2"]), EvaluationSchemaError);
  });

  test("R3: parseGuardrailArticleEvaluation rejects FAIL with missing violations", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({ evaluations: [{ guardrail_id: "g1", result: "fail", reason: "no violations" }] });
    assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1"]), EvaluationSchemaError);
  });

  test("R3: parseGuardrailArticleEvaluation rejects FAIL with empty violations[]", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({ evaluations: [{ guardrail_id: "g1", result: "fail", violations: [] }] });
    assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1"]), EvaluationSchemaError);
  });

  test("R3: parseGuardrailArticleEvaluation rejects violation with empty target/where/why_violates", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const cases = [
      { target: "", where: "w", why_violates: "y" },
      { target: "t", where: "", why_violates: "y" },
      { target: "t", where: "w", why_violates: "" },
    ];
    for (const v of cases) {
      const raw = JSON.stringify({ evaluations: [{ guardrail_id: "g1", result: "fail", violations: [v] }] });
      assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1"]), EvaluationSchemaError);
    }
  });

  test("R3: parseGuardrailArticleEvaluation rejects PASS entry containing violations field", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({
      evaluations: [
        {
          guardrail_id: "g1",
          result: "pass",
          reason: "ok",
          violations: [{ target: "t", where: "w", why_violates: "y" }],
        },
      ],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1"]), EvaluationSchemaError);
  });

  test("R3: parseGuardrailArticleEvaluation rejects SKIP entry without reason", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({ evaluations: [{ guardrail_id: "g1", result: "skip" }] });
    assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1"]), EvaluationSchemaError);
  });

  test("R3: parseGuardrailArticleEvaluation rejects duplicate (guardrail_id, target, where) triple", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({
      evaluations: [
        {
          guardrail_id: "g1",
          result: "fail",
          violations: [
            { target: "t", where: "w", why_violates: "first" },
            { target: "t", where: "w", why_violates: "duplicate" },
          ],
        },
      ],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1"]), EvaluationSchemaError);
  });

  test("R4: parseGuardrailArticleEvaluation derives FAIL reason as joined '<target> — <why_violates> (at <where>)'", async () => {
    const { parseGuardrailArticleEvaluation } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({
      evaluations: [
        {
          guardrail_id: "g1",
          result: "fail",
          violations: [
            { target: "vague-1", where: "section-A", why_violates: "lacks measurable criteria" },
            { target: "vague-2", where: "section-B", why_violates: "subjective adjective" },
          ],
        },
      ],
    });
    const parsed = parseGuardrailArticleEvaluation(raw, ["g1"]);
    assert.equal(
      parsed[0].reason,
      "vague-1 — lacks measurable criteria (at section-A); vague-2 — subjective adjective (at section-B)",
    );
  });

  test("R4: derived FAIL reason replaces any model-supplied reason on FAIL", async () => {
    const { parseGuardrailArticleEvaluation } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({
      evaluations: [
        {
          guardrail_id: "g1",
          result: "fail",
          reason: "model-supplied summary that should be replaced",
          violations: [{ target: "t", where: "w", why_violates: "y" }],
        },
      ],
    });
    const parsed = parseGuardrailArticleEvaluation(raw, ["g1"]);
    assert.equal(parsed[0].reason, "t — y (at w)");
  });

  test("R19: parseGuardrailArticleEvaluation rejects extra entry-level keys", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({
      evaluations: [{ guardrail_id: "g1", result: "pass", reason: "ok", extraField: "x" }],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1"]), EvaluationSchemaError);
  });

  test("R19: parseGuardrailArticleEvaluation rejects extra violation-level keys", async () => {
    const { parseGuardrailArticleEvaluation, EvaluationSchemaError } = await import("../../../src/flow/lib/run-gate.js");
    const raw = JSON.stringify({
      evaluations: [
        {
          guardrail_id: "g1",
          result: "fail",
          violations: [{ target: "t", where: "w", why_violates: "y", extra: "x" }],
        },
      ],
    });
    assert.throws(() => parseGuardrailArticleEvaluation(raw, ["g1"]), EvaluationSchemaError);
  });

  test("R20: parseGuardrailArticleEvaluation accepts JSON inside ```json fences (extractJsonCandidate reused)", async () => {
    const { parseGuardrailArticleEvaluation } = await import("../../../src/flow/lib/run-gate.js");
    const raw = "```json\n" + JSON.stringify({ evaluations: [{ guardrail_id: "g1", result: "pass", reason: "ok" }] }) + "\n```";
    const parsed = parseGuardrailArticleEvaluation(raw, ["g1"]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].guardrail_id, "g1");
  });
});
