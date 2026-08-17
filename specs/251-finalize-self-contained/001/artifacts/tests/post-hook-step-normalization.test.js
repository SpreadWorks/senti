// spec: R1 R2 R5 R6 R11
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(import.meta.dirname, "../../../");
const registryPath = path.join(repoRoot, "src/flow/registry.js");
const cleanupPath = path.join(repoRoot, "src/flow/lib/run-finalize-cleanup.js");
const finalizeCommitPath = path.join(repoRoot, "src/flow/lib/run-finalize-commit.js");

function readFileText(p) {
  return fs.readFileSync(p, "utf8");
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

test("R1: registry post hook for finalize-commit normalizes command status to flow step 'done'", () => {
  const text = readFileText(registryPath);
  const finalizeCommitBlock = text.split('"finalize-commit"')[1]?.split('"finalize-merge"')[0] ?? "";
  assert.match(
    finalizeCommitBlock,
    /tryUpdateStepStatus|updateStepStatus.*"finalize-commit".*"done"/s,
    "finalize-commit post hook must transition flow step to 'done' on success",
  );
});

// NOTE: The previous form of these regexes embedded `"finalize-merge"` /
// `"finalize-sync"` literally. That is unsatisfiable: `String.prototype.split`
// removes its separator from every emitted segment, so the literal can never
// appear inside the segment we are matching against. We align with the
// finalize-commit assertion (R1 above), which uses an `updateStepStatus|
// tryUpdateStepStatus` keyword alt — present in the segment whenever the post
// hook calls one of the two helpers, which is exactly the property R1 wants
// to enforce.
test("R1: registry post hook for finalize-merge normalizes command status to flow step 'done'", () => {
  const text = readFileText(registryPath);
  const finalizeMergeBlock = text.split('"finalize-merge"')[1]?.split('"finalize-sync"')[0] ?? "";
  assert.match(
    finalizeMergeBlock,
    /tryUpdateStepStatus|updateStepStatus.*"done"/s,
    "finalize-merge post hook must transition flow step to 'done' on success",
  );
});

test("R1: registry post hook for finalize-sync normalizes command status to flow step 'done'", () => {
  const text = readFileText(registryPath);
  const finalizeSyncBlock = text.split('"finalize-sync"')[1]?.split('"finalize-cleanup"')[0] ?? "";
  assert.match(
    finalizeSyncBlock,
    /tryUpdateStepStatus|updateStepStatus.*"done"/s,
    "finalize-sync post hook must transition flow step to 'done' on success",
  );
});

test("R2: merge-onward post hooks switch to main repo authority via forRoot(mainRepoPath)", () => {
  const text = readFileText(registryPath);
  assert.match(
    text,
    /flowManager\.forRoot\(.*mainRepoPath|flowManager\.forRoot\(\s*mainRepoPath/s,
    "registry post hooks must use flowManager.forRoot(mainRepoPath) for main repo authority",
  );
});

test("R5: finalize-cleanup body updates flow step 'done' before staging+commit and rolls back on commit failure", () => {
  const text = readFileText(cleanupPath);
  assert.match(
    text,
    /updateStepStatus.*"finalize-cleanup".*"done"/s,
    "cleanup body must explicitly transition finalize-cleanup step to 'done'",
  );
  assert.match(
    text,
    /git.*commit|commitOrSkip|runGit.*commit/i,
    "cleanup body must perform git commit of flow.json",
  );
  assert.match(
    text,
    /catch|try\s*\{[\s\S]*\}\s*catch|in_progress/i,
    "cleanup body must contain rollback / try-catch path on commit failure",
  );
});

test("R6: finalize-merge post hook on retry success resets skipped finalize-sync/cleanup back to 'pending'", () => {
  const text = readFileText(registryPath);
  // The post hook should detect existing 'skipped' status on sync/cleanup and reset to 'pending'
  assert.match(
    text,
    /skipped[\s\S]*"finalize-sync"[\s\S]*pending|"finalize-sync"[\s\S]*skipped[\s\S]*pending/s,
    "finalize-merge post hook must contain logic to reset skipped sync/cleanup to pending on retry success",
  );
});

test("R11: finalize-commit post hook skips executeCommitPost on preflight_failed/failed", () => {
  const text = readFileText(registryPath);
  const finalizeCommitBlock = text.split('"finalize-commit"')[1]?.split('"finalize-merge"')[0] ?? "";
  // The post hook must guard executeCommitPost with success status check
  assert.match(
    finalizeCommitBlock,
    /preflight_failed|status.*===.*"failed"|result\.status\s*===\s*"done"|isSuccess|status.*===.*"done"/s,
    "finalize-commit post hook must guard executeCommitPost / side effects on result status",
  );
});
