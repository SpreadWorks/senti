/**
 * src/flow/lib/run-finalize.js
 *
 * Shared utilities for finalize sub-step commands
 * (run-finalize-commit, run-finalize-merge, run-finalize-sync, run-finalize-cleanup).
 */

import fs from "fs";
import path from "path";
import { runCmd, assertOk } from "../../lib/process.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";
import {
  isGhAvailable,
  commentOnIssue,
  collectGitSummary,
  runGit,
  countCommitsBetween,
  listUncommittedFiles,
} from "../../lib/git-helpers.js";
import { container } from "../../lib/container.js";
import { POINTER_REL_PATH as LAST_FINALIZED_SPEC_POINTER_REL_PATH } from "./run-report-show.js";
import {
  buildTestResultsFromArtifacts,
  collectExistingArtifactPathspecs,
  durableTestArtifactPathspecs,
} from "./test-artifacts.js";

export function finalizeOnError(stepName, trigger) {
  return (ctx, err) => {
    try {
      const issueLog = loadIssueLog(ctx.root, ctx.flowState.spec);
      const entry = {
        step: stepName,
        reason: err.message || String(err),
        timestamp: new Date().toISOString(),
      };
      if (trigger) entry.trigger = trigger;
      issueLog.entries.push(entry);
      saveIssueLog(ctx.root, ctx.flowState.spec, issueLog);
    } catch (e) { console.error("[issue-log hook]", e.message); }
  };
}

export function writeLastFinalizedPointer(targetRoot, specPath) {
  if (!targetRoot || !specPath) return;
  const pointerAbs = path.join(targetRoot, LAST_FINALIZED_SPEC_POINTER_REL_PATH);
  fs.mkdirSync(path.dirname(pointerAbs), { recursive: true });
  fs.writeFileSync(pointerAbs, specPath + "\n");
}

export function commitOrSkip(args, opts) {
  const res = runGit(["commit", ...args], opts);
  if (res.ok) return { status: "done" };
  const output = res.stderr || res.stdout || "";
  if (/nothing to commit|no changes added to commit/i.test(output)) {
    return { status: "skipped", message: "nothing to commit" };
  }
  assertOk(res, "commit failed");
}

function getFinalizeMergeAllowedMetadataPaths(specId) {
  const paths = [
    `specs/${specId}/flow.json`,
    `specs/${specId}/issue-log.json`,
  ];
  return { paths, pathSet: new Set(paths) };
}

function walkPorcelainStatusPaths(output, visit) {
  let index = 0;
  while (index < output.length) {
    const next = output.indexOf("\0", index);
    const end = next === -1 ? output.length : next;
    const record = output.slice(index, end);
    index = end + 1;
    if (!record) continue;

    const status = record.slice(0, 2);
    const relPath = record.slice(3);
    if (relPath && visit(relPath, status) === false) return;

    if (status.includes("R") || status.includes("C")) {
      const originalNext = output.indexOf("\0", index);
      const originalEnd = originalNext === -1 ? output.length : originalNext;
      const originalPath = output.slice(index, originalEnd);
      index = originalEnd + 1;
      if (originalPath && visit(originalPath, status) === false) return;
    }
  }
}

function readFinalizeMergeStatusOutput(root) {
  const res = runGit(["status", "--porcelain=v1", "-z"], { cwd: root });
  assertOk(res, "finalize-merge metadata preflight failed: git status failed");
  return res.stdout || "";
}

function buildFinalizeMergeMetadataPreflight(specId, dirtyPaths) {
  const allowed = getFinalizeMergeAllowedMetadataPaths(specId);
  const metadataDirty = new Set();
  const externalDirtyPaths = [];
  for (const dirtyPath of dirtyPaths) {
    if (allowed.pathSet.has(dirtyPath)) {
      metadataDirty.add(dirtyPath);
    } else {
      externalDirtyPaths.push(dirtyPath);
    }
  }
  return {
    allowedMetadataPaths: allowed.paths,
    metadataDirtyPaths: allowed.paths.filter((relPath) => metadataDirty.has(relPath)),
    externalDirtyPaths,
  };
}

export function readFinalizeMergeMetadataPreflight({ root, specId }) {
  const allowed = getFinalizeMergeAllowedMetadataPaths(specId);
  const metadataDirty = new Set();
  const externalDirtyPaths = [];
  walkPorcelainStatusPaths(readFinalizeMergeStatusOutput(root), (dirtyPath) => {
    if (allowed.pathSet.has(dirtyPath)) {
      metadataDirty.add(dirtyPath);
      return true;
    }
    externalDirtyPaths.push(dirtyPath);
    return false;
  });
  return {
    allowedMetadataPaths: allowed.paths,
    metadataDirtyPaths: allowed.paths.filter((relPath) => metadataDirty.has(relPath)),
    externalDirtyPaths,
  };
}

export function getFinalizeMergeTargetExternalDirtyPaths({ root, specId, dirtyPaths, preflight }) {
  if (preflight) return preflight.externalDirtyPaths;
  if (dirtyPaths) return buildFinalizeMergeMetadataPreflight(specId, dirtyPaths).externalDirtyPaths;
  return readFinalizeMergeMetadataPreflight({ root, specId }).externalDirtyPaths;
}

export function hasFinalizeMergeTargetExternalDirty({ root, specId, dirtyPaths, preflight }) {
  return getFinalizeMergeTargetExternalDirtyPaths({ root, specId, dirtyPaths, preflight }).length > 0;
}

export function commitFinalizeMergeMetadataIfSafe({
  root,
  specId,
  dirtyPaths,
  preflight,
  includeFlowJson = false,
  message = "chore: record finalize metadata before merge",
}) {
  const metadataPreflight = preflight
    || (dirtyPaths
      ? buildFinalizeMergeMetadataPreflight(specId, dirtyPaths)
      : readFinalizeMergeMetadataPreflight({ root, specId }));
  if (metadataPreflight.externalDirtyPaths.length > 0) {
    return {
      status: "skipped",
      reason: "target-external-dirty",
      dirtyPaths: metadataPreflight.externalDirtyPaths,
    };
  }

  const dirtySet = new Set(metadataPreflight.metadataDirtyPaths);
  if (includeFlowJson) dirtySet.add(metadataPreflight.allowedMetadataPaths[0]);
  const metadataPaths = metadataPreflight.allowedMetadataPaths.filter((relPath) => dirtySet.has(relPath));
  if (metadataPaths.length === 0) {
    return { status: "skipped", reason: "no-metadata-dirty" };
  }

  const addRes = runGit(["add", "--", ...metadataPaths], { cwd: root });
  assertOk(addRes, "finalize-merge metadata preflight failed: git add failed");
  return {
    ...commitOrSkip(["-m", message], { cwd: root }),
    paths: metadataPaths,
  };
}

export function resolveGitCommonDir(root) {
  const res = runGit(["-C", root, "rev-parse", "--git-common-dir"]);
  assertOk(res, "finalize preflight failed: unable to resolve git common dir");
  return path.resolve(root, res.stdout.trim());
}

function buildFinalizePreflightError(err) {
  const msg = [
    `finalize preflight failed: ${err.message}`,
    "Help:",
    "- This environment cannot write under .git (lock file creation failed).",
    "- Run finalize in a writable shell or with elevated permissions.",
    "- Run: sdd-forge flow run finalize-commit --help",
  ].join("\n");
  const e = new Error(msg);
  e.code = "FINALIZE_PREFLIGHT_FAILED";
  return e;
}

export async function assertGitWriteAccess(gitDir) {
  const lockPath = path.join(gitDir, `.finalize-preflight-${process.pid}-${Date.now()}.lock`);
  try {
    await fs.promises.writeFile(lockPath, "preflight");
    await fs.promises.unlink(lockPath);
  } catch (err) {
    throw buildFinalizePreflightError(err);
  }
}

export async function runFinalizePreflight(root) {
  const gitDir = resolveGitCommonDir(root);
  await assertGitWriteAccess(gitDir);
}

export function runPreflightChecks({ root, baseBranch, featureBranch, commitStepActive }) {
  if (featureBranch === baseBranch) {
    return { ok: true, skipped: "spec-only" };
  }

  const uncommittedFiles = listUncommittedFiles({ cwd: root });
  const ahead = countCommitsBetween(baseBranch, featureBranch, { cwd: root });

  if (commitStepActive) {
    if (ahead === 0 && uncommittedFiles.length === 0) {
      return {
        ok: false,
        reason: "no-commits",
        baseBranch,
        featureBranch,
        hasUncommitted: false,
      };
    }
    return { ok: true };
  }

  if (uncommittedFiles.length > 0) {
    return { ok: false, reason: "dirty-worktree", uncommittedFiles };
  }

  if (ahead === 0) {
    return {
      ok: false,
      reason: "no-commits",
      baseBranch,
      featureBranch,
      hasUncommitted: false,
    };
  }

  return { ok: true };
}

/**
 * Run a one-shot migration script bundled under the CURRENT spec's directory.
 */
export function runMigrationHook(root, specRelPath) {
  if (!specRelPath) return;
  const specDir = path.dirname(specRelPath);
  const scriptPath = path.join(root, specDir, "scripts", "finalize-migration.js");
  if (!fs.existsSync(scriptPath)) return;
  const res = runCmd("node", [scriptPath], { cwd: root });
  assertOk(res, `finalize migration script failed: ${scriptPath}`);
}

/**
 * Post-commit hook implementation: generate report, commit artifacts.
 * retro is no longer invoked here — it runs as a mainline impl-phase step
 * before finalize-commit (spec 251).
 */
export async function executeCommitPost(ctx) {
  const { root } = ctx;
  const state = ctx.flowState;
  const results = ctx._results ||= {};
  const specAbsPath = state?.spec ? path.resolve(root, state.spec) : null;
  if (!specAbsPath || !fs.existsSync(specAbsPath)) {
    results.report = { status: "skipped", reason: "spec missing" };
    return;
  }

  // report
  const { generateReport, saveReport } = await import("../commands/report.js");

  const { diffStat: implDiffStat, commitMessages } = collectGitSummary(root, state.baseBranch);
  const specAbsDir = path.dirname(specAbsPath);
  // Shared loader validates test-execute-result.json v2 / test-result-review.json
  // and preserves results.testExecute.projectRegression for finalize report rendering.
  const testExecutePath = path.join(specAbsDir, "test-execute-result.json");
  const testResultReviewPath = path.join(specAbsDir, "test-result-review.json");
  if (fs.existsSync(testExecutePath) || fs.existsSync(testResultReviewPath)) {
    Object.assign(results, buildTestResultsFromArtifacts(specAbsDir));
  }

  let issueLog = { entries: [] };
  try {
    issueLog = loadIssueLog(root, state.spec);
  } catch (_) { /* no issue-log */ }

  const report = generateReport({
    state,
    results,
    issueLog,
    implDiffStat,
    commitMessages,
  });

  saveReport(root, state.spec, report);
  results.report = { status: "done", ...report };

  // post report to issue
  if (!state.issue) {
    results.issueComment = { status: "skipped", reason: "no linked issue" };
  } else if (!results.report?.text) {
    results.issueComment = { status: "skipped", reason: "report text missing" };
  } else if (!isGhAvailable()) {
    results.issueComment = { status: "skipped", reason: "gh unavailable" };
  } else {
    const res = commentOnIssue(state.issue, results.report.text, root);
    if (res.ok) {
      results.issueComment = { status: "done", issue: state.issue };
    } else {
      console.error(`Failed to post report to issue #${state.issue}: ${res.error}`);
      results.issueComment = { status: "failed", message: res.error };
    }
  }

  // commit only durable impl-phase test/report artifacts
  const durablePathspecPatterns = durableTestArtifactPathspecs(specIdFromPath(state.spec));
  const existingDurablePathspecs = collectExistingArtifactPathspecs(root, durablePathspecPatterns);
  if (existingDurablePathspecs.length > 0) {
    const addRes = runGit(["add", "--", ...existingDurablePathspecs], { cwd: root });
    assertOk(addRes, "failed to stage durable test/report artifacts");
  }
  try {
    commitOrSkip(["-m", "chore: add retro and report"], { cwd: root });
  } catch (e) {
    if (results.report) {
      results.report.commitNote = "retro/report commit failed: " + String(e.message || e).slice(0, 200);
    }
  }
}
