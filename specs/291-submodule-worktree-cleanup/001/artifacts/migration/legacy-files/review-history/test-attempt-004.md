# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/291-submodule-worktree-cleanup/test-coverage.json`

## Blocking Findings

### 1. Force retry count is not covered
**Target:** specs/291-submodule-worktree-cleanup/tests/cleanup-submodule-contract.test.js R3/R8
**Issue:** The tests only assert that `git worktree remove --force <path>` appears and is ordered before or instead of branch deletion. They would still pass if finalize-cleanup retried force removal multiple times.
**Required change:** Assert that the logged `worktree remove --force` command count is exactly 1 in the clean retry path and the force-failure path.
**Why blocking:** R3 requires the force retry to happen once, so the coverage artifact marks a must requirement as covered without testing the required cardinality.

### 2. Dirty submodule diagnostic bounding is not covered
**Target:** specs/291-submodule-worktree-cleanup/tests/cleanup-submodule-contract.test.js R9
**Issue:** The `dirty_many` case asserts root dirty files are capped, but it does not assert that `dirtySubmodules` or the overall dirty diagnostic payload is bounded. An implementation could cap root files while returning all submodule dirty paths and still pass.
**Required change:** Add an assertion that dirty submodule diagnostics are capped, or assert a bounded total serialized dirty diagnostic size for the `dirty_many` result.
**Why blocking:** R4 and R9 require bounded dirty path details for root and initialized submodules, but submodule dirty bounding has no executable coverage.

### 3. Worktree-root status target is not verified
**Target:** specs/291-submodule-worktree-cleanup/tests/cleanup-submodule-contract.test.js R2
**Issue:** The fake git returns scenario-driven status output regardless of the command cwd or `-C` target, and the tests only look for `status --porcelain` text. A cleanup implementation could inspect the main repository instead of the worktree root and still satisfy these assertions.
**Required change:** Record the fake git process cwd or `-C` target and assert that root cleanliness inspection is executed against `worktreeRoot`; similarly ensure submodule cleanliness inspection is scoped under the worktree's initialized submodules.
**Why blocking:** R2 specifically requires inspecting dirty state for the worktree root and initialized submodules before force-removal decisions, but the current tests do not prove the inspected location is correct.


## Advisory Findings

No advisory findings.