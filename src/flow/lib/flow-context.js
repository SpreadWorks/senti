/**
 * src/flow/lib/flow-context.js
 *
 * Pure function that assembles flow-specific context fields from the shared
 * dependency container. Replaces the former resolveCtx() in src/flow.js.
 *
 * Authority resolution (spec 251):
 *   The cwd-side flow.json holds metadata (worktree/spec/featureBranch) which
 *   stays valid across the merge boundary. After finalize-merge has run, the
 *   main repo also gains its own `specs/<id>/flow.json` (squash-merged from
 *   the worktree). From that point on, post hooks and reads must operate on
 *   the main repo's flow.json — not the worktree's stale copy. We pick the
 *   authority by checking for the main repo flow.json on disk: a non-circular
 *   signal that does not depend on the cwd-side state itself.
 */

import fs from "fs";
import path from "path";
import { specIdFromPath, STATE_FILE } from "../../lib/flow-helpers.js";

function resolveAuthorityFlowState(container, baseFlowManager, mainRoot) {
  const cwdState = baseFlowManager.load();
  if (!cwdState) {
    return { flowManager: baseFlowManager, flowState: null, authorityRoot: null };
  }

  const inWorktree = container.get("inWorktree");
  const paths = container.get("paths");

  if (inWorktree && cwdState.worktree && mainRoot) {
    const specId = specIdFromPath(cwdState.spec);
    if (specId) {
      const mainFlowPath = path.join(mainRoot, "specs", specId, STATE_FILE);
      if (fs.existsSync(mainFlowPath)) {
        const mainFm = baseFlowManager.forRoot(mainRoot, { specId });
        const mainState = mainFm.load(specId);
        if (mainState) {
          return { flowManager: mainFm, flowState: mainState, authorityRoot: mainRoot };
        }
      }
    }
  }
  return { flowManager: baseFlowManager, flowState: cwdState, authorityRoot: paths.root };
}

export function resolveFlowContext(container) {
  const paths = container.get("paths");
  const baseFlowManager = container.get("flowManager");
  const mainRoot = container.get("mainRoot");
  const { flowManager, flowState, authorityRoot } = resolveAuthorityFlowState(container, baseFlowManager, mainRoot);
  return {
    root: paths.root,
    mainRoot,
    config: container.get("config"),
    flowManager,
    flowState,
    specId: flowState ? specIdFromPath(flowState.spec) : null,
    inWorktree: container.get("inWorktree"),
    authorityRoot,
  };
}
