# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/478-fix-finalize-merge-conflict/test-coverage.json`

## Blocking Findings

### 1. Actual finalize-merge conflict path is not exercised for evidence commit
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js
**Issue:** R1/R6 require coverage of normal worktree finalize-merge conflict handling with actual conflict detection, evidence commit, clean rebase preparation, manual rebase, and retry. The tests create the metadata commit by calling `FLOW_COMMANDS.run["finalize-merge"].onError(...)` directly with a synthetic error. The only Git conflict fixture calls `runPreSync(...)` separately, resolves a manual rebase, then creates a new flow and again invokes `onError(...)` synthetically, so the evidence commit is not tied to the actual finalize-merge conflict path.
**Required change:** Add or adjust a spec-local executable test so an actual finalize-merge/pre-sync conflict failure drives the production conflict handler that creates the metadata-only commit, then verifies clean status, manual rebase continuation, and retry from that persisted state.
**Why blocking:** The current tests can pass even if the integrated finalize-merge conflict path never creates the required evidence commit after a real conflict.

### 2. R5 deleted-worktree/main-state behavior is not spec-locally asserted
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js
**Issue:** R5 requires direct finalize/cleanup to update verification and integration records through main-repository flow state after rebase, resume an interrupted completion from its saved transaction, complete teardown journal/receipt/cleanup through that main-repository state, and perform no import/filesystem read/lock validation/log access against a deleted worktree. The R5 test only asserts no commit on clean `finalize-merge.pre(...)` and shells out to broad shared suites; it does not contain spec-local assertions for the deleted-worktree/main-repository state requirements.
**Required change:** Add spec-local assertions or a focused spec-local fixture covering direct finalize/cleanup after rebase through main-repository flow state, including interrupted transaction resume and no access to the deleted worktree.
**Why blocking:** An acceptance requirement has no corresponding spec-local coverage despite the artifact marking R5 covered.

### 3. Merge side effect exactly-once requirement is not tested
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js
**Issue:** R4 requires merge and outbox side effects to execute exactly once after retry success. The tests assert only that one outbox entry is done and that a repeated `post(...)` call does not duplicate the outbox entry; they do not observe or count the merge side effect itself.
**Required change:** Add a spec-local assertion using the production merge side effect boundary, transaction artifact, commit state, or an equivalent observable to prove the merge side effect executes exactly once across retry/idempotent completion.
**Why blocking:** The tests could pass if outbox idempotency works while the merge side effect is skipped or executed more than once.


## Advisory Findings

No advisory findings.