# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/301-no-tests-valid-state/test-coverage.json`

## Blocking Findings

### 1. R3 lacks coverage for raw decision log and project regression contract validation
**Target:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js R3 test
**Issue:** The R3 test only asserts that a complete no-tests artifact produces verdict=pass and that summary_evidence passed. It does not exercise the required validation of the raw decision log or the project regression contract, and would still pass if test-result-review stopped checking those parts entirely.
**Required change:** Extend the R3 spec-local test to assert the raw decision log check and project_regression_verification check are present and passing, or add malformed-artifact cases proving those validations fail when missing/invalid.
**Why blocking:** R3 explicitly requires test-result-review to validate summary membership, raw decision log, and project regression contract; two of those required behaviors currently have no corresponding spec-local coverage.

### 2. R5 does not cover invalid discovery state
**Target:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js R5 test
**Issue:** The R5 test covers the no-command skip path and malformed configured command failure, but it does not cover the required behavior that an invalid discovery state remains an invalid_project_test failure rather than being converted into skipped_by_project_policy.
**Required change:** Add a focused R5 case that creates or simulates an invalid command discovery state and asserts final-regression writes a failure artifact with failureKind=invalid_project_test and not skipKind=skipped_by_project_policy.
**Why blocking:** R5 names invalid discovery state as a must-have distinction; without a test, implementation could incorrectly skip invalid discovery failures while the suite still passes.

### 3. R7 only covers one started failure mode
**Target:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js R7 test
**Issue:** R7 requires non-zero exit, timeout, signal, spawn failure, and unrelated missing file failures to remain failures. The current test only exercises a non-zero exit from a started shell command.
**Required change:** Add spec-local coverage for the remaining R7 failure modes, at minimum timeout and spawn failure, and an unrelated missing file case if that is a distinct code path in final-regression.
**Why blocking:** R7 is a regression-safety requirement for several distinct failure classifications; most of the required failure modes currently have no corresponding test coverage.


## Advisory Findings

### 1. R2 could prove validateSummaryEvidence rejection paths more directly
**Target:** specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js R2 test
**Improvement:** Add a negative validateSummaryEvidence case for a not_applicable entry whose raw_output_lines or reason do not match the raw log evidence.
**Why non-blocking:** The current R2 test already covers schema rejection for missing reason and malformed raw_output_lines, so this is extra precision rather than missing acceptance coverage.
