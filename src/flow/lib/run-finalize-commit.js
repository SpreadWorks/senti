import { specIdFromPath } from "../../lib/flow-helpers.js";
import { runGit } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import {
  runFinalizePreflight,
  runPreflightChecks,
  commitOrSkip,
  hasOutboxCommit,
  outboxCommitMarker,
  runMigrationHook,
} from "./run-finalize.js";
import { implementationCommitExcludedTestArtifactPathspecs } from "./test-artifacts.js";

export class RunFinalizeCommitCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const state = ctx.flowState;
    const message = ctx.message || "";
    const idempotencyKey = ctx.flowOutboxEntry?.idempotencyKey || null;

    if (hasOutboxCommit({ root, ref: "HEAD", idempotencyKey })) {
      return {
        status: "done",
        message: message || `feat: ${state.featureBranch || "finalize"}`,
        resumed: true,
      };
    }

    await runFinalizePreflight(root);

    const preflight = runPreflightChecks({
      root,
      baseBranch: state.baseBranch,
      featureBranch: state.featureBranch,
      commitStepActive: true,
    });
    if (!preflight.ok) {
      return {
        result: "preflight_failed",
        status: "failed",
        reason: preflight.reason,
        ...(preflight.reason === "no-commits"
          ? {
              baseBranch: preflight.baseBranch,
              featureBranch: preflight.featureBranch,
              hasUncommitted: preflight.hasUncommitted,
            }
          : { uncommittedFiles: preflight.uncommittedFiles }),
        message:
          preflight.reason === "no-commits"
            ? `no commits on ${preflight.featureBranch} beyond ${preflight.baseBranch}` +
              (preflight.hasUncommitted ? " (uncommitted changes present)" : "")
            : `uncommitted changes in worktree: ${preflight.uncommittedFiles.join(", ")}`,
      };
    }

    runMigrationHook(root, state.spec);
    const specId = specIdFromPath(state.spec);
    ctx.flowManager.saveFinalizedAt(specId, new Date().toISOString());

    // Stage everything except durable finalization artifacts. The finalize
    // lifecycle commits those separately before confirming this outbox entry.
    runGit(["add", "-A"], { cwd: root });
    const excludePathspecs = implementationCommitExcludedTestArtifactPathspecs(specId);
    const resetArgs = ["reset", "HEAD", "--", ...excludePathspecs];
    runGit(resetArgs, { cwd: root });

    const msg = message || `feat: ${state.featureBranch || "finalize"}`;
    const markerArgs = idempotencyKey ? ["-m", outboxCommitMarker(idempotencyKey)] : [];
    const res = commitOrSkip(["-m", msg, ...markerArgs], { cwd: root });
    return { ...res, message: msg };
  }
}

export default RunFinalizeCommitCommand;
