# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/478-fix-finalize-merge-conflict/test-coverage.json`

## Blocking Findings

### 1. R6 lacks an executable end-to-end Flow retry path
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js:196
**Issue:** The R6 test creates a real Git rebase conflict with `runPreSync`, then resolves the Git rebase manually and only runs pre-existing shared test files. It never drives the active spec through `finalize-merge` conflict recovery, the metadata evidence commit, retry, merge/outbox completion, sync, and cleanup as one executable workflow.
**Required change:** Add or adjust spec-local coverage so the real-conflict fixture invokes the Flow finalize-merge failure handling, verifies the evidence commit and clean rebase preparation, performs manual rebase resolution, retries `senti flow run finalize-merge`, and asserts one merge/outbox completion plus downstream sync/cleanup behavior.
**Why blocking:** R6 explicitly requires shared unit plus worktree CLI/E2E tests to exercise the actual conflict detection, evidence commit, clean rebase preparation, manual rebase, retry, one merge/outbox completion, sync, and cleanup. The current spec-local R6 test does not connect the real conflict to the Flow recovery transaction, so a critical acceptance path has no corresponding executable coverage.

### 2. R2 does not verify metadata survives in the final main-side snapshot
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js:104
**Issue:** The R2 test validates metadata immediately after `onError`, then calls `pre` and `post` directly on the same manager and reads the same working repository. It does not perform the resolved rebase/retry path or inspect the final main-side state after successful retry.
**Required change:** Extend the R2 coverage to complete the retry path and assert the conflict reason, failed outbox state, skipped-state evidence, and issue-log evidence are present in the final main-side snapshot after retry success.
**Why blocking:** R2 requires persistence of conflict metadata into the final main-side snapshot after successful retry. The current test can pass even if retry/main-side state reconstruction drops the recorded conflict evidence.

### 3. R4 does not verify merge side effects execute exactly once
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js:154
**Issue:** The R4 test manually begins an outbox entry and calls `post`, then checks one done outbox entry and pending downstream steps. It does not assert the actual merge side effect ran exactly once, nor that duplicate retry/post execution cannot duplicate the merge/outbox side effects.
**Required change:** Add an assertion around the production merge/outbox side effect boundary, such as commit count/merge artifact/outbox dispatch evidence, and verify retry completion does not duplicate it.
**Why blocking:** R4 explicitly requires merge and outbox side effects to execute exactly once after retry success. The current assertions cover only a manually shaped outbox state, so the exact-once production behavior is untested.


## Advisory Findings

No advisory findings.