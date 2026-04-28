import fs from "fs";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { runGit } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import { writeLastFinalizedPointer, REPORT_SHOW_COMMAND } from "./run-finalize.js";

export class RunFinalizeCleanupCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const state = ctx.flowState;
    const { worktreePath, mainRepoPath } = ctx.flowManager.resolveWorktreePaths(state);
    const { baseBranch, featureBranch, worktree } = state;
    const specId = specIdFromPath(state.spec);

    writeLastFinalizedPointer(mainRepoPath || root, state.spec);

    if (featureBranch === baseBranch) {
      ctx.flowManager.clearFlowState(specId);
      return { status: "done", message: "spec-only mode", nextCommand: REPORT_SHOW_COMMAND };
    }

    ctx.flowManager.clearFlowState(specId);

    if (worktree && mainRepoPath) {
      const wtPath = worktreePath || root;
      if (fs.existsSync(wtPath)) {
        runGit(["-C", mainRepoPath, "worktree", "remove", wtPath]);
      }
      runGit(["-C", mainRepoPath, "branch", "-D", featureBranch]);
      return { status: "done", nextCommand: REPORT_SHOW_COMMAND };
    }

    runGit(["branch", "-D", featureBranch], { cwd: root });
    return { status: "done", nextCommand: REPORT_SHOW_COMMAND };
  }
}

export default RunFinalizeCleanupCommand;
