# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/478-fix-finalize-merge-conflict/test-coverage.json`

## Blocking Findings

### 1. R5 coverage is materially incomplete
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js R5 test
**Issue:** The R5 test only asserts that clean finalize-merge pre does not create a commit. It does not cover direct finalize/cleanup updating verification and integration through main-repository flow state after rebase, resuming an interrupted completion from its saved transaction, completing teardown journal/receipt/cleanup through main state, or avoiding imports/filesystem reads/lock validation/log access against a deleted worktree.
**Required change:** Add executable spec-local coverage for the direct finalize/cleanup and deleted-worktree behaviors required by R5, or narrow the coverage artifact so it does not claim those requirements are covered.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage, and the coverage artifact contradicts the actual test file.

### 2. R6 coverage does not exercise required CLI/E2E behavior
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js R6 test
**Issue:** The R6 test only calls the finalize-merge onError path with a synthetic Error and checks the metadata commit shape. It does not exercise actual conflict detection, clean rebase preparation, manual rebase, retry through `senti flow run finalize-merge`, one merge/outbox completion, sync, or cleanup via shared unit plus worktree CLI/E2E tests.
**Required change:** Add or reference executable shared unit and worktree CLI/E2E tests that drive the real conflict, manual rebase/retry, single merge/outbox completion, sync, and cleanup flow.
**Why blocking:** R6 explicitly requires shared unit plus worktree CLI/E2E coverage, but the provided test does not cover that behavioral surface.

### 3. R2 final snapshot assertion can pass without persisted conflict evidence
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js R2 test
**Issue:** The final assertion uses `mainSnapshot.outbox.entries[0].failure || persistedFlow.outbox.entries[0].failure`, so it passes even if the final main-side snapshot lost the conflict failure evidence. It also does not verify issue-log evidence remains available in the final snapshot after retry.
**Required change:** Assert the conflict reason and issue-log evidence directly from the final post-retry main-side snapshot, without falling back to the pre-retry persisted flow.
**Why blocking:** The test encodes an incorrect premise and can pass without exercising the required final-snapshot persistence behavior.


## Advisory Findings

No advisory findings.