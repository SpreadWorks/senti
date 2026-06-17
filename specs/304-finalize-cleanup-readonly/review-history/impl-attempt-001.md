# Code Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Plugin cleanup hooks still write through the removable worktree
**Failure mode:** missing_acceptance_requirement
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** `runTeardown` invokes `runFlowCommandWithPluginLifecycle(ctx.root, ...)` and returns `artifactPath: specs/${specId}` after the target worktree has been resolved. In worktree mode, `ctx.root` is the worktree being removed, so plugin artifact helpers can still create or modify `specs/<spec>/plugin-artifacts/...` under the target worktree during finalize-cleanup.
**Suggestion:** Update `runTeardown` so the finalize-cleanup plugin lifecycle runs with a main-repo or durable cleanup owner when `worktree && mainRepoPath` is true, and return a durable plugin artifact path from `FinalizeCleanupPathResolver.cleanupSurfaceOwner("plugin-artifact", { specId })` or an equivalent sidecar owner instead of `specs/${specId}` rooted at `ctx.root`.
**Rationale:** R1 explicitly requires cleanup-time plugin artifact writes to avoid the target worktree. Leaving this path on `ctx.root` can dirty the worktree immediately before `git worktree remove`, recreating the failure the spec is meant to prevent.

### 2. Forced submodule cleanup can still return the non-force dirty halt
**Failure mode:** missing_acceptance_requirement
**File:** src/flow/lib/run-finalize-cleanup.js
**Issue:** `removeWorktreeForCleanup` adds `--force` to the initial removal command, but if that command returns a submodule-style remove failure, the function still inspects submodules and returns `SUBMODULE_WORKTREE_DIRTY` whenever `inspection.dirty` is true, even when `force === true`.
**Suggestion:** In `removeWorktreeForCleanup`, preserve the dirty submodule halt only for non-force cleanup. When `force === true`, continue through the force removal path for initialized dirty submodule state and only return a failure envelope if the force removal command itself fails.
**Rationale:** R3 requires `finalize-cleanup --force` to use force removal semantics for initialized submodule dirtiness caused by external factors. The current branch can still stop with the same dirty-state halt that non-force cleanup uses.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
