# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/478-fix-finalize-merge-conflict/test-coverage.json`

## Blocking Findings

### 1. R1 lacks assertion for the returned rebase instruction and one-commit behavior
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js
**Issue:** The R1 test only checks that `git status --porcelain` is clean after `failMerge()`. It does not assert that finalize-merge returns or raises the required rebase instruction, nor that exactly one metadata-only commit is created by the conflict handler.
**Required change:** Extend the R1 coverage to verify the recovery instruction text/shape and that the conflict handler adds exactly one commit containing only the active spec metadata files.
**Why blocking:** R1 explicitly requires the metadata-only commit to be created before returning the rebase instruction. The current test could pass if no instruction is produced or if commit count behavior is wrong.

### 2. R2 does not cover conflict reason, issue-log evidence, or final main-side persistence
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js
**Issue:** The R2 test checks changed files plus failed outbox and skipped downstream statuses, but it does not assert that the conflict reason is persisted, that issue-log evidence exists, or that these records remain available in the final main-side snapshot after a successful retry.
**Required change:** Add spec-local assertions for persisted conflict reason, issue-log evidence content, and availability of those records after the retry reaches the final main-side snapshot.
**Why blocking:** These are explicit R2 acceptance requirements and are not covered by the current executable tests.

### 3. R3 does not assert the full no-mutation contract or retry instruction
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js
**Issue:** The R3 test verifies HEAD and flow.json are unchanged and that the error includes the dirty path/status, but it does not assert that the finalize-merge outbox was not begun or altered, step state was not altered beyond flow.json equivalence, or that the message requires a later `senti flow run finalize-merge` retry after user resolution.
**Required change:** Add assertions for unchanged outbox state and step state, and check that the rejection includes the required retry command/instruction.
**Why blocking:** R3 requires Flow not to create a commit, begin or alter outbox, or alter step state, and to require a later retry. Current coverage only proves part of that behavior.

### 4. R4 only tests pre-retry reset, not retry success semantics
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js
**Issue:** The R4 test calls `finalize-merge.pre()` and checks downstream steps become pending, but it does not exercise successful retry completion, finalize-merge becoming done, merge/outbox side effects executing exactly once, or downstream steps remaining pending after retry success.
**Required change:** Add a retry-success test path that completes finalize-merge and asserts one merge/outbox completion, finalize-merge done, and downstream steps still pending for normal execution.
**Why blocking:** Most of R4's acceptance behavior is not exercised by the current test design.

### 5. R5 direct finalize/cleanup and deleted-worktree safety are untested
**Target:** specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js
**Issue:** The R5 test only checks that the latest commit subject is not the conflict recovery commit after clean merge preparation. It does not prove that no metadata-only commit was created, nor does it test direct finalize/cleanup updating main-repository flow state after rebase, transaction resume, teardown journal/receipt/cleanup, or avoiding imports/filesystem reads/lock validation/log access against a deleted worktree.
**Required change:** Add tests for clean no-conflict commit count/files, direct finalize/cleanup through main-repository state, interrupted transaction resume, teardown completion, and deleted-worktree access guards.
**Why blocking:** R5 contains multiple explicit acceptance requirements that have no corresponding spec-local coverage.

### 6. R6 shared CLI/E2E coverage is not present in the artifact
**Target:** Requirement-to-Test Coverage Artifact and specs/478-fix-finalize-merge-conflict/tests/finalize-merge-conflict-recovery.test.js
**Issue:** The artifact marks R6 covered only by the spec-local test file. R6 requires spec-local tests plus shared unit and worktree CLI/E2E tests that exercise actual conflict detection, evidence commit, clean rebase preparation, manual rebase, retry, one merge/outbox completion, sync, and cleanup.
**Required change:** Add or reference the required shared unit and worktree CLI/E2E tests in the coverage artifact, with executable coverage for the listed end-to-end behaviors.
**Why blocking:** The coverage artifact contradicts R6 by claiming coverage from only one spec-local file while the requirement explicitly demands shared unit plus CLI/E2E coverage.


## Advisory Findings

No advisory findings.