# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/327-approval-task-sync-atomic/test-coverage.json`

## Blocking Findings

### 1. R3 missing-spec retry is not covered
**Target:** specs/327-approval-task-sync-atomic/tests/approval-task-sync-atomic.test.js
**Issue:** R3 requires one caller retry to be deterministic and idempotent for unchanged pre-commit conditions. The tests cover malformed and invalid spec input retries, plus guarded target mismatch retries, but not the missing active-flow spec input case required by R2 and folded into R3's pre-commit failure set.
**Required change:** Add a missing-spec case to the R3 pre-commit retry coverage, asserting the same caller-visible failure repeats with unchanged flow bytes and then matches clean success after restoring the spec.
**Why blocking:** The coverage artifact marks R3 covered, but an acceptance-required failure mode has no corresponding spec-local retry/idempotency test.

### 2. R4 newly derived task field preservation is only asserted for one task
**Target:** specs/327-approval-task-sync-atomic/tests/approval-task-sync-atomic.test.js
**Issue:** R4 requires every newly derived spec task to preserve spec path, origin, parent, initial status and steps, empty requirements, null summary, and computed added_round. The happy-path test deeply asserts those fields for T-1, but for T-2 it only asserts status and added_round.
**Required change:** Assert the full expected persisted shape for T-2 as a newly derived task, including spec path, origin, parent, steps, requirements, summary, and added_round.
**Why blocking:** A required invariant for every newly derived spec task is not fully covered; a regression in T-2 field mapping could pass these tests.


## Advisory Findings

No advisory findings.