# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/309-target-mismatch-guard/test-coverage.json`

## Blocking Findings

### 1. Spec target guard is only exercised on status
**Target:** specs/309-target-mismatch-guard/tests/target-mismatch-guard.test.js
**Issue:** R2 requires explicit spec targets to be checked against the current dispatcher execution context, but the spec mismatch coverage only calls `get status --expect-spec`. No test exercises a dispatcher command such as `get next-action` or `run ...` with a mismatched `--expect-spec`, so an implementation could guard status while still executing the active flow for spec-targeted dispatcher commands.
**Required change:** Add the smallest regression case that runs at least one dispatcher command with a mismatched `--expect-spec` and asserts `ACTIVE_FLOW_MISMATCH` plus no active-flow mutation.
**Why blocking:** This leaves an acceptance requirement without spec-local executable coverage for the dispatcher behavior it requires.

### 2. RunId target guard is only partially exercised for dispatcher context
**Target:** specs/309-target-mismatch-guard/tests/target-mismatch-guard.test.js
**Issue:** R2 requires explicit runId targets to be checked against the current dispatcher execution context. The tests cover `get status --expect-run-id` and one `get next-action --expect-run-id` case tied to positional display behavior, but they do not cover any `run` dispatcher command with a mismatched explicit runId.
**Required change:** Add one mismatched `--expect-run-id` test on a mutating `run` dispatcher command and assert `ACTIVE_FLOW_MISMATCH` and unchanged active-flow state.
**Why blocking:** A run-command path could still authorize execution from a mismatched runId while the current tests pass.


## Advisory Findings

No advisory findings.