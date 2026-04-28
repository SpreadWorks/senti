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

export const REPORT_SHOW_COMMAND = "sdd-forge flow report show";

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
    "- Run: sdd-forge flow run finalize --help",
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
 * Post-commit hook implementation: run retro, generate report, commit artifacts.
 */
export async function executeCommitPost(ctx) {
  const { root } = ctx;
  const state = ctx.flowState;
  const results = ctx._results || {};

  // retro
  try {
    const RetroCommand = (await import("./run-retro.js")).default;
    const retroResult = await new RetroCommand().run(container, { force: true });
    const summary = retroResult?.artifacts?.summary;
    results.retro = { status: "done", ...(summary ? { summary } : {}) };
  } catch (e) {
    results.retro = { status: "failed", message: String(e.message) };
  }

  // report
  try {
    const { generateReport, saveReport } = await import("../commands/report.js");

    const { diffStat: implDiffStat, commitMessages } = collectGitSummary(root, state.baseBranch);

    let issueLog = { entries: [] };
    try {
      issueLog = loadIssueLog(root, state.spec);
    } catch (_) { /* no issue-log */ }

    const report = generateReport({
      state,
      results,
      redolog: issueLog,
      implDiffStat,
      commitMessages,
    });

    try { saveReport(root, state.spec, report); } catch (e) { report.saveError = e.message; }
    results.report = { status: "done", ...report };
  } catch (e) {
    results.report = { status: "failed", message: String(e.message || e) };
  }

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

  // commit retro + report files
  const specDir = path.posix.join("specs", specIdFromPath(state.spec));
  runGit(["add", "--", specDir], { cwd: root });
  try {
    commitOrSkip(["-m", "chore: add retro and report"], { cwd: root });
  } catch (e) {
    if (results.report) {
      results.report.commitNote = "retro/report commit failed: " + String(e.message || e).slice(0, 200);
    }
  }
}
