import path from "path";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { runGit } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";
import {
  runFinalizePreflight,
  runPreflightChecks,
  commitOrSkip,
  runMigrationHook,
} from "./run-finalize.js";
import { DURABLE_TEST_ARTIFACT_RELATIVE_PATHS, TEMP_SUMMARY_RELATIVE } from "./test-artifacts.js";

/**
 * spec 251: paths under specs/<spec>/ that hold test/retro/report artifacts
 * produced by impl-phase mainline steps, including tests/.raw/test-execution.log.
 * They are committed in a separate
 * "chore: add test artifacts" commit so the implementation commit stays
 * focused on production code + spec definition.
 */
const TEMPORARY_TEST_ARTIFACT_RELATIVE_PATHS = [
  TEMP_SUMMARY_RELATIVE,
];

function specArtifactPathspecs(specId) {
  const base = path.posix.join("specs", specId);
  return DURABLE_TEST_ARTIFACT_RELATIVE_PATHS.map((p) => path.posix.join(base, p));
}

export class RunFinalizeCommitCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const state = ctx.flowState;
    const message = ctx.message || "";

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

    // spec 251: stage everything EXCEPT test artifacts under the spec dir; the
    // executeCommitPost hook follows up with a separate commit for those.
    runGit(["add", "-A"], { cwd: root });
    const excludePathspecs = [
      ...specArtifactPathspecs(specId),
      ...TEMPORARY_TEST_ARTIFACT_RELATIVE_PATHS.map((p) => path.posix.join("specs", specId, p)),
    ];
    const resetArgs = ["reset", "HEAD", "--", ...excludePathspecs];
    runGit(resetArgs, { cwd: root });

    const msg = message || `feat: ${state.featureBranch || "finalize"}`;
    const res = commitOrSkip(["-m", msg], { cwd: root });
    return { ...res, message: msg };
  }
}

export default RunFinalizeCommitCommand;
