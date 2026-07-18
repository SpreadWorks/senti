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
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { flowStatePath } from "../../lib/flow-state-atomic-writer.js";
import { FlowTargetExpectation } from "../../lib/flow-target-guard.js";
import { WorktreeFlowProvenance } from "../../lib/worktree-flow-binding.js";

const MISSING_PREPARING_FLOW_STATE = Object.freeze({});

function resolveTargetSelection(input = {}) {
  const selectRunId = input.expectRunId ?? input.expectRunID ?? null;
  const specToken = input.expectSpec ?? null;
  const selectSpecId = specToken ? specIdFromPath(specToken) : null;
  const selectIssue = input.expectIssue ?? null;
  const selectNoIssue = input.expectNoIssue === true;
  if (selectRunId == null && selectSpecId == null && selectIssue == null && !selectNoIssue) return null;
  return { selectRunId, selectSpecId, selectIssue, selectNoIssue };
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
  const authorityRoot = mainRoot || paths.root;
  const flowManager = typeof baseFlowManager.forRoot === "function"
    ? baseFlowManager.forRoot(authorityRoot)
    : baseFlowManager;
  return {
    flowManager,
    flowState: null,
    preparingFlowState: state || MISSING_PREPARING_FLOW_STATE,
    authorityRoot,
    flowResolutionError: null,
  };
}

function boundWorktreeAuthority(container, baseFlowManager, mainRoot, paths, options) {
  if (!container.get("inWorktree")) return null;
  if (baseFlowManager.usesWorktreeFlowBinding() === false) return null;
  let identity;
  try {
    identity = baseFlowManager.resolveWorktreeBinding(new FlowTargetExpectation(options.input));
  } catch (error) {
    return {
      flowManager: baseFlowManager,
      flowState: null,
      preparingFlowState: null,
      authorityRoot: null,
      flowResolutionError: error,
    };
  }
  const flowState = baseFlowManager.load(identity.specId);
  if (mainRoot) {
    const mainFlowPath = flowStatePath(mainRoot, identity.specId);
    if (fs.existsSync(mainFlowPath)) {
      const mainManager = baseFlowManager.forRoot(mainRoot, { specId: identity.specId });
      const mainState = mainManager.load(identity.specId);
      identity.assertFlowState(mainState);
      return {
        flowManager: mainManager,
        flowState: mainState,
        preparingFlowState: null,
        authorityRoot: mainRoot,
        flowResolutionError: null,
        worktreeFlowProvenance: new WorktreeFlowProvenance(identity, mainRoot),
      };
    }
  }
  return {
    flowManager: baseFlowManager,
    flowState,
    preparingFlowState: null,
    authorityRoot: paths.root,
    flowResolutionError: null,
    worktreeFlowProvenance: new WorktreeFlowProvenance(identity, paths.root),
  };
}

function resolveAuthorityFlowState(container, baseFlowManager, mainRoot, options = {}) {
  const paths = container.get("paths");
  const worktreeAuthority = boundWorktreeAuthority(
    container,
    baseFlowManager,
    mainRoot,
    paths,
    options,
  );
  if (worktreeAuthority) return worktreeAuthority;
  const preparingAuthority = options.preparingRunIdSelection === false
    ? null
    : preparingAuthorityForRunId(
      baseFlowManager,
      mainRoot,
      paths,
      preparingRunIdSelection(options.input),
    );
  if (preparingAuthority) return preparingAuthority;

  const selection = resolveTargetSelection(options.input);
  if (options.explicitTargetResolution === true && selection) {
    let target;
    try {
      const resolver = options.mismatchTargetResolution === true
        ? baseFlowManager.resolveExplicitFlowTargetForRead.bind(baseFlowManager)
        : baseFlowManager.resolveExplicitFlowTarget.bind(baseFlowManager);
      target = resolver(new FlowTargetExpectation(options.input));
    } catch (error) {
      if (!options.allowMissingActive) throw error;
      return {
        flowManager: baseFlowManager,
        flowState: null,
        preparingFlowState: null,
        authorityRoot: null,
        flowResolutionError: error,
      };
    }
    const flowManager = baseFlowManager.forRoot(
      target.authorityRoot,
      target.specId ? { specId: target.specId } : {},
    );
    return {
      flowManager,
      flowState: target.preparing ? null : target.state,
      preparingFlowState: target.preparing ? target.state : null,
      authorityRoot: target.authorityRoot,
      flowResolutionError: null,
    };
  }
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

  if (container.get("inWorktree") && cwdState.worktree && mainRoot) {
    const specId = specIdFromPath(cwdState.spec);
    if (specId) {
      const mainFlowPath = flowStatePath(mainRoot, specId);
      if (fs.existsSync(mainFlowPath)) {
        const mainManager = baseFlowManager.forRoot(mainRoot, { specId });
        const mainState = mainManager.load(specId);
        if (mainState) {
          return {
            flowManager: mainManager,
            flowState: mainState,
            authorityRoot: mainRoot,
            flowResolutionError: null,
          };
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
  const {
    flowManager,
    flowState,
    preparingFlowState = null,
    authorityRoot,
    flowResolutionError,
    worktreeFlowProvenance = null,
  } = resolveAuthorityFlowState(
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
    preparingFlowState,
    specId: flowState ? specIdFromPath(flowState.spec) : null,
    inWorktree: container.get("inWorktree"),
    authorityRoot,
    flowResolutionError,
    worktreeFlowProvenance,
  };
}
