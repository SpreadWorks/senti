# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/478-fix-finalize-merge-conflict/test-coverage.json`

## Blocking Findings

### 1. R6 does not exercise the required end-to-end conflict recovery flow
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js test "R6: makes the conflict recovery transaction executable in a Git fixture"
**Issue:** The R6 test uses failMerge(), which directly invokes finalize-merge.onError with a synthetic Error, then only reruns existing shared tests. It does not exercise actual conflict detection, manual rebase, retry, one merge/outbox completion, sync, and cleanup in this spec-local Git fixture.
**Required change:** Add executable coverage that drives the real worktree CLI/E2E conflict path: create an actual rebase conflict, verify the evidence commit and clean rebase preparation, perform/continue the manual rebase, retry finalize-merge, and assert one merge/outbox completion plus downstream sync/cleanup behavior.
**Why blocking:** R6 explicitly requires shared unit plus worktree CLI/E2E tests to exercise the real recovery sequence. The current spec-local test can pass while the production conflict-detection and retry workflow is broken because it bypasses conflict detection and delegates to unrelated shared tests without asserting this scenario.

### 2. R2 does not verify persistence in a final main-side snapshot
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js test "R2: records the failed outbox and skipped downstream steps in metadata only"
**Issue:** The test reads manager.load() from the same fixture after direct pre/post calls and checks git log/current issue-log contents. It does not perform a successful retry through the final main-repository state or assert that the conflict reason, failed outbox state, skipped downstream states, and issue-log evidence remain present in that final main-side snapshot.
**Required change:** After a real successful retry/finalization, load the final main-side flow and issue-log snapshot and assert the R2 metadata remains available there.
**Why blocking:** R2's core persistence guarantee is about availability after successful retry in the final main-side snapshot. The current test can pass even if the metadata is lost during actual retry/finalization into main.

### 3. R5 direct finalize/cleanup deleted-worktree behavior is not covered spec-locally
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js test "R5: a clean normal merge preparation does not use the conflict recovery commit"
**Issue:** The R5 test only verifies that clean finalize-merge.pre does not create a new commit, then shells out to broad shared tests. It does not assert that direct finalize/cleanup updates verification and integration records through main-repository flow state after rebase, resumes an interrupted completion from its saved transaction, completes teardown journal/receipt/cleanup through main state, or avoids import/filesystem/lock/log access against a deleted worktree.
**Required change:** Add focused assertions or a spec-local harness for the direct finalize/cleanup post-rebase deleted-worktree scenario required by R5, rather than relying only on broad shared test execution.
**Why blocking:** Most of R5 has no corresponding spec-local acceptance coverage in this file, despite the coverage artifact marking R5 covered. The current test can pass while the deleted-worktree/main-state completion behavior regresses.


## Advisory Findings

No advisory findings.