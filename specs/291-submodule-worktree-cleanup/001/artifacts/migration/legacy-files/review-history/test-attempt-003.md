# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/291-submodule-worktree-cleanup/test-coverage.json`

## Blocking Findings

### 1. Successful cleanup side effects are not fully covered
**Target:** specs/291-submodule-worktree-cleanup/tests/cleanup-submodule-contract.test.js test "R6: successful cleanup preserves side effects and teardown validation ordering"
**Issue:** R6 requires preserving report attachment, the last-finalized pointer, active-flow clearing, branch deletion, and validateTeardown execution. The test only checks git add/commit, branch deletion, and validation-related git commands; it never inspects the resulting flow/report metadata, `.senti/last-finalized`, or `.senti/active-flow`.
**Required change:** Extend the successful cleanup scenario to return or inspect the main repo files before cleanup, and assert the report attachment, last-finalized pointer, and active-flow removal in addition to the existing command-order checks.
**Why blocking:** The coverage artifact marks R6 covered, but several required side effects could regress without this test failing.

### 2. Submodule cleanliness inspection can pass without checking submodule status
**Target:** specs/291-submodule-worktree-cleanup/tests/cleanup-submodule-contract.test.js tests "R2: submodule cleanup inspects root and submodule cleanliness" and "R4: dirty root or submodule returns SUBMODULE_WORKTREE_DIRTY and preserves resources"
**Issue:** The fake git returns dirty submodule output for any `submodule foreach` invocation, and the R2 regex accepts `submodule foreach` by itself. An implementation could run a foreach command that does not execute `git status --porcelain` inside initialized submodules and still satisfy these tests.
**Required change:** Make the fake git behavior and assertions require the submodule cleanliness command to include an actual status inspection, such as `submodule foreach ... status --porcelain`, before dirty submodule output is produced or accepted.
**Why blocking:** R2 specifically requires inspecting dirty state for initialized submodules before deciding whether to force-remove; the current test can pass without exercising that production behavior.

### 3. Recovery guidance is not asserted for cleanup failures
**Target:** specs/291-submodule-worktree-cleanup/tests/cleanup-submodule-contract.test.js tests for R4, R5, and R7
**Issue:** R4 requires recovery guidance for dirty root/submodule failures, R5 requires retaining existing WORKTREE_REMOVE_FAILED guidance, and R7 requires recovery guidance when status cannot be confirmed. The tests assert error codes and resource preservation but do not assert that guidance is present or meaningful.
**Required change:** Add minimal assertions on the returned error/message/data for `SUBMODULE_WORKTREE_DIRTY`, `WORKTREE_REMOVE_FAILED`, and `SUBMODULE_WORKTREE_STATUS_FAILED` confirming recovery guidance is included.
**Why blocking:** User-facing recovery guidance is an explicit acceptance requirement, and these regressions would currently pass unnoticed.

### 4. Bounded diagnostics are not actually exercised
**Target:** specs/291-submodule-worktree-cleanup/tests/cleanup-submodule-contract.test.js test "R9: submodule halt diagnostics are bounded and carry git error output"
**Issue:** R9 requires diagnostics for dirty, status-failed, and force-remove-failed paths to be bounded and to preserve git errors. The test uses only short outputs and asserts `truncated === false`; it does not create oversized dirty/status/force diagnostics or verify truncation/count limits. It also omits the dirty diagnostics path entirely.
**Required change:** Add oversized-output scenarios for dirty, status-failed, and force-remove-failed cleanup paths, then assert diagnostic lists/text are capped, truncation is reported, and representative git error output is preserved.
**Why blocking:** The requirement coverage artifact claims R9 is covered, but the current test would pass with unbounded diagnostics and does not cover dirty diagnostic bounding.


## Advisory Findings

No advisory findings.