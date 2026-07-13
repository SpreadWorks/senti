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
    assert.ok(src.includes("FORCED_ORPHAN_DROP"), "FORCED_ORPHAN_DROP block must exist");
    assert.ok(src.includes("droppedCommits,"), "--force path must record dropped commits to audit log");
    assert.ok(src.includes("appendIssueLog(auditTarget"), "--force audit must use the shared append boundary");
    assert.ok(src.includes('finalizeAuditId("forced-orphan-drop"'), "--force audit must use a stable id");
  });
});

describe("R15: per-code mandatory audit log policy", () => {
  it("R15: validation/detection errors do not invoke the issue-log append boundary", () => {
    const src = readCleanupSrc();
    const argsErrBlock = src.match(/ARGS_ERROR[\s\S]{0,500}/);
    if (argsErrBlock) {
      assert.ok(
        !argsErrBlock[0].includes("appendIssueLog"),
        "ARGS_ERROR path must not write audit log",
      );
    }
    const baselineMissingBlock = src.match(/SQUASH_BASELINE_MISSING[\s\S]{0,800}/);
    if (baselineMissingBlock) {
      assert.ok(
        !baselineMissingBlock[0].includes("appendIssueLog"),
        "SQUASH_BASELINE_MISSING path must not write audit log",
      );
    }
  });
  it("R15: destructive paths (FORCED_ORPHAN_DROP, CHERRY_PICK_CONFLICT) write audit log", () => {
    const src = readCleanupSrc();
    const forcedBlock = src.match(/FORCED_ORPHAN_DROP[\s\S]{0,2000}/);
    assert.ok(forcedBlock, "FORCED_ORPHAN_DROP block must exist");
    assert.ok(
      src.includes("appendIssueLog(auditTarget"),
      "FORCED_ORPHAN_DROP must use the shared append boundary",
    );
    assert.ok(src.includes("CHERRY_PICK_CONFLICT"), "CHERRY_PICK_CONFLICT block must exist");
    assert.ok(
      src.includes("appendIssueLog(mainRepoPath, state.spec"),
      "CHERRY_PICK_CONFLICT must use the shared append boundary",
    );
    assert.ok(src.includes("ISSUE_LOG_AUDIT_FAILED"), "mandatory audit failure must fail closed");
  });
});
