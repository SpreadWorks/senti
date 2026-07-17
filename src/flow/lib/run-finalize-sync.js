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
  async execute(ctx) {
    const state = ctx.flowState;
    const { root } = ctx;
    const { mainRepoPath } = ctx.flowManager.resolveWorktreePaths(state);

    const syncCwd = (state.worktree && mainRepoPath) ? mainRepoPath : root;
    const idempotencyKey = ctx.flowOutboxEntry?.idempotencyKey || null;
    if (hasOutboxCommit({ root: syncCwd, ref: "HEAD", idempotencyKey })) {
      return { status: "done", resumed: true };
    }
    const buildScript = path.join(PKG_DIR, "docs.js");
    const buildRes = runCmd("node", [buildScript, "build"], { cwd: syncCwd });
    if (!buildRes.ok) {
      assertOk(buildRes, "docs build failed");
    }
    runGit(["add", "docs/", "AGENTS.md", "CLAUDE.md", "README.md", ".senti/output/analysis.json"], { cwd: syncCwd });
    let diffStat = null;
    let diffSummary = null;
    const statRes = runGit(["diff", "--cached", "--stat"], { cwd: syncCwd });
    if (statRes.ok) diffStat = statRes.stdout.trim();
    const nameRes = runGit(["diff", "--cached", "--name-only"], { cwd: syncCwd });
    if (nameRes.ok) diffSummary = nameRes.stdout.trim();
    const markerArgs = idempotencyKey ? ["-m", outboxCommitMarker(idempotencyKey)] : [];
    const commitRes = commitOrSkip(["-m", "docs: sync documentation", ...markerArgs], { cwd: syncCwd });
    return { ...commitRes, ...(diffStat && { diffStat }), ...(diffSummary && { diffSummary }) };
  }
}

export default RunFinalizeSyncCommand;
