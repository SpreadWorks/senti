# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/291-submodule-worktree-cleanup/test-coverage.json`

## Blocking Findings

### 1. Submodule status failure path is not independently covered
**Target:** specs/291-submodule-worktree-cleanup/tests/cleanup-submodule-contract.test.js::R7/R9 status_fail scenarios
**Issue:** The only status-failure scenarios make the root `git status --porcelain` fail before an implementation needs to inspect initialized submodules. An implementation that correctly halts on root status failure but mishandles submodule status failures can still pass these tests.
**Required change:** Add a submodule-only status failure scenario where root status succeeds, initialized submodule discovery succeeds, and submodule cleanliness inspection fails; assert `SUBMODULE_WORKTREE_STATUS_FAILED`, preserved worktree/branch, bounded diagnostics, and retained submodule git error output.
**Why blocking:** R7 and R9 require correct behavior when cleanliness cannot be confirmed for initialized submodules, but the current executable coverage does not force that case.

### 2. Force failure does not assert teardown validation is skipped
**Target:** specs/291-submodule-worktree-cleanup/tests/cleanup-submodule-contract.test.js::R8
**Issue:** The force-remove failure test asserts branch deletion is skipped, but it does not assert the teardown validation path is skipped after `git worktree remove --force` fails.
**Required change:** Extend the R8 force-failure test to assert validateTeardown commands such as `git worktree list --porcelain` and `git branch --list feature/submodule-cleanup` are not run after the failed force retry.
**Why blocking:** R3 says the existing branch-delete and teardown-validation path may continue only if the force retry succeeds; the current tests leave the validation half of that requirement uncovered on failure.

### 3. Submodule dirty fixture over-constrains the inspection mechanism
**Target:** specs/291-submodule-worktree-cleanup/tests/cleanup-submodule-contract.test.js::writeFakeGit dirty_submodule handling
**Issue:** The fake git only reports dirty submodule contents when the implementation uses `git submodule foreach` containing `status --porcelain`. A valid implementation that discovers initialized submodules with `git submodule status` and then runs `git -C <worktree>/vendor/sub status --porcelain` would be reported clean by the fixture and fail R4 despite satisfying the requirement.
**Required change:** Teach the fake git status handler to emit the dirty/status-failure submodule outputs when `cTarget` points at the initialized submodule path as well as when `submodule foreach` is used.
**Why blocking:** The tests encode an implementation premise that is stricter than the requirement, so they can reject a valid production implementation before behavior is evaluated.


## Advisory Findings

No advisory findings.