/**
 * src/flow/lib/run-finalize-cleanup.js
 *
 * finalize-cleanup: clear flow state, commit the final flow.json snapshot to
 * the main repo, remove the worktree + feature branch, and embed the finalize
 * Report in the response envelope so the AI dispatcher does not need a follow-
 * up `flow report show` round-trip (spec 251).
 *
 * Transactional ordering (R5):
 *   (i) update finalize-cleanup step to 'done' on the main repo flow.json
 *       (working tree dirty)
 *  (ii) git add specs/<id>/flow.json + git commit
 * (iii) on commit failure: rollback step to 'in_progress' and return failure
 *       (worktree is NOT removed so the user can retry)
 *  (iv) on commit success only: remove the worktree + delete the branch, then
 *       write the .sdd-forge/last-finalized-spec pointer
 *   (v) read report.json via the shared run-report-show.js helpers and embed
 *       { path, text } in envelope.data.report. Missing report → addWarning
 *       'REPORT_MISSING' (ok:true preserved).
 */

import fs from "fs";
import { Envelope } from "../../lib/flow-envelope.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { runGit } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import { writeLastFinalizedPointer } from "./run-finalize.js";
import { resolveLatestReportPath, readReportText } from "./run-report-show.js";

function buildReportField(mainRoot) {
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

export class RunFinalizeCleanupCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const state = ctx.flowState;
    const { worktreePath, mainRepoPath } = ctx.flowManager.resolveWorktreePaths(state);
    const { baseBranch, featureBranch, worktree } = state;
    const specId = specIdFromPath(state.spec);
    const reportRoot = mainRepoPath || root;

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

    // Worktree finalize: bake the final flow.json into a commit on main.
    const targetRoot = (worktree && mainRepoPath) ? mainRepoPath : root;
    const targetFm = (worktree && mainRepoPath) ? ctx.flowManager.forRoot(mainRepoPath) : ctx.flowManager;
    const flowJsonRel = `specs/${specId}/flow.json`;

    // (i) finalize-cleanup → 'done' so the snapshot we are about to commit
    // contains the terminal state. We pass specId so updates land on the main
    // repo flow.json even before .active-flow registers the spec there.
    targetFm.updateStepStatus("finalize-cleanup", "done", { specId });

    // (ii) stage + commit. specs/<id>/flow.json is the only intentionally
    // dirty file at this point (set by prior post hooks for finalize-merge /
    // finalize-sync, which deferred their own commits per the case-B commit
    // strategy in spec 251).
    runGit(["-C", targetRoot, "add", "--", flowJsonRel]);
    const commitMsg = `chore: finalize ${specId}`;
    const commitRes = runGit(["-C", targetRoot, "commit", "-m", commitMsg]);
    if (!commitRes.ok) {
      // (iii) rollback so retry is meaningful. updateStepStatus rewrites
      // the file with cleanup back to 'in_progress'; merge/sync 'done'
      // updates from prior post hooks remain in working-tree memory, ready
      // for the next attempt.
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
      const wtPath = worktreePath || root;
      if (fs.existsSync(wtPath)) {
        runGit(["-C", mainRepoPath, "worktree", "remove", wtPath]);
      }
      runGit(["-C", mainRepoPath, "branch", "-D", featureBranch]);
    } else {
      runGit(["branch", "-D", featureBranch], { cwd: targetRoot });
    }

    // (v) embed Report so the AI does not need a follow-up call.
    return attachReport(
      Envelope.ok("run", "finalize-cleanup", { status: "done" }),
      reportRoot,
    );
  }
}

export default RunFinalizeCleanupCommand;
