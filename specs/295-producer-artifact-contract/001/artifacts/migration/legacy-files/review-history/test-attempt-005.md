# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/295-producer-artifact-contract/test-coverage.json`

## Blocking Findings

### 1. Acceptance-review context deferral is untested
**Target:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js / R6
**Issue:** R6 requires deferred finding summaries to be included in subsequent context for acceptance-review, but the test only calls buildDeferredFindingsSummary() directly and never exercises the acceptance-review context assembly path.
**Required change:** Add a spec-local test that builds or reads the acceptance-review context after deferral and asserts the deferred flow-findings summary is present.
**Why blocking:** An explicit acceptance requirement has no corresponding executable coverage on the downstream consumer path.

### 2. Spec-review blockingFindings fallback is untested
**Target:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js / R6
**Issue:** R6 requires spec-review deferral to read blocking[] when present, otherwise blockingFindings[]. The test covers spec-review blocking[] and impl-review blockingFindings[], but not spec-review blockingFindings[] fallback.
**Required change:** Add a spec-review fixture without blocking[] and with blockingFindings[] and assert deferred sourceFindingId preservation or stable synthesis.
**Why blocking:** This is a concrete requirement branch for spec-review and currently lacks coverage.

### 3. Review surface parity coverage is incomplete
**Target:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js / R7
**Issue:** R7 requires review draft/spec/test/impl retained surfaces to keep artifact generation and non-semantic protocol/schema failure behavior. The adapter surface test only covers review:spec.
**Required change:** Add surface cases for review:draft, review:test, and review:impl, or otherwise test those public surfaces directly for artifact generation and non-semantic protocol/schema failure handling.
**Why blocking:** The migration parity requirement covers multiple retained public surfaces, but several have no corresponding spec-local test coverage.

### 4. Raw evidence range check is not covered
**Target:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js / R3
**Issue:** R3 explicitly requires preserving raw evidence range checks for durable test artifacts. The tests cover missing raw output, file-map, placeholder, and regression checks, but no fixture exercises an invalid raw evidence range.
**Required change:** Add a durable test artifact case with present raw evidence and an invalid/out-of-range raw evidence reference, asserting the expected mechanical issue code.
**Why blocking:** A named trust check in the acceptance requirement has no corresponding regression coverage.


## Advisory Findings

### 1. Implement readiness envelope assertions are broad
**Target:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js / R4
**Improvement:** The first R4 assertion uses a regex over mixed error fields. More precise assertions for structural envelope shape and issue codes would make failures easier to diagnose.
**Why non-blocking:** The test still exercises the readiness prevalidation path and later asserts a concrete requirement-status issue code.
