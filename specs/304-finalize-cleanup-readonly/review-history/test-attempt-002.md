# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/304-finalize-cleanup-readonly/test-coverage.json`

## Blocking Findings

### 1. Read-only cleanup coverage only exercises path helper APIs
**Target:** specs/304-finalize-cleanup-readonly/tests/finalize-cleanup-readonly.test.js
**Issue:** R1, R2, R6, and the cleanup-time metrics portion of R4 are marked covered, but the tests only call FinalizeCleanupPathResolver methods directly. They do not exercise finalize-cleanup production write paths for flow state, metrics append, notes, issue-log, runtime-derived data, plugin artifacts, dispatcher runtimeLog completion, or agent metric writes. A production implementation could still mutate files under the target worktree during finalize-cleanup while these tests pass.
**Required change:** Add spec-local regression coverage that invokes the relevant finalize-cleanup cleanup-time write behavior or its production write owners with a target worktree and asserts those writes either go through the main repo FlowManager/FlowStore before the final flow.json commit or durable non-worktree sidecar storage, with no created or modified paths under the resolved target worktree.
**Why blocking:** The acceptance requirement is about finalize-cleanup behavior after resolving the target worktree, not just resolver return values. Current tests have a static anti-pattern: they can pass without exercising the production behavior that must be protected.

### 2. Dirty submodule force-removal scenario is not covered
**Target:** specs/304-finalize-cleanup-readonly/tests/finalize-cleanup-readonly.test.js
**Issue:** R3 requires finalize-cleanup --force to remove worktrees with dirty root files and initialized submodule dirty state caused by external factors. The current test only passes force: true to removeWorktreeForCleanup and asserts --force appears in the git worktree remove command; it does not cover initialized submodule dirty state or a dirty-root failure mode that force must overcome.
**Required change:** Add a spec-local test case or parameterized scenario representing dirty root files and initialized dirty submodule state, verifying the force cleanup path still calls git worktree remove with force semantics and treats that removal as successful.
**Why blocking:** R3 explicitly includes initialized submodule dirty state. Without coverage, an implementation can satisfy the simple flag assertion while failing the required dirty-submodule cleanup case.


## Advisory Findings

No advisory findings.