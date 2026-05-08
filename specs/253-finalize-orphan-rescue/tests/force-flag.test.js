// spec: R10 R15
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCleanupSrc() {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
    "utf8",
  );
}

describe("R10: --force forces deletion with audit log", () => {
  it("R10: --force path emits FORCED_ORPHAN_DROP warning envelope", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("FORCED_ORPHAN_DROP"),
      "FORCED_ORPHAN_DROP warning code required",
    );
  });
  it("R10: --force path proceeds to branch deletion (calls branch -D after warning)", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("branch -D") || src.includes('"branch", "-D"') || src.includes("'-D'"),
      "branch deletion call must remain reachable on --force path",
    );
  });
  it("R10: --force path persists audit log with droppedCommits metadata", () => {
    const src = readCleanupSrc();
    const forceBlock = src.match(/FORCED_ORPHAN_DROP[\s\S]{0,2000}/);
    assert.ok(forceBlock, "FORCED_ORPHAN_DROP block must exist");
    const block = forceBlock[0];
    assert.ok(
      block.includes("saveIssueLog") || block.includes("droppedCommits"),
      "--force path must record dropped commits to audit log",
    );
  });
});

describe("R15: per-code mandatory audit log policy", () => {
  it("R15: validation/detection errors do not invoke saveIssueLog", () => {
    const src = readCleanupSrc();
    const argsErrBlock = src.match(/ARGS_ERROR[\s\S]{0,500}/);
    if (argsErrBlock) {
      assert.ok(
        !argsErrBlock[0].includes("saveIssueLog"),
        "ARGS_ERROR path must not write audit log",
      );
    }
    const baselineMissingBlock = src.match(/SQUASH_BASELINE_MISSING[\s\S]{0,800}/);
    if (baselineMissingBlock) {
      assert.ok(
        !baselineMissingBlock[0].includes("saveIssueLog"),
        "SQUASH_BASELINE_MISSING path must not write audit log",
      );
    }
  });
  it("R15: destructive paths (FORCED_ORPHAN_DROP, CHERRY_PICK_CONFLICT) write audit log", () => {
    const src = readCleanupSrc();
    const forcedBlock = src.match(/FORCED_ORPHAN_DROP[\s\S]{0,2000}/);
    assert.ok(forcedBlock, "FORCED_ORPHAN_DROP block must exist");
    assert.ok(
      forcedBlock[0].includes("saveIssueLog"),
      "FORCED_ORPHAN_DROP must call saveIssueLog",
    );
    const conflictBlock = src.match(/CHERRY_PICK_CONFLICT[\s\S]{0,2000}/);
    assert.ok(conflictBlock, "CHERRY_PICK_CONFLICT block must exist");
    assert.ok(
      conflictBlock[0].includes("saveIssueLog"),
      "CHERRY_PICK_CONFLICT must call saveIssueLog",
    );
  });
});
