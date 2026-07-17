import { FlowCommand } from "./base-command.js";
import { container } from "../../lib/container.js";

/**
 * Spec 251 R19: the self-contained finalize step transitions and the
 * cleanup-side commit transaction target the squash-merge route only
 * (`commands.gh != enable` OR `gh` unavailable). The PR route returns
 * after PR creation and leaves the post-merge sub-steps (finalize-sync /
 * finalize-cleanup) for an out-of-process flow once the PR lands. The
 * registry post hook normalizes finalize-merge to 'done' for both routes
 * but does not advance further when the result indicates a PR was opened.
 */
export class RunFinalizeMergeCommand extends FlowCommand {
  async execute(ctx) {
    const state = ctx.flowState;
    const { root } = ctx;
    const { worktreePath, mainRepoPath } = ctx.flowManager.resolveWorktreePaths(state);

    const { runMerge, resolveMergeStrategy } = await import("../commands/merge.js");
    const cfg = container.get("config");
    const strategy = resolveMergeStrategy(state, cfg);

    if (strategy === "skip") {
      return { status: "skipped", strategy: "skip", mergedFromSha: null };
    }

    const mergeResult = runMerge({
      root,
      flowState: state,
      worktreePath,
      mainRepoPath,
      idempotencyKey: ctx.flowOutboxEntry?.idempotencyKey || null,
    });
    return {
      status: "done",
      strategy: mergeResult?.strategy || "squash",
      mergedFromSha: mergeResult?.mergedFromSha ?? null,
      ...(mergeResult?.resumed ? { resumed: true } : {}),
    };
  }
}

export default RunFinalizeMergeCommand;
