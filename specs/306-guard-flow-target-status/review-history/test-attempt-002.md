# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/306-guard-flow-target-status/test-coverage.json`

## Blocking Findings

### 1. R1 flow-entry guard is not exercised
**Target:** tests/flow-target-status.test.js R1
**Issue:** The R1 test calls `senti flow get status --expect-issue 399` directly and then verifies the flow step did not advance. This covers the status command's mismatch response, but not the required flow-entry integration point where issue-targeted entry must use `senti flow get status [runId] --expect-issue <n>` before dispatch and must skip `next-action`, `flow run`, and `finalize-cleanup` on mismatch.
**Required change:** Add spec-local coverage that invokes the issue-targeted flow entry path which would normally dispatch next-action/run/finalize-cleanup, creates a mismatched active flow, and asserts it fails with ACTIVE_FLOW_MISMATCH before those downstream actions run.
**Why blocking:** An implementation could make the direct status command fail correctly while never wiring the mismatch guard into the actual flow entry path, leaving the main R1 acceptance behavior untested.


## Advisory Findings

### 1. R5 approval parity could be more behavior-level
**Target:** tests/flow-target-status.test.js R5
**Improvement:** The test currently checks that approval and finalize recovery exception guidance strings remain documented. A stronger non-blocking improvement would add executable parity coverage for `requires_approval` / `autoApprove` approval behavior and finalize recovery exception behavior if stable helpers exist.
**Why non-blocking:** The documented strings partially guard migration parity, and the requirement artifact does include R5 coverage; this is an opportunity to reduce future regression risk rather than a clear static blocker.
