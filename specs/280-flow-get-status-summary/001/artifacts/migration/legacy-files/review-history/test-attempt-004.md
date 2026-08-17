# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/280-flow-get-status-summary/test-coverage.json`

## Blocking Findings

### 1. RunId contract lacks retryRecovery coverage
**Target:** specs/280-flow-get-status-summary/tests/status-details-contract.test.js R4
**Issue:** R4 requires `flow get status <runId>` and `<runId> --details` to apply the same default/details field contract as context-based status resolution, but the runId test only covers a normal active flow plus reviewStop/gateStop omission/inclusion. It does not cover the R1 default-field condition where `retryRecovery` is present.
**Required change:** Add a runId-based assertion using `setupRetryRecoveryFlow()` that verifies default `flow get status <runId>` includes `retryRecovery` and still matches the default key contract.
**Why blocking:** An implementation could correctly include `retryRecovery` for context-based status while dropping it on the explicit runId path, and the current spec-local tests would still pass.

### 2. Empty runId validation is untested
**Target:** specs/280-flow-get-status-summary/tests/status-details-contract.test.js R6
**Issue:** R6 requires the optional positional `runId` to be an opaque non-empty string token from 1 to 200 characters. The tests cover 1, 200, and 201 characters, but do not cover rejection of an explicitly empty runId token.
**Required change:** Add a focused CLI assertion that passes an empty positional argument and expects a non-zero validation failure.
**Why blocking:** An implementation could accept an empty runId token despite the non-empty requirement, and the current validation tests would still pass.


## Advisory Findings

No advisory findings.