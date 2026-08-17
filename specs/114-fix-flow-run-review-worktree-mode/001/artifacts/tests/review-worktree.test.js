/**
 * Spec 114: Verify run/review.js does not override SDD_WORK_ROOT in worktree mode.
 *
 * This test reads the source code of run/review.js and verifies that
 * the worktree SDD_WORK_ROOT override has been removed.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// specs/114-xxx/tests/ → project root (3 levels up)
const ROOT = path.resolve(__dirname, "../../..");
const REVIEW_RUN_PATH = path.join(ROOT, "src/flow/run/review.js");

describe("spec-114: run/review.js worktree fix", () => {
  const source = fs.readFileSync(REVIEW_RUN_PATH, "utf8");

  it("should not set SDD_WORK_ROOT in env", () => {
    assert.ok(
      !source.includes("SDD_WORK_ROOT"),
      "run/review.js must not reference SDD_WORK_ROOT",
    );
  });

  it("should not import isInsideWorktree", () => {
    assert.ok(
      !source.includes("isInsideWorktree"),
      "run/review.js must not import isInsideWorktree",
    );
  });

  it("should not import getMainRepoPath", () => {
    assert.ok(
      !source.includes("getMainRepoPath"),
      "run/review.js must not import getMainRepoPath",
    );
  });

  it("should still pass env to runSync", () => {
    // Ensure the env variable is still passed (just not modified for worktree)
    assert.ok(
      source.includes("env"),
      "run/review.js should still use env in runSync call",
    );
  });
});
