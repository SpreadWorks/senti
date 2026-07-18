# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/319-guarded-plan-rewind/test-coverage.json`

## Blocking Findings

### 1. Artifact preservation is not asserted for the command path
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R5/R8
**Issue:** The tests verify that evidence capture reads files without changing them, but they do not assert that a successful `RunReopenDraftCommand.execute` leaves existing artifact files byte-identical. `tempRoot()` creates `prior-review.json`, yet R1/R8 remove the temp root without comparing it after the rewind.
**Required change:** Add a spec-local assertion around a successful flow-level command rewind that snapshots an existing artifact file before execution and verifies the same bytes still exist afterward.
**Why blocking:** R5/R8 require prior artifact files to be preserved. An implementation could delete or rewrite artifacts after inventory during the command flow and these tests would still pass.

### 2. Specific rejection failures are not checked for most invalid candidates
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R7
**Issue:** Most rejection cases use `assert.throws(..., undefined, label)`, which accepts any thrown error. This does not verify the required specific failure for unsupported stages, task-scoped stage, finalize leaves, merge outcome, squash baseline, finalized timestamp, and candidate invariant failure.
**Required change:** For each R7 rejection case, assert the specific error code/message/envelope that the target API promises rather than accepting any throw.
**Why blocking:** R7 requires specific failures before save. The current tests would pass if all invalid inputs failed with a generic or incorrect error.

### 3. Unsupported non-finalize flow stages are not covered
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js R1/R7
**Issue:** The tests cover supported stages and finalize leaves, but do not exercise an unsupported non-finalize parent leaf such as `test-execute` or `test-result-review` with flow-level guards present.
**Required change:** Add a rejection test for at least one active parent leaf outside the five supported stages and outside `finalize-*`, asserting it does not enter flow-level mode and returns the expected unsupported-stage failure without mutation.
**Why blocking:** R1 limits flow-level mode to exactly five stages, and R7 requires unsupported stage rejection. Without this case, an implementation could incorrectly allow other implementation leaves.


## Advisory Findings

No advisory findings.