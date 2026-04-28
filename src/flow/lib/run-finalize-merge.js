import { FlowCommand } from "./base-command.js";
import { container } from "../../lib/container.js";

export class RunFinalizeMergeCommand extends FlowCommand {
  async execute(ctx) {
    const state = ctx.flowState;
    const { root } = ctx;
    const { worktreePath, mainRepoPath } = ctx.flowManager.resolveWorktreePaths(state);

    const { runMerge, resolveMergeStrategy } = await import("../commands/merge.js");
    const cfg = container.get("config");
    const strategy = resolveMergeStrategy(state, cfg);

    if (strategy === "skip") {
      return { status: "skipped", strategy: "skip" };
    }

    const mergeResult = runMerge({
      root,
      flowState: state,
      worktreePath,
      mainRepoPath,
    });
    return { status: "done", strategy: mergeResult?.strategy || "squash" };
  }
}

export default RunFinalizeMergeCommand;
