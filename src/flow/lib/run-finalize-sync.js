import path from "path";
import fs from "fs";
import { runCmd } from "../../lib/process.js";
import { PKG_DIR } from "../../lib/cli.js";
import { runGit } from "../../lib/git-helpers.js";
import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";
import { FlowCommand } from "./base-command.js";
import {
  hasOutboxCommit,
  outboxCommitMarker,
} from "./run-finalize.js";
import {
  FinalizeSyncDiagnostic,
  FinalizeSyncExecutionError,
} from "./finalize-sync-diagnostics.js";

function commitOutcome(result) {
  if (result.ok) return { status: "done" };
  const output = result.stderr || result.stdout || "";
  if (/nothing to commit|no changes added to commit/i.test(output)) {
    return { status: "skipped", message: "nothing to commit" };
  }
  return null;
}

function pathsToStage(root, candidates, trackedOutput) {
  const existing = candidates.filter((candidate) => fs.existsSync(path.join(root, candidate)));
  const tracked = String(trackedOutput || "").split("\n").filter(Boolean);
  return [...new Set([
    ...existing,
    ...tracked.filter((candidate) => !existing.some((existingPath) => (
      candidate === existingPath || candidate.startsWith(`${existingPath}/`)
    ))),
  ])];
}

export class RunFinalizeSyncCommand extends FlowCommand {
  constructor({
    runCommand = runCmd,
    git = runGit,
    hasCommit = hasOutboxCommit,
    packageDir = PKG_DIR,
  } = {}) {
    super();
    this.runCommand = runCommand;
    this.git = git;
    this.hasCommit = hasCommit;
    this.packageDir = packageDir;
  }

  async execute(ctx) {
    const state = ctx.flowState;
    const { root } = ctx;
    const { mainRepoPath } = ctx.flowManager.resolveWorktreePaths(state);

    const syncCwd = (state.worktree && mainRepoPath) ? mainRepoPath : root;
    const operation = new RepositoryFlowOperationLock({ mainRoot: syncCwd });
    const token = operation.acquire();
    try {
      const diagnostics = [];
      const idempotencyKey = ctx.flowOutboxEntry?.idempotencyKey || null;
      if (this.hasCommit({ root: syncCwd, ref: "HEAD", idempotencyKey })) {
        return { status: "done", resumed: true };
      }
      const run = (phase, command) => {
        const result = command();
        diagnostics.push(new FinalizeSyncDiagnostic({ phase, result }));
        if (!result.ok) {
          throw new FinalizeSyncExecutionError({ phase, diagnostics });
        }
        return result;
      };
      const buildScript = path.join(this.packageDir, "docs.js");
      run("docs-build", () => this.runCommand("node", [buildScript, "build"], { cwd: syncCwd }));
      const stageCandidates = ["docs/", "AGENTS.md", "CLAUDE.md", "README.md", ".senti/output/analysis.json"];
      const trackedRes = run("git-ls-files", () => this.git(["ls-files", "--", ...stageCandidates], { cwd: syncCwd }));
      const stagePaths = pathsToStage(syncCwd, stageCandidates, trackedRes.stdout);
      if (stagePaths.length > 0) {
        run("git-add", () => this.git(["add", "--", ...stagePaths], { cwd: syncCwd }));
      }
      const statRes = run("git-diff-stat", () => this.git(["diff", "--cached", "--stat"], { cwd: syncCwd }));
      const nameRes = run("git-diff-name", () => this.git(["diff", "--cached", "--name-only"], { cwd: syncCwd }));
      const markerArgs = idempotencyKey ? ["-m", outboxCommitMarker(idempotencyKey)] : [];
      const commitRes = this.git(["commit", "-m", "docs: sync documentation", ...markerArgs], { cwd: syncCwd });
      diagnostics.push(new FinalizeSyncDiagnostic({ phase: "git-commit", result: commitRes }));
      const outcome = commitOutcome(commitRes);
      if (!outcome) throw new FinalizeSyncExecutionError({ phase: "git-commit", diagnostics });
      return {
        ...outcome,
        ...(statRes.stdout.trim() && { diffStat: statRes.stdout.trim() }),
        ...(nameRes.stdout.trim() && { diffSummary: nameRes.stdout.trim() }),
        diagnostics: diagnostics.map((entry) => entry.toJSON()),
      };
    } catch (error) {
      if (error instanceof FinalizeSyncExecutionError) {
        const status = this.git(["status", "--porcelain=v1", "--untracked-files=all"], { cwd: syncCwd });
        error.data.diagnostics.push(new FinalizeSyncDiagnostic({ phase: "git-status-after-failure", result: status }).toJSON());
      }
      throw error;
    } finally {
      operation.release();
    }
  }
}

export default RunFinalizeSyncCommand;
