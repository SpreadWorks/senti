import path from "path";
import { runCmd, assertOk } from "../../lib/process.js";
import { PKG_DIR } from "../../lib/cli.js";
import { runGit } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import {
  commitOrSkip,
  hasOutboxCommit,
  outboxCommitMarker,
} from "./run-finalize.js";

export class RunFinalizeSyncCommand extends FlowCommand {
  constructor({
    runCommand = runCmd,
    git = runGit,
    commit = commitOrSkip,
    hasCommit = hasOutboxCommit,
    packageDir = PKG_DIR,
  } = {}) {
    super();
    this.runCommand = runCommand;
    this.git = git;
    this.commit = commit;
    this.hasCommit = hasCommit;
    this.packageDir = packageDir;
  }

  async execute(ctx) {
    const state = ctx.flowState;
    const { root } = ctx;
    const { mainRepoPath } = ctx.flowManager.resolveWorktreePaths(state);

    const syncCwd = (state.worktree && mainRepoPath) ? mainRepoPath : root;
    const idempotencyKey = ctx.flowOutboxEntry?.idempotencyKey || null;
    if (this.hasCommit({ root: syncCwd, ref: "HEAD", idempotencyKey })) {
      return { status: "done", resumed: true };
    }
    const buildScript = path.join(this.packageDir, "docs.js");
    const buildRes = this.runCommand("node", [buildScript, "build"], { cwd: syncCwd });
    if (!buildRes.ok) {
      assertOk(buildRes, "docs build failed");
    }
    this.git(["add", "docs/", "AGENTS.md", "CLAUDE.md", "README.md", ".senti/output/analysis.json"], { cwd: syncCwd });
    let diffStat = null;
    let diffSummary = null;
    const statRes = this.git(["diff", "--cached", "--stat"], { cwd: syncCwd });
    if (statRes.ok) diffStat = statRes.stdout.trim();
    const nameRes = this.git(["diff", "--cached", "--name-only"], { cwd: syncCwd });
    if (nameRes.ok) diffSummary = nameRes.stdout.trim();
    const markerArgs = idempotencyKey ? ["-m", outboxCommitMarker(idempotencyKey)] : [];
    const commitRes = this.commit(["-m", "docs: sync documentation", ...markerArgs], { cwd: syncCwd });
    return { ...commitRes, ...(diffStat && { diffStat }), ...(diffSummary && { diffSummary }) };
  }
}

export default RunFinalizeSyncCommand;
