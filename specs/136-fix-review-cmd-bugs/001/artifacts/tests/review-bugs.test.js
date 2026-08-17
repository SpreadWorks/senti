/**
 * specs/136-fix-review-cmd-bugs/tests/review-bugs.test.js
 *
 * Verify fixes for 3 review command bugs:
 * 1. spec fix output validation (isValidSpecOutput)
 * 2. parseTestReviewOutput / parseSpecReviewOutput error messages
 * 3. buildTestFixPrompt Object.freeze guidance
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Bug #1: isValidSpecOutput", () => {
  let isValidSpecOutput;

  it("loads isValidSpecOutput from review.js", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    isValidSpecOutput = mod.isValidSpecOutput;
    assert.ok(isValidSpecOutput, "isValidSpecOutput should be exported");
  });

  it("accepts spec text with # Feature Specification header", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    const valid = mod.isValidSpecOutput("# Feature Specification: test\n\n## Goal\nSome goal");
    assert.equal(valid, true);
  });

  it("accepts spec text with ## Goal header", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    const valid = mod.isValidSpecOutput("## Goal\nSome goal\n\n## Scope\nSome scope");
    assert.equal(valid, true);
  });

  it("rejects AI garbage text", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    const valid = mod.isValidSpecOutput("It seems I don't have write permissions to the file. Let me output the complete updated spec.md content for you:");
    assert.equal(valid, false);
  });

  it("rejects empty string", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    const valid = mod.isValidSpecOutput("");
    assert.equal(valid, false);
  });
});

describe("Bug #2: parseTestReviewOutput error messages", () => {
  let parseTestReviewOutput;

  it("loads parseTestReviewOutput from run-review.js", async () => {
    const mod = await import("../../../src/flow/lib/run-review.js");
    parseTestReviewOutput = mod.parseTestReviewOutput;
    assert.ok(parseTestReviewOutput, "parseTestReviewOutput should be exported");
  });

  it("does not say '0 gap(s)' when gaps= is not in stderr", async () => {
    const mod = await import("../../../src/flow/lib/run-review.js");
    try {
      mod.parseTestReviewOutput(
        { ok: false },
        "some stdout output",
        "some error without gaps marker",
      );
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(!err.message.includes("0 gap(s)"), `should not say '0 gap(s)', got: ${err.message}`);
    }
  });
});

describe("Bug #2: parseSpecReviewOutput error messages", () => {
  it("does not say '0 issue(s)' when issues= is not in stderr", async () => {
    const mod = await import("../../../src/flow/lib/run-review.js");
    try {
      mod.parseSpecReviewOutput(
        { ok: false },
        "some stdout output",
        "some error without issues marker",
      );
      assert.fail("should have thrown");
    } catch (err) {
      assert.ok(!err.message.includes("0 issue(s)"), `should not say '0 issue(s)', got: ${err.message}`);
    }
  });
});

describe("Bug #3: buildTestFixPrompt includes Object.freeze guidance", () => {
  it("mentions Object.freeze in prompt output", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    assert.ok(mod.buildTestFixPrompt, "buildTestFixPrompt should be exported");
    const prompt = mod.buildTestFixPrompt("some gaps", [{ path: "test.js", content: "test code" }]);
    assert.ok(prompt.includes("Object.freeze"), "prompt should mention Object.freeze");
  });
});
