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

function resolveTargetSelection(input = {}) {
  const selectRunId = input.expectRunId ?? input.expectRunID ?? null;
  const specToken = input.expectSpec ?? null;
  const selectSpecId = specToken ? specIdFromPath(specToken) : null;
  const selectIssue = input.expectIssue ?? null;
  if (selectRunId == null && selectSpecId == null && selectIssue == null) return null;
  return { selectRunId, selectSpecId, selectIssue };
}

function preparingRunIdSelection(input = {}) {
  const runId = input.runId ?? null;
  if (typeof runId !== "string") return null;
  const trimmed = runId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function preparingAuthorityForRunId(baseFlowManager, mainRoot, paths, runId) {
  if (!runId || typeof baseFlowManager.loadPreparingFlow !== "function") return null;
  const state = baseFlowManager.loadPreparingFlow(runId);
  if (!state) return null;
  const authorityRoot = mainRoot || paths.root;
  const flowManager = typeof baseFlowManager.forRoot === "function"
    ? baseFlowManager.forRoot(authorityRoot)
    : baseFlowManager;
  return { flowManager, flowState: null, authorityRoot, flowResolutionError: null };
}

function resolveAuthorityFlowState(container, baseFlowManager, mainRoot, options = {}) {
  const paths = container.get("paths");
  const preparingAuthority = preparingAuthorityForRunId(
    baseFlowManager,
    mainRoot,
    paths,
    preparingRunIdSelection(options.input),
  );
  if (preparingAuthority) return preparingAuthority;

  const selection = resolveTargetSelection(options.input);
  const cwdState = baseFlowManager.load();
  if (!cwdState) {
    let resolved = null;
    try {
      resolved = typeof baseFlowManager.resolveActiveFlow === "function"
        ? baseFlowManager.resolveActiveFlow(null, selection || {})
        : null;
    } catch (err) {
      if (!options.allowMissingActive) throw err;
      return { flowManager: baseFlowManager, flowState: null, authorityRoot: null, flowResolutionError: err };
    }
    if (resolved) {
      const activeRoot = resolved.worktreePath || paths.root;
      const activeFm = resolved.worktreePath
        ? baseFlowManager.forRoot(resolved.worktreePath, { specId: resolved.specId })
        : baseFlowManager.forRoot(paths.root, { specId: resolved.specId });
      return { flowManager: activeFm, flowState: resolved.state, authorityRoot: activeRoot };
    }
    return { flowManager: baseFlowManager, flowState: null, authorityRoot: null, flowResolutionError: null };
  }

  const inWorktree = container.get("inWorktree");

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
  return { flowManager: baseFlowManager, flowState: cwdState, authorityRoot: paths.root, flowResolutionError: null };
}

export function resolveFlowContext(container, options = {}) {
  const paths = container.get("paths");
  const baseFlowManager = container.get("flowManager");
  const mainRoot = container.get("mainRoot");
  const { flowManager, flowState, authorityRoot, flowResolutionError } = resolveAuthorityFlowState(
    container,
    baseFlowManager,
    mainRoot,
    options,
  );
  return {
    root: authorityRoot || paths.root,
    mainRoot,
    config: container.get("config"),
    flowManager,
    flowState,
    specId: flowState ? specIdFromPath(flowState.spec) : null,
    inWorktree: container.get("inWorktree"),
    authorityRoot,
    flowResolutionError,
  };
}
