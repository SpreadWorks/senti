/**
 * Spec verification tests for 133-restore-issue-comment.
 *
 * Verifies that executeCommitPost includes issue comment posting logic.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";

const RUN_FINALIZE_PATH = join(process.cwd(), "src/flow/lib/run-finalize.js");

describe("R2: import exists", () => {
  it("run-finalize.js imports commentOnIssue from git-helpers.js", () => {
    const content = readFileSync(RUN_FINALIZE_PATH, "utf8");
    assert.ok(
      /import\s+\{[^}]*commentOnIssue[^}]*\}\s+from\s+["'].*git-helpers\.js["']/.test(content),
      "commentOnIssue import not found",
    );
  });

  it("run-finalize.js imports isGhAvailable from git-helpers.js", () => {
    const content = readFileSync(RUN_FINALIZE_PATH, "utf8");
    assert.ok(
      /import\s+\{[^}]*isGhAvailable[^}]*\}\s+from\s+["'].*git-helpers\.js["']/.test(content),
      "isGhAvailable import not found",
    );
  });
});

describe("R1: issue comment logic exists in executeCommitPost", () => {
  it("run-finalize.js contains issueComment result assignment", () => {
    const content = readFileSync(RUN_FINALIZE_PATH, "utf8");
    assert.ok(
      content.includes("results.issueComment"),
      "results.issueComment not found in run-finalize.js",
    );
  });

  it("run-finalize.js calls commentOnIssue", () => {
    const content = readFileSync(RUN_FINALIZE_PATH, "utf8");
    assert.ok(
      content.includes("commentOnIssue("),
      "commentOnIssue() call not found in run-finalize.js",
    );
  });

  it("run-finalize.js checks isGhAvailable before posting", () => {
    const content = readFileSync(RUN_FINALIZE_PATH, "utf8");
    assert.ok(
      content.includes("isGhAvailable()"),
      "isGhAvailable() check not found in run-finalize.js",
    );
  });

  it("run-finalize.js handles skip when no linked issue", () => {
    const content = readFileSync(RUN_FINALIZE_PATH, "utf8");
    assert.ok(
      content.includes("no linked issue"),
      "skip reason 'no linked issue' not found",
    );
  });

  it("run-finalize.js handles skip when report text missing", () => {
    const content = readFileSync(RUN_FINALIZE_PATH, "utf8");
    assert.ok(
      content.includes("report text missing"),
      "skip reason 'report text missing' not found",
    );
  });

  it("run-finalize.js handles skip when gh unavailable", () => {
    const content = readFileSync(RUN_FINALIZE_PATH, "utf8");
    assert.ok(
      content.includes("gh unavailable"),
      "skip reason 'gh unavailable' not found",
    );
  });
});
