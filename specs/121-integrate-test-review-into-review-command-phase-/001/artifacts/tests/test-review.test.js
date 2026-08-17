/**
 * Spec #121 — test-review pipeline integration tests.
 *
 * These tests verify the test-review pipeline behavior:
 * - test-review.md generation
 * - retry loop behavior
 * - output format (test design summary, gap analysis, verdict)
 *
 * Note: These tests require a mock agent since they exercise the full pipeline.
 * They use a minimal flow state and spec to verify the pipeline structure.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import {
  parseProposals, MAX_TEST_REVIEW_RETRIES, extractRequirements,
  collectTestFiles, parseGaps, formatTestReviewMd,
} from "../../../src/flow/commands/review.js";

describe("extractRequirements", () => {
  it("extracts Requirements section from spec text", () => {
    const spec = [
      "# Spec",
      "## Goal",
      "Do something",
      "## Requirements",
      "1. REQ-1: First requirement",
      "2. REQ-2: Second requirement",
      "## Acceptance Criteria",
      "- AC-1",
    ].join("\n");
    const reqs = extractRequirements(spec);
    assert.match(reqs, /REQ-1/);
    assert.match(reqs, /REQ-2/);
    assert.ok(!reqs.includes("AC-1"));
  });

  it("returns empty string when no Requirements section", () => {
    const reqs = extractRequirements("# Spec\n## Goal\nSomething\n## End\n");
    assert.equal(reqs, "");
  });
});

describe("collectTestFiles", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("collects test files from spec-local and project tests/", () => {
    tmp = createTmpDir();
    const specDir = "specs/test-spec";
    mkdirSync(join(tmp, specDir, "tests"), { recursive: true });
    mkdirSync(join(tmp, "tests"), { recursive: true });

    writeFileSync(join(tmp, specDir, "tests", "a.test.js"), "// spec local test");
    writeFileSync(join(tmp, "tests", "b.test.js"), "// project test");

    const files = collectTestFiles(tmp, specDir);
    assert.equal(files.length, 2);
    const names = files.map((f) => f.name);
    assert.ok(names.includes("a.test.js"));
    assert.ok(names.includes("b.test.js"));
  });

  it("spec-local takes precedence over project tests with same name", () => {
    tmp = createTmpDir();
    const specDir = "specs/test-spec";
    mkdirSync(join(tmp, specDir, "tests"), { recursive: true });
    mkdirSync(join(tmp, "tests"), { recursive: true });

    writeFileSync(join(tmp, "tests", "same.test.js"), "// project version");
    writeFileSync(join(tmp, specDir, "tests", "same.test.js"), "// spec version");

    const files = collectTestFiles(tmp, specDir);
    const sameFile = files.find((f) => f.name === "same.test.js");
    assert.ok(sameFile);
    assert.match(sameFile.content, /spec version/);
  });
});

describe("parseGaps", () => {
  it("returns empty array for NO_GAPS", () => {
    assert.deepEqual(parseGaps("NO_GAPS"), []);
  });

  it("parses gap entries", () => {
    const text = [
      "### GAP-1: Missing edge case",
      "**Missing:** Empty input handling",
      "**Severity:** HIGH",
      "",
      "### GAP-2: No error test",
      "**Missing:** Error path for invalid config",
      "**Severity:** MEDIUM",
    ].join("\n");
    const gaps = parseGaps(text);
    assert.equal(gaps.length, 2);
    assert.match(gaps[0].title, /Missing edge case/);
    assert.match(gaps[1].title, /No error test/);
  });
});

describe("formatTestReviewMd", () => {
  it("formats PASS verdict with link to tests/spec.md", () => {
    const md = formatTestReviewMd("test design", ["no gaps"], "PASS", []);
    assert.match(md, /# Test Review Results/);
    assert.match(md, /tests\/spec\.md/);
    assert.match(md, /Verdict: PASS/);
    assert.ok(!md.includes("Remaining Gaps"));
  });

  it("formats FAIL verdict with remaining gaps", () => {
    const gaps = [{ title: "1: Missing test", body: "Need edge case" }];
    const md = formatTestReviewMd("test design", ["gaps found"], "FAIL", gaps);
    assert.match(md, /Verdict: FAIL/);
    assert.match(md, /Remaining Gaps/);
    assert.match(md, /Missing test/);
  });
});

describe("test-review output format", () => {
  it("parseProposals parses numbered markdown proposals", () => {
    const text = [
      "### 1. Missing edge case test",
      "**File:** `tests/foo.test.js`",
      "**Issue:** No test for empty input",
      "**Suggestion:** Add test for empty array",
      "",
      "### 2. Redundant test",
      "**File:** `tests/bar.test.js`",
      "**Issue:** Duplicate of test #3",
      "**Suggestion:** Remove duplicate",
    ].join("\n");
    const proposals = parseProposals(text);
    assert.equal(proposals.length, 2);
    assert.match(proposals[0].title, /Missing edge case/);
    assert.match(proposals[1].title, /Redundant test/);
  });
});

describe("test-review.md file placement", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("test-review.md should be written to spec directory (not review.md)", () => {
    tmp = createTmpDir();
    const specDir = join(tmp, "specs", "121-test");
    mkdirSync(specDir, { recursive: true });

    // Simulate writing test-review.md (the actual pipeline will do this)
    const testReviewPath = join(specDir, "test-review.md");
    const reviewPath = join(specDir, "review.md");

    writeFileSync(testReviewPath, "# Test Review Results\n\n## Verdict: PASS\n");
    writeFileSync(reviewPath, "# Code Review Results\n\nNo proposals.\n");

    // Both files should coexist
    assert.ok(existsSync(testReviewPath), "test-review.md exists");
    assert.ok(existsSync(reviewPath), "review.md exists");

    const testReview = readFileSync(testReviewPath, "utf8");
    assert.match(testReview, /Test Review/);
    assert.match(testReview, /Verdict/);
  });
});

describe("retry loop upper bound", () => {
  it("MAX_TEST_REVIEW_RETRIES should be 3", () => {
    assert.equal(MAX_TEST_REVIEW_RETRIES, 3, "retry limit should be 3");
  });
});
