import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { parseProposalReviewOutput, parseSpecReviewOutput, parseTestReviewOutput } =
  await import("../../../src/flow/lib/run-review.js");

describe("spec 248: parsePhaseReviewOutput exit 0 semantics (R5)", () => {
  describe("draft review parser", () => {
    it("R5: res.ok=true + verdict=FAIL returns ok with verdict FAIL and next=null", () => {
      const res = { ok: true, status: 0 };
      const stdout = "Draft review FAIL. 3 issue(s) detected.";
      const stderr = "[draft-review] verdict=FAIL issues=3\nResults saved to specs/x/draft-review.md";

      const result = parseProposalReviewOutput(res, stdout, stderr);
      assert.equal(result.result, "ok");
      assert.equal(result.artifacts.verdict, "FAIL");
      assert.equal(result.artifacts.issueCount, 3);
      assert.equal(result.next, null, "next must be null on verdict FAIL");
    });

    it("R5: res.ok=true + verdict=PASS returns ok with verdict PASS and normal next", () => {
      const res = { ok: true, status: 0 };
      const stdout = "Draft review PASS. QA entries are adequate.";
      const stderr = "[draft-review] verdict=PASS issues=0\nResults saved to specs/x/draft-review.md";

      const result = parseProposalReviewOutput(res, stdout, stderr);
      assert.equal(result.result, "ok");
      assert.equal(result.artifacts.verdict, "PASS");
      assert.equal(result.artifacts.issueCount, 0);
      assert.equal(result.next, "gate-draft");
    });

    it("R5: res.ok=false throws Error", () => {
      const res = { ok: false, status: 1 };
      const stdout = "";
      const stderr = "verdict=FAIL issues=2";

      assert.throws(
        () => parseProposalReviewOutput(res, stdout, stderr),
        Error,
      );
    });
  });

  describe("spec review parser", () => {
    it("R5: res.ok=true + verdict=FAIL returns ok with next=null", () => {
      const res = { ok: true, status: 0 };
      const stdout = "Spec review found 5 proposal(s).";
      const stderr = "[spec-review] verdict=FAIL proposalCount=5\nResults saved to specs/x/spec-review.md";

      const result = parseSpecReviewOutput(res, stdout, stderr);
      assert.equal(result.result, "ok");
      assert.equal(result.artifacts.verdict, "FAIL");
      assert.equal(result.artifacts.proposalCount, 5);
      assert.equal(result.next, null, "next must be null on verdict FAIL");
    });

    it("R5: res.ok=true + verdict=PASS returns normal next", () => {
      const res = { ok: true, status: 0 };
      const stdout = "NO_PROPOSALS";
      const stderr = "[spec-review] verdict=PASS proposalCount=0";

      const result = parseSpecReviewOutput(res, stdout, stderr);
      assert.equal(result.artifacts.verdict, "PASS");
      assert.equal(result.next, "approval");
    });
  });

  describe("test review parser", () => {
    it("R5: res.ok=true + verdict=FAIL returns ok with next=null", () => {
      const res = { ok: true, status: 0 };
      const stdout = "Test review FAIL. 2 gap(s) remaining.";
      const stderr = "[test-review] verdict=FAIL gaps=2\nResults saved to specs/x/test-review.md";

      const result = parseTestReviewOutput(res, stdout, stderr);
      assert.equal(result.result, "ok");
      assert.equal(result.artifacts.verdict, "FAIL");
      assert.equal(result.artifacts.gapCount, 2);
      assert.equal(result.next, null, "next must be null on verdict FAIL");
    });
  });
});
