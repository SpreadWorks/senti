// spec: R1 R2 R3 R5
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as review from "../../../src/flow/commands/review.js";

function assertReviewTestContractSurface() {
  assert.equal(typeof review.collectTestFiles, "function");
  assert.equal(typeof review.buildGapAnalysisPrompt, "function");
  assert.equal(typeof review.buildTestFixPrompt, "function");
  assert.equal(review.TEST_REVIEW_PROMPT_CHAR_LIMIT, 1_000_000);
  assert.equal(typeof review.assertTestReviewPromptWithinLimit, "function");
}

describe("review-test input contract", () => {
  let tmp = null;
  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    tmp = null;
  });

  function write(file, content) {
    const full = path.join(tmp, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  it("R1: collects only spec-local test modules and excludes root tests, raw logs, and spec.md", () => {
    assertReviewTestContractSurface();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "review-test-input-contract-"));
    const specDir = "specs/example";
    write("tests/root.test.js", "root test must not be collected");
    write(`${specDir}/spec.md`, "full spec must not be collected");
    write(`${specDir}/tests/.raw/test-execution.log`, "raw log must not be collected");
    write(`${specDir}/tests/helper.js`, "helper module must not be collected");
    write(`${specDir}/tests/local.test.txt`, "test text must not be collected");
    write(`${specDir}/tests/local.md`, "markdown must not be collected");
    write(`${specDir}/tests/local.test.js`, "local test");
    write(`${specDir}/tests/local.test.ts`, "local ts test");
    write(`${specDir}/tests/nested/local.spec.mjs`, "nested local spec");
    write(`${specDir}/tests/nested/local.spec.ts`, "nested local ts spec");

    const files = review.collectTestFiles(tmp, specDir);

    assert.deepEqual(files.map((file) => file.source).sort(), [
      `${specDir}/tests/local.test.js`,
      `${specDir}/tests/local.test.ts`,
      `${specDir}/tests/nested/local.spec.mjs`,
      `${specDir}/tests/nested/local.spec.ts`,
    ]);
    assert.ok(files.every((file) => file.source.startsWith(`${specDir}/tests/`)));
    assert.ok(files.every((file) => !file.content.includes("root test must not be collected")));
    assert.ok(files.every((file) => !file.content.includes("raw log must not be collected")));
    assert.ok(files.every((file) => !file.content.includes("full spec must not be collected")));
    assert.ok(files.every((file) => !file.content.includes("helper module must not be collected")));
    assert.ok(files.every((file) => !file.content.includes("test text must not be collected")));
    assert.ok(files.every((file) => !file.content.includes("markdown must not be collected")));
  });

  it("R2: keeps test design in systemPrompt for gap-analysis and gap-fix prompts", () => {
    assertReviewTestContractSurface();
    const testDesign = "TC-1: stable design text";
    const testFiles = [{ source: "specs/example/tests/local.test.js", content: "test('R1: example', () => {});" }];
    const gapPrompt = review.buildGapAnalysisPrompt(testDesign, testFiles);
    const fixPrompt = review.buildTestFixPrompt(testDesign, "GAP-1", testFiles);

    for (const prompt of [gapPrompt, fixPrompt]) {
      assert.match(prompt.systemPrompt, /## Test Design/);
      assert.match(prompt.systemPrompt, /TC-1: stable design text/);
      assert.doesNotMatch(prompt.userPrompt, /## Test Design/);
      assert.doesNotMatch(prompt.userPrompt, /TC-1: stable design text/);
    }
  });

  it("R3: exposes and enforces the 1,000,000 character provider-boundary limit", async () => {
    assertReviewTestContractSurface();
    assert.equal(typeof review.runTestReviewWithDependencies, "function");
    const overLimitPrompt = {
      systemPrompt: "x".repeat(review.TEST_REVIEW_PROMPT_CHAR_LIMIT),
      userPrompt: "y",
      fmtFallback: "",
    };
    let agentCalled = false;

    assert.throws(
      () => review.assertTestReviewPromptWithinLimit(overLimitPrompt, "test review"),
      /TEST_REVIEW_PROMPT_TOO_LARGE/,
    );
    await assert.rejects(
      () => review.runTestReviewWithDependencies({
        buildReviewPrompt: () => overLimitPrompt,
        callAgent: async () => {
          agentCalled = true;
          return "{}";
        },
      }),
      /TEST_REVIEW_PROMPT_TOO_LARGE/,
    );
    assert.equal(agentCalled, false);
  });

  it("R5: contract tests do not require review-test scoring, CLI, or exit-code changes", () => {
    assertReviewTestContractSurface();
    const prompt = review.buildGapAnalysisPrompt("TC-1", []);

    assert.equal(typeof prompt.systemPrompt, "string");
    assert.equal(typeof prompt.userPrompt, "string");
    assert.equal(typeof prompt.jsonSchema === "undefined" || typeof prompt.jsonSchema === "object", true);
  });
});
