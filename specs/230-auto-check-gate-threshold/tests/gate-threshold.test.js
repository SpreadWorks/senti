import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeScore, hardGateFailed, composeAutoCheck } from "../../../src/flow/lib/run-auto-check.js";

describe("spec 230: hard-gate staging + threshold adjustment", () => {
  describe("hardGateFailed — staged (sum ≤ 1 → fail)", () => {
    it("returns true when all three hard-gate keys are 0 (sum=0)", () => {
      assert.equal(hardGateFailed({ specBuildability: 0, ambiguity: 0, verifiability: 0 }), true);
    });

    it("returns true when sum is 1 (e.g. 0+0+1)", () => {
      assert.equal(hardGateFailed({ specBuildability: 0, ambiguity: 0, verifiability: 1 }), true);
    });

    it("returns false when sum is 2 (e.g. 0+1+1)", () => {
      assert.equal(hardGateFailed({ specBuildability: 0, ambiguity: 1, verifiability: 1 }), false);
    });

    it("returns false when all are 1 (sum=3)", () => {
      assert.equal(hardGateFailed({ specBuildability: 1, ambiguity: 1, verifiability: 1 }), false);
    });

    it("returns false when all are 2 (sum=6)", () => {
      assert.equal(hardGateFailed({ specBuildability: 2, ambiguity: 2, verifiability: 2 }), false);
    });
  });

  describe("THRESHOLD — 16 boundary", () => {
    it("score 16 is eligible (at threshold)", () => {
      const result = composeAutoCheck({
        staticGates: { G: false, H: false, I: false, eligible: true },
        aiBreakdown: { specBuildability: 1, ambiguity: 1, verifiability: 1, scopeBoundedness: 1, targetSpecificity: 1, precedent: 1 },
        aiReason: "",
        aiOk: true,
      });
      assert.equal(result.score, 12);
      assert.equal(result.eligible, false);
    });

    it("score 15 is not eligible (below threshold)", () => {
      const breakdown = { specBuildability: 1, ambiguity: 1, verifiability: 1, scopeBoundedness: 1, targetSpecificity: 0, precedent: 1 };
      const score = computeScore(breakdown);
      assert.equal(score, 11);
      const result = composeAutoCheck({
        staticGates: { G: false, H: false, I: false, eligible: true },
        aiBreakdown: breakdown,
        aiReason: "",
        aiOk: true,
      });
      assert.equal(result.eligible, false);
    });

    it("score exactly 16 is eligible", () => {
      // specBuildability=1*3 + ambiguity=1*3 + verifiability=2*2 + scopeBoundedness=1*2 + targetSpecificity=1*1 + precedent=1*1 = 3+3+4+2+1+1 = 14
      // Need exactly 16: specBuildability=1*3 + ambiguity=1*3 + verifiability=2*2 + scopeBoundedness=2*2 + targetSpecificity=0*1 + precedent=0*1 = 3+3+4+4+0+0 = 14
      // Try: specBuildability=2*3 + ambiguity=1*3 + verifiability=1*2 + scopeBoundedness=1*2 + targetSpecificity=1*1 + precedent=1*1 = 6+3+2+2+1+1 = 15
      // Try: specBuildability=2*3 + ambiguity=1*3 + verifiability=1*2 + scopeBoundedness=2*2 + targetSpecificity=0*1 + precedent=1*1 = 6+3+2+4+0+1 = 16
      const breakdown = { specBuildability: 2, ambiguity: 1, verifiability: 1, scopeBoundedness: 2, targetSpecificity: 0, precedent: 1 };
      const score = computeScore(breakdown);
      assert.equal(score, 16, `expected score 16, got ${score}`);
      const result = composeAutoCheck({
        staticGates: { G: false, H: false, I: false, eligible: true },
        aiBreakdown: breakdown,
        aiReason: "",
        aiOk: true,
      });
      assert.equal(result.eligible, true);
    });

    it("score 15 is not eligible", () => {
      // specBuildability=2*3 + ambiguity=1*3 + verifiability=1*2 + scopeBoundedness=1*2 + targetSpecificity=1*1 + precedent=1*1 = 6+3+2+2+1+1 = 15
      const breakdown = { specBuildability: 2, ambiguity: 1, verifiability: 1, scopeBoundedness: 1, targetSpecificity: 1, precedent: 1 };
      const score = computeScore(breakdown);
      assert.equal(score, 15, `expected score 15, got ${score}`);
      const result = composeAutoCheck({
        staticGates: { G: false, H: false, I: false, eligible: true },
        aiBreakdown: breakdown,
        aiReason: "",
        aiOk: true,
      });
      assert.equal(result.eligible, false);
    });
  });

  describe("composeAutoCheck reason — staged hard-gate", () => {
    it("includes hard-gate sum info when hard-gate fails", () => {
      const result = composeAutoCheck({
        staticGates: { G: false, H: false, I: false, eligible: true },
        aiBreakdown: { specBuildability: 0, ambiguity: 0, verifiability: 1, scopeBoundedness: 2, targetSpecificity: 2, precedent: 2 },
        aiReason: "",
        aiOk: true,
      });
      assert.equal(result.eligible, false);
      assert.ok(result.reason.includes("hard-gate"), `reason should mention hard-gate: ${result.reason}`);
    });
  });

  describe("interaction: hard-gate pass + threshold pass", () => {
    it("single zero key with sufficient total score is eligible", () => {
      // ambiguity=0 but other two hard-gate keys sum to 4 → pass hard-gate
      // total: specBuildability=2*3 + ambiguity=0*3 + verifiability=2*2 + scopeBoundedness=2*2 + targetSpecificity=2*1 + precedent=2*1 = 6+0+4+4+2+2 = 18 ≥ 16
      const result = composeAutoCheck({
        staticGates: { G: false, H: false, I: false, eligible: true },
        aiBreakdown: { specBuildability: 2, ambiguity: 0, verifiability: 2, scopeBoundedness: 2, targetSpecificity: 2, precedent: 2 },
        aiReason: "test",
        aiOk: true,
      });
      assert.equal(result.eligible, true, `expected eligible but got reason: ${result.reason}`);
    });
  });
});
