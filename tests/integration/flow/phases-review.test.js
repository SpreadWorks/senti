import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { VALID_PHASES } = await import("../../../src/lib/constants.js");
const { filterByPhase } = await import("../../../src/lib/guardrail.js");

describe("VALID_PHASES includes review", () => {
  it("contains review in VALID_PHASES", () => {
    assert.ok(VALID_PHASES.includes("review"));
  });

  it("preserves existing phases", () => {
    for (const phase of ["draft", "spec", "gate", "impl", "test", "lint"]) {
      assert.ok(VALID_PHASES.includes(phase), `missing phase: ${phase}`);
    }
  });
});

describe("filterByPhase with review", () => {
  it("filters guardrails by review phase", () => {
    const guardrails = [
      { title: "Impl Only", body: "", meta: { phase: ["impl"] } },
      { title: "Review Only", body: "", meta: { phase: ["review"] } },
      { title: "Impl+Review", body: "", meta: { phase: ["impl", "review"] } },
    ];

    const reviewGuardrails = filterByPhase(guardrails, "review");
    assert.equal(reviewGuardrails.length, 2);
    assert.deepEqual(
      reviewGuardrails.map((g) => g.title),
      ["Review Only", "Impl+Review"]
    );
  });
});
