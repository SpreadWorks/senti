# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/309-target-mismatch-guard/test-coverage.json`

## Blocking Findings

### 1. Runtime target-mismatch dispatch is not covered
**Target:** R1, R7 / specs/309-target-mismatch-guard/tests/target-mismatch-guard.test.js and specs/309-target-mismatch-guard/tests/skill-placement.test.js
**Issue:** The tests only exercise `senti flow get status --expect-*` mismatch handling and static skill text placement. They do not execute any dispatcher command path such as next-action, repair, run, finalize, or cleanup under an explicit mismatched target, so an implementation could still run another active flow after a mismatch while these tests pass.
**Required change:** Add a spec-local executable regression that sets up an active flow, supplies an explicit mismatched issue/spec/runId target through the dispatcher entry path, and asserts ACTIVE_FLOW_MISMATCH plus unchanged flow state/no dispatcher command execution.
**Why blocking:** R1 and R7 explicitly require that mismatches prevent dispatcher execution. Static guidance checks and status-only checks cannot detect the critical regression that the wrong active flow is executed.

### 2. Positional runId display-only behavior is not guarded against authorization
**Target:** R2 / specs/309-target-mismatch-guard/tests/target-mismatch-guard.test.js and specs/309-target-mismatch-guard/tests/target-retained-behavior.test.js
**Issue:** The retained-behavior test verifies positional runId status displays the active worktree state, but no test proves that a positional runId status result cannot authorize later dispatcher commands. An implementation could incorrectly treat `get status <runId>` as an expectation guard and still satisfy the current tests.
**Required change:** Add a spec-local test that uses positional runId status in a mismatched-target scenario and verifies it remains display-only, requiring explicit `--expect-run-id` or equivalent target-aware guard before dispatcher commands are allowed.
**Why blocking:** R2 specifically distinguishes explicit runId expectations from positional runId display status. Without this negative coverage, the test suite permits the incorrect authorization model the requirement is meant to prevent.


## Advisory Findings

No advisory findings.