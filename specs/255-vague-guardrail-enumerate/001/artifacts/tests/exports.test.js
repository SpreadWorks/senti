// spec: R14
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("Named exports for the new article-evaluation surface", () => {
  test("R14: src/flow/lib/run-gate.js exports GUARDRAIL_ARTICLE_EVAL_SCHEMA", async () => {
    const mod = await import("../../../src/flow/lib/run-gate.js");
    assert.ok(mod.GUARDRAIL_ARTICLE_EVAL_SCHEMA, "GUARDRAIL_ARTICLE_EVAL_SCHEMA must be exported");
  });

  test("R14: src/flow/lib/run-gate.js exports IMPL_REQUIREMENT_EVAL_SCHEMA", async () => {
    const mod = await import("../../../src/flow/lib/run-gate.js");
    assert.ok(mod.IMPL_REQUIREMENT_EVAL_SCHEMA, "IMPL_REQUIREMENT_EVAL_SCHEMA must be exported");
  });

  test("R14: src/flow/lib/run-gate.js exports parseGuardrailArticleEvaluation", async () => {
    const mod = await import("../../../src/flow/lib/run-gate.js");
    assert.equal(typeof mod.parseGuardrailArticleEvaluation, "function");
  });

  test("R14: src/flow/lib/run-gate.js exports parseImplRequirementEvaluation", async () => {
    const mod = await import("../../../src/flow/lib/run-gate.js");
    assert.equal(typeof mod.parseImplRequirementEvaluation, "function");
  });

  test("R14: src/flow/lib/run-gate.js exports buildGuardrailArticleEvalPrompt", async () => {
    const mod = await import("../../../src/flow/lib/run-gate.js");
    assert.equal(typeof mod.buildGuardrailArticleEvalPrompt, "function");
  });

  test("R14: parseEvaluationResponse and GUARDRAIL_EVAL_SCHEMA are no longer exported", async () => {
    const mod = await import("../../../src/flow/lib/run-gate.js");
    assert.equal(mod.parseEvaluationResponse, undefined, "parseEvaluationResponse must be removed");
    assert.equal(mod.GUARDRAIL_EVAL_SCHEMA, undefined, "GUARDRAIL_EVAL_SCHEMA must be removed");
  });
});
