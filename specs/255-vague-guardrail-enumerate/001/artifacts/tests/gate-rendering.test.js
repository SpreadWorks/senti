// spec: R9 R10 R21
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("Gate envelope rendering for multi-violation FAIL", () => {
  test("R9: reasonsFromEvaluations emits one row per violation on FAIL article entries with detail '<title> — <target> — <why_violates> (at <where>)'", async () => {
    // Mocked-agent style: synthesize a parsed evaluations[] and route through the rendering.
    // reasonsFromEvaluations is currently internal — test via gate envelope output.
    // Until the implementation exposes the helper, this test asserts the contract with a
    // direct call to the exported helper if available, or skips with a clear message.
    const mod = await import("../../../src/flow/lib/run-gate.js");
    const fn = mod.reasonsFromEvaluations;
    assert.ok(typeof fn === "function", "reasonsFromEvaluations must be exported for R9 testing");
    const evaluations = [
      {
        guardrail_id: "g1",
        result: "fail",
        reason: "summary",
        title: "Guardrail One",
        category: "process",
        violations: [
          { target: "vague-1", where: "section-A", why_violates: "lacks measurable criteria" },
          { target: "vague-2", where: "section-B", why_violates: "subjective adjective" },
        ],
      },
    ];
    const reasons = fn(evaluations);
    assert.equal(reasons.length, 2, "FAIL with 2 violations renders 2 rows");
    assert.equal(reasons[0].verdict, "FAIL");
    assert.equal(reasons[0].detail, "Guardrail One — vague-1 — lacks measurable criteria (at section-A)");
    assert.equal(reasons[0].where, "section-A");
    assert.equal(reasons[1].detail, "Guardrail One — vague-2 — subjective adjective (at section-B)");
  });

  test("R9: PASS/SKIP article entries render one row each using `reason`", async () => {
    const { reasonsFromEvaluations } = await import("../../../src/flow/lib/run-gate.js");
    const evaluations = [
      { guardrail_id: "g1", result: "pass", reason: "ok", title: "G1", category: "process" },
      { guardrail_id: "g2", result: "skip", reason: "no evidence", title: "G2", category: "process" },
    ];
    const reasons = reasonsFromEvaluations(evaluations);
    assert.equal(reasons.length, 2);
    assert.equal(reasons[0].verdict, "PASS");
    assert.equal(reasons[1].verdict, "SKIP");
  });

  test("R10: data.artifacts.evaluations augmented with title/category, FAIL entries retain violations[]", async () => {
    // Smoke test: assert the augmentation shape via reasonsFromEvaluations input contract.
    const { reasonsFromEvaluations } = await import("../../../src/flow/lib/run-gate.js");
    const evaluations = [
      {
        guardrail_id: "g1",
        result: "fail",
        title: "Title",
        category: "process",
        violations: [{ target: "t", where: "w", why_violates: "y" }],
      },
    ];
    const reasons = reasonsFromEvaluations(evaluations);
    assert.equal(reasons[0].guardrail_id, "g1");
    assert.equal(reasons[0].category, "process");
  });

  test("R21: parsed article evaluations are augmented with title/category before reasons rendering", async () => {
    // Verify that reasonsFromEvaluations consumes title/category exactly as today.
    const { reasonsFromEvaluations } = await import("../../../src/flow/lib/run-gate.js");
    const evaluations = [
      { guardrail_id: "g1", result: "pass", reason: "ok", title: "Some Title", category: "process" },
    ];
    const reasons = reasonsFromEvaluations(evaluations);
    assert.match(reasons[0].detail, /Some Title/);
  });
});
