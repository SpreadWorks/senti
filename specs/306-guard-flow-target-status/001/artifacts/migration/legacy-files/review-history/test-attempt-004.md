# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/306-guard-flow-target-status/test-coverage.json`

## Blocking Findings

### 1. R2 preparing autoApprove inheritance is untested
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js
**Issue:** The preparing-state R2 test only asserts that `senti flow get status <runId>` reports `autoApprove: false`. It does not exercise the set-auto envelope or the prepare-to-active inheritance path required by R2.
**Required change:** Add a spec-local R2 regression that creates a preparing flow with autoApprove enabled, drives the set-auto/prepare path, and asserts the resulting active flow inherits the intended autoApprove behavior while status for preparing still remains false.
**Why blocking:** An implementation could pass the current tests by simply suppressing preparing status autoApprove while losing the requested autoApprove during prepare inheritance, violating a must requirement.


## Advisory Findings

### 1. Generated skill sync check is marker-only
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js
**Improvement:** Strengthen R6 by comparing the generated skill's relevant guidance block or ordering against the source guidance, not only checking for a few marker strings.
**Why non-blocking:** The current test still checks the key generated markers and stale unsafe bare-status wording, so this is a coverage-quality improvement rather than a concrete blocker.
