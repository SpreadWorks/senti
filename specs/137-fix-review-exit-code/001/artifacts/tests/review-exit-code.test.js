/**
 * specs/137-fix-review-exit-code/tests/review-exit-code.test.js
 *
 * Verify fix for #82: runReviewLoop should PASS when verification detect finds 0 issues
 * after the last fix. Also verify parse*Output error messages for edge cases.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// runReviewLoop tests
// ---------------------------------------------------------------------------

describe("runReviewLoop: verification detect after last fix", () => {
  let runReviewLoop;

  it("loads runReviewLoop from review.js", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    runReviewLoop = mod.runReviewLoop;
    assert.ok(runReviewLoop, "runReviewLoop should be exported");
  });

  it("PASS when first detect finds 0 issues (regression)", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    const { history, finalIssues, verdict } = await mod.runReviewLoop({
      maxRetries: 3,
      label: "test",
      dryRun: false,
      async detect() { return { issues: [], raw: "NO_GAPS" }; },
      async fix() { throw new Error("fix should not be called"); },
    });
    assert.equal(verdict, "PASS");
    assert.equal(finalIssues.length, 0);
    assert.equal(history.length, 1);
  });

  it("PASS when fix resolves all issues and verification detect confirms", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    let detectCount = 0;
    const { verdict, finalIssues } = await mod.runReviewLoop({
      maxRetries: 1,
      label: "test",
      dryRun: false,
      async detect() {
        detectCount++;
        // First detect: 1 issue. Second detect (verification): 0 issues.
        if (detectCount <= 1) return { issues: [{ title: "issue1" }], raw: "issue1" };
        return { issues: [], raw: "clean" };
      },
      async fix() { /* fix resolves the issue */ },
    });
    assert.equal(verdict, "PASS", "should PASS after verification detect finds 0 issues");
    assert.equal(finalIssues.length, 0);
    assert.equal(detectCount, 2, "should have called detect twice (initial + verification)");
  });

  it("FAIL when all fixes are no-op (proposals rejected)", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    let fixCount = 0;
    const { verdict, finalIssues } = await mod.runReviewLoop({
      maxRetries: 2,
      label: "test",
      dryRun: false,
      async detect() { return { issues: [{ title: "persistent-issue" }], raw: "issue" }; },
      async fix() { fixCount++; /* no-op: doesn't actually fix anything */ },
    });
    assert.equal(verdict, "FAIL");
    assert.ok(finalIssues.length > 0);
  });

  it("FAIL when verification detect still finds issues after fix", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    let detectCount = 0;
    const { verdict, finalIssues } = await mod.runReviewLoop({
      maxRetries: 1,
      label: "test",
      dryRun: false,
      async detect() {
        detectCount++;
        // Both initial and verification detect find issues
        return { issues: [{ title: "stubborn-issue" }], raw: "issue" };
      },
      async fix() { /* fix doesn't resolve */ },
    });
    assert.equal(verdict, "FAIL");
    assert.ok(finalIssues.length > 0);
  });

  it("skips fix in dry-run mode", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    let fixCalled = false;
    const { verdict } = await mod.runReviewLoop({
      maxRetries: 3,
      label: "test",
      dryRun: true,
      async detect() { return { issues: [{ title: "issue" }], raw: "issue" }; },
      async fix() { fixCalled = true; },
    });
    assert.equal(verdict, "FAIL");
    assert.equal(fixCalled, false, "fix should not be called in dry-run");
  });
});

// ---------------------------------------------------------------------------
// parseSpecReviewOutput tests
// ---------------------------------------------------------------------------

describe("parseSpecReviewOutput: exit code + stderr combinations", () => {
  it("returns ok when subprocess exits 0 with PASS", async () => {
    const mod = await import("../../../src/flow/lib/run-review.js");
    const result = mod.parseSpecReviewOutput(
      { ok: true },
      "Spec review PASS. No oversights found.",
      "  [spec-review] verdict=PASS issues=0",
    );
    assert.equal(result.result, "ok");
    assert.equal(result.artifacts.verdict, "PASS");
    assert.equal(result.artifacts.issueCount, 0);
  });

  it("throws on exit 1 with issues > 0", async () => {
    const mod = await import("../../../src/flow/lib/run-review.js");
    assert.throws(
      () => mod.parseSpecReviewOutput(
        { ok: false },
        "Spec review FAIL. 2 issue(s) remaining.",
        "  [spec-review] verdict=FAIL issues=2",
      ),
      (err) => err.message.includes("2 issue(s) remaining"),
    );
  });

  it("includes subprocess error note when exit 1 + issues=0", async () => {
    const mod = await import("../../../src/flow/lib/run-review.js");
    assert.throws(
      () => mod.parseSpecReviewOutput(
        { ok: false },
        "",
        "  [spec-review] verdict=PASS issues=0\nsome error trace",
      ),
      (err) => err.message.includes("subprocess error"),
    );
  });
});

// ---------------------------------------------------------------------------
// parseTestReviewOutput tests
// ---------------------------------------------------------------------------

describe("parseTestReviewOutput: exit code + stderr combinations", () => {
  it("returns ok when subprocess exits 0", async () => {
    const mod = await import("../../../src/flow/lib/run-review.js");
    const result = mod.parseTestReviewOutput(
      { ok: true },
      "Test review PASS. All test cases covered.",
      "  [test-review] verdict=PASS gaps=0",
    );
    assert.equal(result.result, "ok");
    assert.equal(result.artifacts.verdict, "PASS");
  });

  it("throws on exit 1 with gaps > 0", async () => {
    const mod = await import("../../../src/flow/lib/run-review.js");
    assert.throws(
      () => mod.parseTestReviewOutput(
        { ok: false },
        "Test review FAIL. 3 gap(s) remaining.",
        "  [test-review] verdict=FAIL gaps=3",
      ),
      (err) => err.message.includes("3 gap(s) remaining"),
    );
  });

  it("includes subprocess error note when exit 1 + gaps=0", async () => {
    const mod = await import("../../../src/flow/lib/run-review.js");
    assert.throws(
      () => mod.parseTestReviewOutput(
        { ok: false },
        "",
        "  [test-review] verdict=PASS gaps=0\nsome error trace",
      ),
      (err) => err.message.includes("subprocess error"),
    );
  });
});
