/**
 * src/flow/lib/run-finalize.js
 *
 * FlowCommand: finalize pipeline — commit(+retro+report) -> merge -> sync -> cleanup.
 *
 * Sub-step hooks (post, onError) are defined in registry.js.
 * This module uses runSubStep() to apply those hooks around each step.
 */

import fs from "fs";
import path from "path";
import { runCmd, assertOk } from "../../lib/process.js";
import { PKG_DIR } from "../../lib/cli.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";
import { isGhAvailable, commentOnIssue, collectGitSummary, runGit } from "../../lib/git-helpers.js";
import { VALID_MERGE_STRATEGIES } from "../../lib/constants.js";
import { FlowCommand } from "./base-command.js";
import { FLOW_COMMANDS } from "../registry.js";
import { container } from "../../lib/container.js";
import { POINTER_REL_PATH as LAST_FINALIZED_SPEC_POINTER_REL_PATH } from "./run-report-show.js";

/**
 * Create an onError hook for finalize sub-steps that records to issue-log.
 * @param {string} stepName
 * @returns {(ctx: object, err: Error) => void}
 */
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

/**
 * Write the relative spec path of the current finalize target to
 * `.sdd-forge/last-finalized-spec` under the main repo. Consumed by
 * `sdd-forge flow report show` after the worktree/flow state is removed.
 */
export function writeLastFinalizedPointer(targetRoot, specPath) {
  if (!targetRoot || !specPath) return;
  const pointerAbs = path.join(targetRoot, LAST_FINALIZED_SPEC_POINTER_REL_PATH);
  fs.mkdirSync(path.dirname(pointerAbs), { recursive: true });
  fs.writeFileSync(pointerAbs, specPath + "\n");
}

/**
 * Execute cleanup: clear flow state, remove worktree/branch.
 */
function executeCleanupImpl({ root, flowState, flowManager, worktreePath, mainRepoPath }) {
  const { baseBranch, featureBranch, worktree } = flowState;
  const specId = specIdFromPath(flowState.spec);

  writeLastFinalizedPointer(mainRepoPath || root, flowState.spec);

  if (featureBranch === baseBranch) {
    flowManager.clearFlowState(specId);
    return { status: "done", message: "spec-only mode" };
  }

  flowManager.clearFlowState(specId);

  if (worktree && mainRepoPath) {
    const wtPath = worktreePath || root;
    if (fs.existsSync(wtPath)) {
      runGit(["-C", mainRepoPath, "worktree", "remove", wtPath]);
    }
    runGit(["-C", mainRepoPath, "branch", "-D", featureBranch]);
    return { status: "done" };
  }

  runGit(["branch", "-D", featureBranch], { cwd: root });
  return { status: "done" };
}

/**
 * Run git commit, returning { status: "skipped" } if there is nothing to commit.
 * Throws on real errors.
 * @param {string[]} args - git commit arguments (e.g. ["-m", "message"])
 * @param {{ cwd: string }} opts - runCmd options
 * @returns {{ status: string, message?: string }}
 */
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

export const STEP_MAP = {
  1: "commit",
  2: "merge",
  3: "sync",
  4: "cleanup",
};

/**
 * Run a finalize sub-step, applying registry hooks (post, onError).
 * On success: calls post hook if defined, returns result.
 * On error: calls onError hook if defined, returns { status: "failed", message }.
 * @param {string} name - sub-step name (commit, merge, sync, cleanup)
 * @param {Function} fn - step logic returning result
 * @param {Object} ctx - command context
 * @returns {Promise<Object>} step result
 */
async function runSubStep(name, fn, ctx) {
  const stepDef = FLOW_COMMANDS.run.finalize.steps?.[name];
  try {
    const result = await fn();
    if (stepDef?.post) {
      try { await stepDef.post(ctx, result); } catch (_) { /* post hook errors are non-fatal */ }
    }
    return result;
  } catch (err) {
    if (stepDef?.onError) stepDef.onError(ctx, err);
    return { status: "failed", message: String(err.stderr || err.message || err) };
  }
}

/**
 * Post-commit hook implementation: run retro, generate report, commit artifacts.
 * Called by registry's commit.post hook via lazy import.
 * @param {Object} ctx - command context (must have ctx._results)
 */
export async function executeCommitPost(ctx) {
  const { root } = ctx;
  const state = ctx.flowState;
  const results = ctx._results;

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

  // post report to issue (if issue-driven flow + gh available)
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

  // commit retro + report files — scope stage to the current spec directory
  // so that uncommitted changes outside the spec dir are not swept into this
  // post-commit (issue #197).
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

/**
 * Run a one-shot migration script bundled under the CURRENT spec's directory, if present.
 *
 * One-time execution guarantee comes from three layers:
 *   1. SDD lifecycle — `flow finalize` runs exactly once per spec.
 *   2. Scope — the hook looks up `<currentSpecDir>/scripts/finalize-migration.js`,
 *      so it only fires for specs that explicitly ship such a script.
 *   3. Idempotency — individual scripts are expected to be idempotent as a defence
 *      against accidental re-invocation.
 *
 * The script is executed with `node` before `git add -A`, so any file changes
 * it produces are included in the finalize commit.
 *
 * @param {string} root - worktree / repo root
 * @param {string} specRelPath - flowState.spec (e.g. "specs/182-.../spec.json")
 */
function runMigrationHook(root, specRelPath) {
  if (!specRelPath) return;
  const specDir = path.dirname(specRelPath);
  const scriptPath = path.join(root, specDir, "scripts", "finalize-migration.js");
  if (!fs.existsSync(scriptPath)) return;
  const res = runCmd("node", [scriptPath], { cwd: root });
  assertOk(res, `finalize migration script failed: ${scriptPath}`);
}

export class RunFinalizeCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const mode = ctx.mode;
    const steps = ctx.steps || "";
    const dryRun = ctx.dryRun || false;
    const message = ctx.message || "";

    if (!mode || !["all", "select"].includes(mode)) {
      throw new Error("--mode must be 'all' or 'select'");
    }

    const mergeStrategyInput = ctx.mergeStrategy || "";
    if (mergeStrategyInput && !VALID_MERGE_STRATEGIES.includes(mergeStrategyInput)) {
      throw new Error(`invalid merge strategy: ${mergeStrategyInput} (valid: ${VALID_MERGE_STRATEGIES.join(", ")})`);
    }

    // Determine which steps to execute
    let activeSteps;
    if (mode === "all") {
      activeSteps = new Set(Object.keys(STEP_MAP).map(Number));
    } else {
      if (!steps) {
        throw new Error("--steps required when mode is 'select'");
      }
      activeSteps = new Set(steps.split(",").map(Number).filter((n) => STEP_MAP[n]));
      if (activeSteps.size === 0) {
        throw new Error(`no valid steps. valid: ${Object.keys(STEP_MAP).join(",")}`);
      }
    }

    const state = ctx.flowState;

    if (!dryRun) {
      await runFinalizePreflight(root);
    }

    // Resolve merge strategy: explicit > auto
    const mergeStrategy = mergeStrategyInput || "auto";

    // Resolve paths once
    const { worktreePath, mainRepoPath } = ctx.flowManager.resolveWorktreePaths(state);
    const results = {};

    // Share results with post hooks via ctx
    ctx._results = results;

    // -- Step 1: commit (+retro +report as post hook) --
    if (activeSteps.has(1)) {
      if (dryRun) {
        results.commit = { status: "dry-run", message: message || "(auto)" };
      } else {
        results.commit = await runSubStep("commit", () => {
          runMigrationHook(root, state.spec);
          const specId = specIdFromPath(state.spec);
          ctx.flowManager.saveFinalizedAt(specId, new Date().toISOString());
          runGit(["add", "-A"], { cwd: root });
          const msg = message || `feat: ${state.featureBranch || "finalize"}`;
          const res = commitOrSkip(["-m", msg], { cwd: root });
          return { ...res, message: msg };
        }, ctx);
      }
    }

    // -- Step 2: merge --
    if (activeSteps.has(2)) {
      if (dryRun) {
        results.merge = { status: "dry-run", strategy: mergeStrategy };
      } else {
        results.merge = await runSubStep("merge", async () => {
          const { runMerge } = await import("../commands/merge.js");
          const mergeResult = runMerge({
            root,
            flowState: state,
            worktreePath,
            mainRepoPath,
            mergeStrategy,
          });
          return { status: "done", strategy: mergeResult?.strategy || "squash" };
        }, ctx);
      }
    }

    // -- Merge failure guard: skip subsequent steps --
    if (results.merge?.status === "failed") {
      if (activeSteps.has(3)) results.sync = { status: "skipped", message: "skipped due to merge failure" };
      if (activeSteps.has(4)) results.cleanup = { status: "skipped", message: "skipped due to merge failure" };

      return {
        result: "merge_failed",
        steps: results,
        message: results.merge.message,
        artifacts: { baseBranch: state.baseBranch, featureBranch: state.featureBranch, worktree: !!state.worktree, spec: state.spec },
      };
    }

    // -- Step 3: sync (docs generation -- runs on main repo after merge) --
    if (activeSteps.has(3)) {
      const wasPr = results.merge?.strategy === "pr" || mergeStrategy === "pr";
      if (wasPr) {
        results.sync = { status: "skipped", message: "PR route: run sdd-forge build after PR merge" };
      } else if (dryRun) {
        results.sync = { status: "dry-run" };
      } else {
        results.sync = await runSubStep("sync", async () => {
          const syncCwd = (state.worktree && mainRepoPath) ? mainRepoPath : root;
          const buildScript = path.join(PKG_DIR, "docs.js");
          const buildRes = runCmd("node", [buildScript, "build"], { cwd: syncCwd });
          if (!buildRes.ok) {
            assertOk(buildRes, "docs build failed");
          }
          runGit(["add", "docs/", "AGENTS.md", "CLAUDE.md", "README.md", ".sdd-forge/output/analysis.json"], { cwd: syncCwd });
          let diffStat = null;
          let diffSummary = null;
          const statRes = runGit(["diff", "--cached", "--stat"], { cwd: syncCwd });
          if (statRes.ok) diffStat = statRes.stdout.trim();
          const nameRes = runGit(["diff", "--cached", "--name-only"], { cwd: syncCwd });
          if (nameRes.ok) diffSummary = nameRes.stdout.trim();
          const commitRes = commitOrSkip(["-m", "docs: sync documentation"], { cwd: syncCwd });
          return { ...commitRes, ...(diffStat && { diffStat }), ...(diffSummary && { diffSummary }) };
        }, ctx);
      }
    }

    // -- Step 4: cleanup --
    if (activeSteps.has(4)) {
      if (dryRun) {
        results.cleanup = { status: "dry-run" };
      } else {
        results.cleanup = await runSubStep("cleanup", () => {
          return executeCleanupImpl({ root, flowState: state, flowManager: ctx.flowManager, worktreePath, mainRepoPath });
        }, ctx);
      }
    }

    // Mark missing steps as skipped
    for (const name of Object.values(STEP_MAP)) {
      if (!results[name]) results[name] = { status: "skipped" };
    }

    return {
      result: dryRun ? "dry-run" : "ok",
      steps: results,
      artifacts: {
        baseBranch: state.baseBranch || null,
        featureBranch: state.featureBranch || null,
        worktree: state.worktree || false,
        spec: state.spec || null,
      },
    };
  }
}

export default RunFinalizeCommand;
