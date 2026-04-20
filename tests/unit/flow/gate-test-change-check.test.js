import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkTestChanges } from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// spec 201: test 変更判定の機械化 (P1-R1〜P1-R6)
// -----------------------------------------------------------------------------

const TEST_GLOBS = ["**/*.test.js", "tests/**"];

function diffHeader(filePath) {
  return [
    `diff --git a/${filePath} b/${filePath}`,
    `index abc..def 100644`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ].join("\n");
}

describe("checkTestChanges — P1 requirements", () => {
  it("returns empty issues when diff has no test file changes", () => {
    const diff = [
      diffHeader("src/app.js"),
      "@@ -1,1 +1,1 @@",
      "-console.log('a');",
      "+console.log('b');",
    ].join("\n");
    const { issues } = checkTestChanges(diff, TEST_GLOBS);
    assert.deepEqual(issues, []);
  });

  it("returns empty issues when all test-file hunks are multi-line + only (P1-R4)", () => {
    const diff = [
      diffHeader("tests/foo.test.js"),
      "@@ -10,0 +11,4 @@",
      "+it('new', () => {",
      "+  expect(x).toBe(1);",
      "+  expect(y).toBe(2);",
      "+});",
    ].join("\n");
    const { issues } = checkTestChanges(diff, TEST_GLOBS);
    assert.deepEqual(issues, []);
  });

  it("returns FAIL when a test-file hunk contains a - line (P1-R2)", () => {
    const diff = [
      diffHeader("tests/foo.test.js"),
      "@@ -10,2 +10,2 @@",
      "-expect(x).toBe(5);",
      "+expect(x).toBe(3);",
    ].join("\n");
    const { issues } = checkTestChanges(diff, TEST_GLOBS);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /tests\/foo\.test\.js/);
    assert.match(issues[0], /\b10\b/); // line number present (P1-R5)
  });

  it("returns FAIL when a test-file hunk is delete-only (- lines only) (P1-R2)", () => {
    const diff = [
      diffHeader("tests/foo.test.js"),
      "@@ -10,2 +9,0 @@",
      "-expect(x).toBe(5);",
      "-expect(y).toBe(6);",
    ].join("\n");
    const { issues } = checkTestChanges(diff, TEST_GLOBS);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /tests\/foo\.test\.js/);
  });

  it("returns FAIL when a test-file hunk is + only with exactly 1 line (P1-R3)", () => {
    const diff = [
      diffHeader("tests/foo.test.js"),
      "@@ -10,0 +11,1 @@",
      "+expect(z).toBe(9);",
    ].join("\n");
    const { issues } = checkTestChanges(diff, TEST_GLOBS);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /tests\/foo\.test\.js/);
    assert.match(issues[0], /\b11\b/);
  });

  it("mixes: PASS on multi-line append, FAIL on mixed hunk (per-hunk decision)", () => {
    const diff = [
      diffHeader("tests/foo.test.js"),
      "@@ -10,0 +11,3 @@",
      "+it('x', () => {",
      "+  expect(1).toBe(1);",
      "+});",
      "@@ -30,1 +33,1 @@",
      "-expect(a).toBe(true);",
      "+expect(a).toBe(false);",
    ].join("\n");
    const { issues } = checkTestChanges(diff, TEST_GLOBS);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /\b33\b/);
  });

  it("FAIL reason includes file path and line number (P1-R5)", () => {
    const diff = [
      diffHeader("tests/bar.test.js"),
      "@@ -42,1 +42,1 @@",
      "-assert.equal(a, 1);",
      "+assert.equal(a, 2);",
    ].join("\n");
    const { issues } = checkTestChanges(diff, TEST_GLOBS);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /tests\/bar\.test\.js/);
    assert.match(issues[0], /\b42\b/);
  });

  it("does not invoke any language-specific parser (P1-R6 / implicit via pure-diff contract)", () => {
    // A hunk that adds what looks like an "it(" block but only 1 line — must still FAIL
    const diff = [
      diffHeader("tests/foo.test.js"),
      "@@ -5,0 +6,1 @@",
      "+it('fake single-line test', () => expect(x).toBe(1));",
    ].join("\n");
    const { issues } = checkTestChanges(diff, TEST_GLOBS);
    // 1 行 + only なので FAIL（言語を解釈しないため "it(" が含まれていても append 扱いしない）
    assert.equal(issues.length, 1);
  });

  it("ignores non-test file changes entirely", () => {
    const diff = [
      diffHeader("src/foo.js"),
      "@@ -10,1 +10,1 @@",
      "-return 1;",
      "+return 2;",
    ].join("\n");
    const { issues } = checkTestChanges(diff, TEST_GLOBS);
    assert.deepEqual(issues, []);
  });
});
