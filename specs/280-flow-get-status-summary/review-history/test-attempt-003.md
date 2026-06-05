# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/280-flow-get-status-summary/test-coverage.json`

## Blocking Findings

### 1. Default payload contract is not enforced as an exact field set
**Target:** specs/280-flow-get-status-summary/tests/status-details-contract.test.js: CURRENT_FIELDS / R1 and R2 tests
**Issue:** The default-status tests assert that required current fields exist and that named detail fields are absent, but they do not assert that the response contains only the allowed default fields plus optional retryRecovery. An implementation could add unrelated fields such as tasks, currentTaskId, or other audit fields not listed in R2 and still pass.
**Required change:** Add an exact key-set assertion for default active status, allowing only CURRENT_FIELDS and retryRecovery when present.
**Why blocking:** R1 explicitly requires default active status to return current status fields only, so the spec-local tests currently miss part of a must requirement.


## Advisory Findings

### 1. RunId validation boundary could be clearer
**Target:** specs/280-flow-get-status-summary/tests/status-details-contract.test.js: R6 test
**Improvement:** Add a positive assertion for a short 1-character runId to pair with the existing 200-character and 201-character cases.
**Why non-blocking:** The existing test covers the upper bound, unmatched runId failure, unknown options, and --details help behavior; the missing lower-bound example is helpful but not enough to block implementation because an empty positional token is not naturally expressible through argv in this command shape.
