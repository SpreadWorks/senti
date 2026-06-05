/**
 * src/flow/lib/run-finalize-cleanup.js
 *
 * finalize-cleanup: clear flow state, commit the final flow.json snapshot to
 * the main repo, remove the worktree + feature branch, and embed the finalize
 * Report in the response envelope so the AI dispatcher does not need a follow-
 * up `flow report show` round-trip (spec 251).
 *
 * Spec 253 — orphan commit detection (squash route only):
 *
 * The cleanup body now executes a 4-stage decision flow before the existing
 * teardown transaction:
 *
 *   (A) args validation      — reject mutually-exclusive flags
 *   (B) route routing        — spec-only / PR / unknown skip decisions
 *   (C) orphan guard         — baseline ancestry + SHA comparison
 *   (D) existing teardown    — (i) step done → (ii) commit → (iv) cleanup
 *
 * Stages (A)/(B)/(C) halt before any side effects (worktree, branch, commit,
 * step status remain unchanged on halt). Once stage (D) starts, the original
 * transactional ordering (R5) is preserved.
 *
 * Recovery paths:
 *  - --auto-rescue: cherry-pick orphan commits onto baseBranch on the main
 *    repo, with detached-worktree fallback when baseBranch is locked, and
 *    `cherry-pick --skip` for empty-patch (duplicate) cases. Conflicts trigger
 *    `cherry-pick --abort` and CHERRY_PICK_CONFLICT halt.
 *  - --force: emit FORCED_ORPHAN_DROP warning, persist the dropped commit list
 *    to issue-log, then proceed to teardown.
 */

import fs from "fs";
import os from "os";
import path from "path";
import { Envelope } from "../../lib/flow-envelope.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { runGit } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import { writeLastFinalizedPointer } from "./run-finalize.js";
import { resolveLatestReportPath, readReportText } from "./run-report-show.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";

const ORPHAN_COMMIT_LIST_LIMIT = 50;
const RECOVERY_OPTIONS_DETECT = ["cherry-pick", "abort", "force-continue"];
const RECOVERY_OPTIONS_BASELINE = ["archive-and-manual-cherry-pick", "force-continue"];
const RECOVERY_OPTIONS_RESCUE_FAIL = ["archive-and-manual-cherry-pick", "retry-without-rescue"];
const RECOVERY_OPTIONS_DIRTY = ["commit-or-stash-first", "retry-without-rescue"];

function buildReportField(mainRoot) {
  // The embedded cleanup report is the same report-show text generated from
  // validated v2 test-execute-result/test-result-review artifacts, including
  // projectRegression data. Missing or malformed report data is surfaced as
  // REPORT_MISSING instead of fabricated.
  try {
    const path = resolveLatestReportPath(mainRoot);
    const text = readReportText(path);
    return { report: { path, text }, missing: null };
  } catch (err) {
    return { report: null, missing: err };
  }
}

function attachReport(env, mainRoot) {
  const { report, missing } = buildReportField(mainRoot);
  env.data.report = report;
  if (missing) {
    env.addWarning("REPORT_MISSING", missing.message);
  }
  return env;
}

/**
 * R14: build dirty-file list for the auto-rescue precondition while excluding
 * specs/<id>/issue-log.json (which may be a leftover from a previous
 * CHERRY_PICK_CONFLICT halt and is intentionally retained until the next
 * successful cleanup commit). The pathspec uses git's negative form so the
 * result reflects only "real" dirty files.
 */
function listMainRepoDirtyFiles(mainRepoPath, specId) {
  const res = runGit([
    "-C",
    mainRepoPath,
    "status",
    "--porcelain",
    "--",
    ".",
    `:!specs/${specId}/issue-log.json`,
  ]);
  if (!res.ok) return [];
  return res.stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => line.slice(3));
}

function listOtherDirtyFlowJsonPaths(mainRepoPath, specId) {
  const res = runGit([
    "-C",
    mainRepoPath,
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--",
    ":(glob)specs/*/flow.json",
  ]);
  if (!res.ok) {
    throw new Error(res.stderr || res.stdout || "git status failed");
  }
  const targetPath = `specs/${specId}/flow.json`;
  const paths = [];
  const seen = new Set();
  for (const line of res.stdout.split("\n")) {
    if (!line.trim()) continue;
    const relPath = line.slice(3).trim();
    if (!relPath || relPath === targetPath || seen.has(relPath)) continue;
    seen.add(relPath);
    paths.push(relPath);
  }
  return paths;
}

function attachOtherFlowMetadataWarning(env, mainRepoPath, specId) {
  let paths;
  try {
    paths = listOtherDirtyFlowJsonPaths(mainRepoPath, specId);
  } catch (err) {
    env.addWarning(
      "OTHER_FLOW_METADATA_STATUS_FAILED",
      `Failed to inspect other flow metadata dirtiness: ${err.message}`,
    );
    return env;
  }
  if (paths.length === 0) return env;
  env.addWarning(
    "OTHER_FLOW_METADATA_DIRTY",
    [
      "Other active flow metadata remains dirty in the main repository:",
      ...paths.map((p) => `  - ${p}`),
    ],
  );
  return env;
}

/**
 * R1/R3/R6: parse `git log --reverse <baseline>..<featureBranch>` output into
 * { sha, subject } pairs and apply the 50-commit cap.
 */
function readOrphanCommits(repoPath, baseline, featureBranch) {
  const res = runGit([
    "-C",
    repoPath,
    "log",
    "--reverse",
    "--pretty=format:%H%x09%s",
    `${baseline}..${featureBranch}`,
  ]);
  if (!res.ok) {
    return { ok: false, reason: res.stderr || res.stdout || "git log failed" };
  }
  const lines = res.stdout.split("\n").filter(Boolean);
  const total = lines.length;
  const slice = lines.slice(0, ORPHAN_COMMIT_LIST_LIMIT);
  const commits = slice.map((line) => {
    const tabIdx = line.indexOf("\t");
    if (tabIdx === -1) return { sha: line, subject: null };
    return { sha: line.slice(0, tabIdx), subject: line.slice(tabIdx + 1) };
  });
  return {
    ok: true,
    commits,
    count: total,
    truncated: total > ORPHAN_COMMIT_LIST_LIMIT,
  };
}

/**
 * R14/R15: append a single audit-log entry while keeping a snapshot of the
 * pre-write content so commit-time rollback restores the file exactly. Writes
 * unconditionally to the main repo (not the worktree, which may be deleted by
 * later teardown).
 */
function appendIssueLog(mainRepoPath, specPath, entry) {
  const snapshotBefore = loadIssueLog(mainRepoPath, specPath);
  // Deep clone via JSON so the snapshot is decoupled from later mutations.
  const snapshot = JSON.parse(JSON.stringify(snapshotBefore));
  const next = JSON.parse(JSON.stringify(snapshotBefore));
  next.entries.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });
  saveIssueLog(mainRepoPath, specPath, next);
  return snapshot;
}

function restoreIssueLog(mainRepoPath, specPath, snapshot) {
  if (!snapshot) return;
  saveIssueLog(mainRepoPath, specPath, snapshot);
}

/**
 * R8/R9 auto-rescue cherry-pick driver. Returns one of:
 *   { ok: true, intoBranch, commits }                            — cherry-pick succeeded.
 *   { ok: false, code: "MAIN_REPO_DIRTY", dirtyFiles }           — preflight dirty.
 *   { ok: false, code: "MAIN_REPO_LOCKED" }                      — checkout & fallback both failed.
 *   { ok: false, code: "CHERRY_PICK_CONFLICT", conflictFiles }   — cherry-pick conflict, restored.
 */
function runAutoRescue({ mainRepoPath, baseBranch, baseline, featureBranch, specId }) {
  const dirtyFiles = listMainRepoDirtyFiles(mainRepoPath, specId);
  if (dirtyFiles.length > 0) {
    return { ok: false, code: "MAIN_REPO_DIRTY", dirtyFiles };
  }

  const range = `${baseline}..${featureBranch}`;

  // First try a direct checkout of baseBranch on the main repo.
  const checkoutRes = runGit(["-C", mainRepoPath, "checkout", baseBranch]);
  if (checkoutRes.ok) {
    const result = cherryPickRange(mainRepoPath, range);
    return result;
  }

  // baseBranch locked — fall back to a temporary detached worktree.
  const tmpWorktree = path.join(os.tmpdir(), `sdd-rescue-tmp-${process.pid}-${Date.now()}`);
  const addRes = runGit(["-C", mainRepoPath, "worktree", "add", "--detach", tmpWorktree, baseBranch]);
  if (!addRes.ok) {
    return { ok: false, code: "MAIN_REPO_LOCKED" };
  }
  try {
    const result = cherryPickRange(tmpWorktree, range);
    if (!result.ok) return result;
    const headRes = runGit(["-C", tmpWorktree, "rev-parse", "HEAD"]);
    if (!headRes.ok) {
      return { ok: false, code: "MAIN_REPO_LOCKED" };
    }
    const updateRes = runGit([
      "-C",
      mainRepoPath,
      "update-ref",
      `refs/heads/${baseBranch}`,
      headRes.stdout.trim(),
    ]);
    if (!updateRes.ok) {
      return { ok: false, code: "MAIN_REPO_LOCKED" };
    }
    return result;
  } finally {
    runGit(["-C", mainRepoPath, "worktree", "remove", "--force", tmpWorktree]);
  }
}

/**
 * Run `git cherry-pick <range>` with empty-patch tolerance. On the first
 * conflict, abort and return CHERRY_PICK_CONFLICT.
 */
function cherryPickRange(repoPath, range) {
  // --allow-empty makes `git cherry-pick` skip empty commits silently;
  // duplicate-content commits still need `--skip` recovery below.
  let res = runGit(["-C", repoPath, "cherry-pick", range]);
  while (!res.ok) {
    const text = `${res.stdout || ""}\n${res.stderr || ""}`;
    if (/nothing to commit|previous cherry-pick is now empty/i.test(text)) {
      // Duplicate / empty patch — skip and continue with the rest.
      const skip = runGit(["-C", repoPath, "cherry-pick", "--skip"]);
      if (!skip.ok) {
        // --skip itself may fail (no in-progress cherry-pick); abort defensively.
        runGit(["-C", repoPath, "cherry-pick", "--abort"]);
        return { ok: false, code: "CHERRY_PICK_CONFLICT", conflictFiles: [] };
      }
      // After --skip, git may have completed the sequence (skip succeeded with
      // nothing more to do) or be ready for the next commit. Probe with the
      // continuation form: another cherry-pick command is not needed — `--skip`
      // continues the in-progress sequence on its own.
      res = skip;
      // Determine whether a cherry-pick is still in progress; if not, we're done.
      const stateProbe = runGit(["-C", repoPath, "rev-parse", "CHERRY_PICK_HEAD"]);
      if (!stateProbe.ok) {
        // No in-progress cherry-pick → sequence completed.
        break;
      }
      continue;
    }
    // Genuine conflict.
    const statusRes = runGit(["-C", repoPath, "diff", "--name-only", "--diff-filter=U"]);
    const conflictFiles = statusRes.ok
      ? statusRes.stdout.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];
    runGit(["-C", repoPath, "cherry-pick", "--abort"]);
    return { ok: false, code: "CHERRY_PICK_CONFLICT", conflictFiles };
  }
  return { ok: true };
}

export class RunFinalizeCleanupCommand extends FlowCommand {
  async execute(ctx) {
    const { root, autoRescue, force } = ctx;
    const state = ctx.flowState;
    const { worktreePath, mainRepoPath } = ctx.flowManager.resolveWorktreePaths(state);
    const { baseBranch, featureBranch, worktree } = state;
    const specId = specIdFromPath(state.spec);
    const reportRoot = mainRepoPath || root;

    // ── Stage (A) — args validation ─────────────────────────────────────────
    if (autoRescue && force) {
      return Envelope.fail("run", "finalize-cleanup", "ARGS_ERROR", [
        "--auto-rescue and --force are mutually exclusive. Pass at most one.",
      ]);
    }

    // Spec-only mode: feature branch === base branch. There is no merge to
    // bake into a commit — just clear active flow state and emit the report.
    if (featureBranch === baseBranch) {
      writeLastFinalizedPointer(reportRoot, state.spec);
      ctx.flowManager.clearFlowState(specId);
      return attachReport(
        Envelope.ok("run", "finalize-cleanup", { status: "done", message: "spec-only mode" }),
        reportRoot,
      );
    }

    // ── Stage (B) — route routing ───────────────────────────────────────────
    const persistedStrategy = state.state?.mergeStrategy ?? null;
    const baseline = state.state?.featureBranchSquashedSha ?? null;

    if (persistedStrategy === "pr") {
      // PR route — orphan detection is out of scope (Issue #316). Proceed
      // straight into the existing teardown transaction.
      return runTeardown(ctx, { worktreePath, mainRepoPath, reportRoot, specId });
    }

    if (persistedStrategy !== "squash") {
      // Either an old flow.json predating this feature, or a corrupt state.
      // Halt unless the user explicitly waives baseline checking via --force.
      if (!force) {
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "SQUASH_BASELINE_MISSING",
          [
            "Squash baseline is not recorded on this flow (mergeStrategy is missing).",
            "Detection cannot run safely. Recovery: archive the feature branch, inspect commits via patch, cherry-pick post-squash fixes onto baseBranch by hand, then re-run with --force.",
            "Resolve any cherry-pick state via `git cherry-pick --skip` or `git cherry-pick --abort` before retrying.",
          ],
          {
            recordedSha: null,
            baseBranch,
            featureBranch,
            recoveryOptions: RECOVERY_OPTIONS_BASELINE,
          },
        );
      }
      // --force path: skip detection, proceed to forced teardown with audit.
      return runForcedTeardown(ctx, {
        worktreePath,
        mainRepoPath,
        reportRoot,
        specId,
        baseline: null,
        featureBranch,
        baseBranch,
      });
    }

    // ── Stage (C) — orphan guard (squash route only) ────────────────────────
    if (!baseline) {
      if (!force) {
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "SQUASH_BASELINE_MISSING",
          [
            "Squash baseline SHA is missing for this squash-route flow.",
            "Detection cannot run safely. Recovery: archive the feature branch, inspect commits via patch, cherry-pick post-squash fixes onto baseBranch by hand, then re-run with --force.",
          ],
          {
            recordedSha: null,
            baseBranch,
            featureBranch,
            recoveryOptions: RECOVERY_OPTIONS_BASELINE,
          },
        );
      }
      return runForcedTeardown(ctx, {
        worktreePath,
        mainRepoPath,
        reportRoot,
        specId,
        baseline: null,
        featureBranch,
        baseBranch,
      });
    }

    // R1: resolve the current featureBranch ref explicitly (NOT process HEAD;
    // in branch mode HEAD points at baseBranch by the time cleanup runs).
    const currentRes = runGit([
      "-C",
      mainRepoPath || root,
      "rev-parse",
      featureBranch,
    ]);
    if (!currentRes.ok) {
      return Envelope.fail("run", "finalize-cleanup", "BRANCH_REF_RESOLUTION_FAILED", [
        `Failed to resolve ref for ${featureBranch}: ${currentRes.stderr || currentRes.stdout}`,
      ]);
    }
    const currentSha = currentRes.stdout.trim();

    if (currentSha === baseline) {
      // No-op: feature branch unchanged since squash. Proceed to teardown.
      return runTeardown(ctx, { worktreePath, mainRepoPath, reportRoot, specId });
    }

    const ancestryRes = runGit([
      "-C",
      mainRepoPath || root,
      "merge-base",
      "--is-ancestor",
      baseline,
      featureBranch,
    ]);
    if (!ancestryRes.ok) {
      // Non-zero exit means baseline is NOT an ancestor of featureBranch
      // (history rewrite — rebase / amend / force-update).
      if (!force) {
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "SQUASH_BASELINE_DIVERGED",
          [
            "Squash baseline is no longer an ancestor of the feature branch.",
            "This indicates a history rewrite (rebase / amend / force-update).",
            "Recovery: archive the current branch, inspect commits via patch, cherry-pick fixes onto baseBranch manually, then re-run with --force.",
          ],
          {
            recordedSha: baseline,
            currentSha,
            baseBranch,
            featureBranch,
            recoveryOptions: RECOVERY_OPTIONS_BASELINE,
          },
        );
      }
      return runForcedTeardown(ctx, {
        worktreePath,
        mainRepoPath,
        reportRoot,
        specId,
        baseline,
        featureBranch,
        baseBranch,
        diverged: true,
      });
    }

    // baseline is an ancestor and SHA differs → orphan commits exist.
    const orphan = readOrphanCommits(mainRepoPath || root, baseline, featureBranch);
    if (!orphan.ok) {
      return Envelope.fail("run", "finalize-cleanup", "ORPHAN_LISTING_FAILED", [
        `Failed to list orphan commits: ${orphan.reason}`,
      ]);
    }
    if (orphan.count === 0) {
      // Baseline differs from current SHA but the range is empty
      // (e.g. a merge commit with no exclusive commits). Treat as no-op.
      return runTeardown(ctx, { worktreePath, mainRepoPath, reportRoot, specId });
    }

    if (autoRescue) {
      const rescue = runAutoRescue({
        mainRepoPath: mainRepoPath || root,
        baseBranch,
        baseline,
        featureBranch,
        specId,
      });
      if (rescue.ok) {
        const teardown = await runTeardown(ctx, {
          worktreePath,
          mainRepoPath,
          reportRoot,
          specId,
        });
        if (teardown && teardown.data) {
          teardown.data.rescued = {
            commits: orphan.commits,
            intoBranch: baseBranch,
          };
        }
        return teardown;
      }
      // Rescue failed — record audit log for CHERRY_PICK_CONFLICT, halt.
      if (rescue.code === "CHERRY_PICK_CONFLICT" && mainRepoPath) {
        try {
          appendIssueLog(mainRepoPath, state.spec, {
            step: "finalize-cleanup",
            reason: "cherry-pick conflict during auto-rescue (worktree retained for manual recovery)",
            trigger: "sdd-forge flow run finalize-cleanup --auto-rescue",
            resolution:
              "cherry-pick aborted; user must resolve manually via archive + individual cherry-pick",
            taskId: null,
          });
        } catch (err) {
          process.stderr.write(`[sdd-forge] cleanup: audit log append failed: ${err.message}\n`);
        }
      }
      const failPayload = {
        recordedSha: baseline,
        currentSha,
        baseBranch,
        featureBranch,
        recoveryOptions: RECOVERY_OPTIONS_RESCUE_FAIL,
      };
      if (rescue.code === "MAIN_REPO_DIRTY") {
        failPayload.dirtyFiles = rescue.dirtyFiles;
        failPayload.recoveryOptions = RECOVERY_OPTIONS_DIRTY;
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "MAIN_REPO_DIRTY",
          [
            "Main repository has uncommitted changes that block auto-rescue.",
            "Commit or stash them, then retry with --auto-rescue, or retry without rescue and rescue manually.",
          ],
          failPayload,
        );
      }
      if (rescue.code === "MAIN_REPO_LOCKED") {
        return Envelope.fail(
          "run",
          "finalize-cleanup",
          "MAIN_REPO_LOCKED",
          [
            `Failed to acquire baseBranch ${baseBranch} for auto-rescue (locked and detached fallback failed).`,
            "Resolve worktree contention manually and retry, or rescue manually.",
          ],
          failPayload,
        );
      }
      // CHERRY_PICK_CONFLICT
      failPayload.conflictFiles = rescue.conflictFiles || [];
      return Envelope.fail(
        "run",
        "finalize-cleanup",
        "CHERRY_PICK_CONFLICT",
        [
          "Cherry-pick of orphan commits onto baseBranch produced a conflict.",
          "The worktree and feature branch are retained for manual recovery.",
          "Resolve any cherry-pick state via `git cherry-pick --skip` or `git cherry-pick --abort` if your local state is left in an in-progress cherry-pick.",
        ],
        failPayload,
      );
    }

    if (force) {
      return runForcedTeardown(ctx, {
        worktreePath,
        mainRepoPath,
        reportRoot,
        specId,
        baseline,
        featureBranch,
        baseBranch,
        droppedCommits: orphan.commits,
        droppedCount: orphan.count,
        droppedTruncated: orphan.truncated,
      });
    }

    // Default: detect-and-halt with the canonical user-facing recovery menu.
    return Envelope.fail(
      "run",
      "finalize-cleanup",
      "ORPHAN_COMMITS_DETECTED",
      [
        `Orphan commits detected on ${featureBranch} (${orphan.count} commit(s) beyond the recorded squash baseline).`,
        "These commits are not reachable from the recorded squash baseline and would be dropped by branch deletion.",
        "Recovery options:",
        "  - cherry-pick: re-run with `--auto-rescue` to cherry-pick orphan commits onto baseBranch",
        "  - abort: leave the worktree and feature branch as-is and inspect/handle manually",
        "  - force-continue: re-run with `--force` to delete the branch (commits will be lost; recorded to issue-log)",
      ],
      {
        recordedSha: baseline,
        currentSha,
        count: orphan.count,
        truncated: orphan.truncated,
        orphanCommits: orphan.commits,
        baseBranch,
        featureBranch,
        recoveryOptions: RECOVERY_OPTIONS_DETECT,
      },
    );
  }
}

/**
 * Stage (D) — the original transactional teardown.
 * Extracted into a function so route routing and the no-op orphan path can
 * fall through to the same authoritative cleanup transaction.
 */
async function runTeardown(ctx, { worktreePath, mainRepoPath, reportRoot, specId }) {
  const state = ctx.flowState;
  const { featureBranch, worktree, baseBranch } = state;

  // (i) metadata sync + finalize-cleanup → 'done'.
  const targetRoot = (worktree && mainRepoPath) ? mainRepoPath : ctx.root;
  const targetFm = (worktree && mainRepoPath) ? ctx.flowManager.forRoot(mainRepoPath) : ctx.flowManager;

  // Spec 272: sync unreflected flow metadata (e.g. retry success logs) from
  // worktree to main before teardown.
  if (worktree && mainRepoPath && ctx.root !== mainRepoPath) {
    try {
      syncMetadataFromWorktreeToMain(ctx.root, mainRepoPath, specId);
    } catch (err) {
      process.stderr.write(`[sdd-forge] cleanup: metadata sync warning: ${err.message}\n`);
    }
  }

  const flowJsonRel = `specs/${specId}/flow.json`;
  targetFm.updateStepStatus("finalize-cleanup", "done", { specId });

  // (ii) stage + commit. Stage flow.json plus issue-log if present so audit
  // entries written by --force / CHERRY_PICK_CONFLICT during the same run
  // become atomically persisted (R14).
  runGit(["-C", targetRoot, "add", "--", flowJsonRel]);
  const issueLogRel = `specs/${specId}/issue-log.json`;
  if (fs.existsSync(path.join(targetRoot, issueLogRel))) {
    runGit(["-C", targetRoot, "add", "--", issueLogRel]);
  }
  const commitMsg = `chore: finalize ${specId}`;
  const commitPaths = [flowJsonRel];
  if (fs.existsSync(path.join(targetRoot, issueLogRel))) {
    commitPaths.push(issueLogRel);
  }
  const commitRes = runGit(["-C", targetRoot, "commit", "-m", commitMsg, "--", ...commitPaths]);
  if (!commitRes.ok) {
    // (iii) rollback so retry is meaningful.
    try {
      targetFm.updateStepStatus("finalize-cleanup", "in_progress", { specId });
    } catch (rollbackErr) {
      process.stderr.write(`[sdd-forge] cleanup rollback failed: ${rollbackErr.message}\n`);
    }
    return Envelope.fail("run", "finalize-cleanup", "COMMIT_FAILED", [
      `git commit failed: ${commitRes.stderr || commitRes.stdout || "unknown"}`,
    ]);
  }

  // (iv) commit succeeded — pointer + active-flow clear + worktree teardown.
  writeLastFinalizedPointer(reportRoot, state.spec);
  ctx.flowManager.clearFlowState(specId);

  if (worktree && mainRepoPath) {
    const wtPath = worktreePath || ctx.root;
    if (fs.existsSync(wtPath)) {
      const removeRes = runGit(["-C", mainRepoPath, "worktree", "remove", wtPath]);
      if (!removeRes.ok) {
        return Envelope.fail("run", "finalize-cleanup", "WORKTREE_REMOVE_FAILED", [
          `git worktree remove failed: ${removeRes.stderr || removeRes.stdout || "unknown"}`,
          "Common cause: untracked files or uncommitted changes in the worktree.",
          "Resolve the dirty state and retry cleanup.",
        ]);
      }
    }
    const branchRes = runGit(["-C", mainRepoPath, "branch", "-D", featureBranch]);
    if (!branchRes.ok && !branchRes.stderr.includes("not found")) {
      return Envelope.fail("run", "finalize-cleanup", "BRANCH_DELETE_FAILED", [
        `git branch -D ${featureBranch} failed: ${branchRes.stderr || branchRes.stdout || "unknown"}`,
      ]);
    }
  } else {
    const branchRes = runGit(["branch", "-D", featureBranch], { cwd: targetRoot });
    if (!branchRes.ok && !branchRes.stderr.includes("not found")) {
      return Envelope.fail("run", "finalize-cleanup", "BRANCH_DELETE_FAILED", [
        `git branch -D ${featureBranch} failed: ${branchRes.stderr || branchRes.stdout || "unknown"}`,
      ]);
    }
  }

  // (v) strict post-teardown validation.
  const validation = validateTeardown({ worktreePath, mainRepoPath, featureBranch, specId });
  if (!validation.ok) {
    return Envelope.fail("run", "finalize-cleanup", "TEARDOWN_VALIDATION_FAILED", [
      "Teardown appeared to succeed but resources remain:",
      ...validation.reasons.map((r) => `- ${r}`),
    ]);
  }

  const env = attachReport(
    Envelope.ok("run", "finalize-cleanup", { status: "done" }),
    reportRoot,
  );
  if (worktree && mainRepoPath) {
    attachOtherFlowMetadataWarning(env, mainRepoPath, specId);
  }
  return env;
}

/**
 * Spec 272: Sync unreflected SDD metadata (runtimeLog only) from worktree to main.
 * Status and other fields are already handled by the post-hook authoritative
 * updates or squash-merge. We only pick up logs from previous successful retries
 * that might have only landed in the worktree's flow.json.
 */
export function syncMetadataFromWorktreeToMain(worktreeRoot, mainRoot, specId) {
  const wtPath = path.join(worktreeRoot, "specs", specId, "flow.json");
  const mainPath = path.join(mainRoot, "specs", specId, "flow.json");
  if (!fs.existsSync(wtPath) || !fs.existsSync(mainPath)) return;

  const wtState = JSON.parse(fs.readFileSync(wtPath, "utf8"));
  const mainState = JSON.parse(fs.readFileSync(mainPath, "utf8"));

  let mutated = false;
  const wtSteps = flattenSteps(wtState.steps || []);
  const mainSteps = flattenSteps(mainState.steps || []);

  for (const wtStep of wtSteps) {
    if (!wtStep.runtimeLog) continue;
    const mainStep = mainSteps.find((s) => s.id === wtStep.id);
    if (!mainStep) continue;

    // Adopt the worktree log if the main one is missing or has a different sequence.
    if (!mainStep.runtimeLog || mainStep.runtimeLog.sequence !== wtStep.runtimeLog.sequence) {
      mainStep.runtimeLog = { ...wtStep.runtimeLog };
      mutated = true;
    }
  }

  if (mutated) {
    fs.writeFileSync(mainPath, JSON.stringify(mainState, null, 2) + "\n", "utf8");
  }
}

export function validateTeardown({ worktreePath, mainRepoPath, featureBranch, specId }) {
  const reasons = [];

  if (mainRepoPath) {
    const wtListRes = runGit(["-C", mainRepoPath, "worktree", "list", "--porcelain"]);
    if (wtListRes.ok && worktreePath) {
      const absPath = path.resolve(worktreePath);
      if (wtListRes.stdout.split("\n").some((line) => line === `worktree ${absPath}`)) {
        reasons.push(`Worktree registration remains for ${absPath}`);
      }
    }

    if (worktreePath && fs.existsSync(worktreePath)) {
      reasons.push(`Physical worktree directory remains: ${worktreePath}`);
    }

    const branchRes = runGit(["-C", mainRepoPath, "branch", "--list", featureBranch]);
    if (branchRes.ok && branchRes.stdout.trim()) {
      reasons.push(`Feature branch remains: ${featureBranch}`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

function flattenSteps(steps) {
  const flat = [];
  for (const s of steps) {
    flat.push(s);
    if (Array.isArray(s.children)) {
      flat.push(...flattenSteps(s.children));
    }
  }
  return flat;
}

export { runTeardown };

/**
 * --force teardown variant: persist a FORCED_ORPHAN_DROP audit entry to the
 * main repo issue-log before the existing teardown commits + deletes. The
 * audit entry is staged together with flow.json by runTeardown so the entire
 * destructive action lands in a single commit.
 */
async function runForcedTeardown(ctx, opts) {
  const state = ctx.flowState;
  const { mainRepoPath, baseline, featureBranch, baseBranch } = opts;
  const droppedCommits = opts.droppedCommits || [];
  const droppedCount = opts.droppedCount ?? droppedCommits.length;
  const droppedTruncated = opts.droppedTruncated ?? false;
  const auditTarget = mainRepoPath || ctx.root;

  let snapshot = null;
  try {
    snapshot = appendIssueLog(auditTarget, state.spec, {
      step: "finalize-cleanup",
      reason:
        "FORCED_ORPHAN_DROP: feature branch deleted via --force despite orphan / divergent state",
      trigger: "sdd-forge flow run finalize-cleanup --force",
      resolution:
        droppedCommits.length > 0
          ? `dropped ${droppedCount} commit(s); top sha=${droppedCommits[0]?.sha?.slice(0, 12) || "n/a"}`
          : opts.diverged
          ? "baseline diverged (history rewrite); branch deleted without rescue"
          : "baseline missing; branch deleted without rescue",
      taskId: null,
    });
  } catch (err) {
    process.stderr.write(`[sdd-forge] cleanup: audit log append failed: ${err.message}\n`);
  }

  const teardown = await runTeardown(ctx, opts);
  if (!teardown.ok && snapshot) {
    // Commit failed during teardown → restore audit log to its pre-write state
    // so the next retry sees a clean tree (R14 snapshot rollback).
    try {
      restoreIssueLog(auditTarget, state.spec, snapshot);
    } catch (err) {
      process.stderr.write(`[sdd-forge] cleanup: audit log rollback failed: ${err.message}\n`);
    }
    return teardown;
  }

  // Convert the success envelope into a warn-level FORCED_ORPHAN_DROP.
  if (teardown.ok) {
    teardown.data.droppedCommits = droppedCommits;
    teardown.data.count = droppedCount;
    teardown.data.truncated = droppedTruncated;
    teardown.addWarning(
      "FORCED_ORPHAN_DROP",
      [
        `Feature branch deleted with --force despite ${droppedCount} unsaved commit(s).`,
        "The dropped commit list has been recorded in issue-log.json for audit.",
      ],
    );
  }
  return teardown;
}

export default RunFinalizeCleanupCommand;
