// spec: R17
import { describe, test } from "node:test";
import assert from "node:assert/strict";

describe("applyFlipOverride drops violations on flip", () => {
  test("R17: flipping FAIL article entry to PASS removes violations field from the result", async () => {
    const { applyFlipOverride } = await import("../../../src/flow/lib/run-gate.js");
    const evaluations = [
      {
        guardrail_id: "g1",
        result: "fail",
        reason: "derived summary",
        violations: [{ target: "t", where: "w", why_violates: "y" }],
      },
    ];
    const previousEntry = { passedGuardrails: ["g1"], headSha: "abc", worktreeHash: "def" };
    const currentState = { headSha: "abc", worktreeHash: "def" };
    const result = applyFlipOverride({ evaluations, previousEntry, currentState, phase: "spec" });
    assert.equal(result[0].result, "pass");
    assert.equal(Object.prototype.hasOwnProperty.call(result[0], "violations"), false, "violations field must be absent on flipped PASS entry");
  });

  test("R17: flip preserves the existing flip-marker reason text suffix", async () => {
    const { applyFlipOverride } = await import("../../../src/flow/lib/run-gate.js");
    const evaluations = [
      {
        guardrail_id: "g1",
        result: "fail",
        reason: "original derived",
        violations: [{ target: "t", where: "w", why_violates: "y" }],
      },
    ];
    const previousEntry = { passedGuardrails: ["g1"], headSha: "abc", worktreeHash: "def" };
    const currentState = { headSha: "abc", worktreeHash: "def" };
    const result = applyFlipOverride({ evaluations, previousEntry, currentState, phase: "spec" });
    assert.match(result[0].reason, /flip override/i);
  });

  test("R17: applyFlipOverride does not flip when previous and current states differ", async () => {
    const { applyFlipOverride } = await import("../../../src/flow/lib/run-gate.js");
    const evaluations = [
      {
        guardrail_id: "g1",
        result: "fail",
        reason: "derived",
        violations: [{ target: "t", where: "w", why_violates: "y" }],
      },
    ];
    const previousEntry = { passedGuardrails: ["g1"], headSha: "abc", worktreeHash: "def" };
    const currentState = { headSha: "xyz", worktreeHash: "qqq" };
    const result = applyFlipOverride({ evaluations, previousEntry, currentState, phase: "spec" });
    assert.equal(result[0].result, "fail");
    assert.ok(Array.isArray(result[0].violations));
  });
});
