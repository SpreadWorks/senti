# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/311-final-regression-proceed/test-coverage.json`

## Blocking Findings

### 1. R2 only covers current-diff ineligibility
**Target:** specs/311-final-regression-proceed/tests/final-regression-record-and-proceed.test.js
**Issue:** The R2 test exercises caused_by_current_change ineligibility, but does not provide spec-local coverage for invalid project-test behavior tied to the current diff, broken workflow state, missing artifact evidence, artifact write failure, or schema validation failure blocking record-and-proceed.
**Required change:** Add focused R2 test coverage for the remaining ineligible failure modes, or split them into shared unit tests referenced by a spec-local R2 test that verifies record-and-proceed stays unavailable for each mode.
**Why blocking:** R2 explicitly requires these failure classes to keep the flow on fix-or-stop behavior; several acceptance cases currently have no corresponding test coverage.

### 2. R3 lacks explicit out_of_scope and flaky_suspected evidence coverage
**Target:** specs/311-final-regression-proceed/tests/final-regression-record-and-proceed.test.js
**Issue:** R3 covers ordinary existing_failure eligibility, but does not verify that out_of_scope and flaky_suspected become eligible only when record-and-proceed selection supplies explicit non-empty evidence.
**Required change:** Add R3 tests that attempt record-and-proceed for out_of_scope and flaky_suspected with non-empty evidence and assert eligibility/validation while preserving result="fail"; include rejection coverage for missing evidence if not covered under R2.
**Why blocking:** R3 specifically includes explicitly evidenced out_of_scope and flaky_suspected as eligible categories, and that gated behavior is not covered.

### 3. R5 command-identity stale rejection is untested
**Target:** specs/311-final-regression-proceed/tests/final-regression-record-and-proceed.test.js
**Issue:** The R5 stale-artifact test only mutates changed-file fingerprints before record-and-proceed. It does not verify stale rejection when the current command identity differs from the command identity stored on the failed artifact.
**Required change:** Add an R5 case that records a failed artifact, changes the final-regression command identity, runs --record-and-proceed, and expects FINAL_REGRESSION_RECORD_AND_PROCEED_STALE or the equivalent rejection.
**Why blocking:** R5 defines stale as either command identity or changed-file fingerprints differing; one of the two required stale paths has no coverage.

### 4. R7 scan limit and raw-log non-read behavior are uncovered
**Target:** specs/311-final-regression-proceed/tests/final-regression-record-and-proceed.test.js
**Issue:** The R7 test covers identical fingerprints and a changed fingerprint, but does not assert that fixAttempts scans at most the latest 10,000 failure records or that the calculation does not read raw log contents.
**Required change:** Add R7 unit or integration coverage that constrains the scan to the latest 10,000 records and detects accidental raw log reads during fixAttempts calculation.
**Why blocking:** R7 explicitly requires both the 10,000-record bound and no raw-log reads; these are critical performance and design constraints with no test coverage.

### 5. R8 status and human-summary surfaces are not covered
**Target:** specs/311-final-regression-proceed/tests/final-regression-report-and-prompt.test.js
**Issue:** The R8 test covers generateReport JSON/text, but does not cover status output or other human-readable summary surfaces that must display failed-recorded final-regression as not passed with the required details.
**Required change:** Add R8 coverage for the status command/output and any separate human-readable summary surface that reports final-regression state, asserting failed-recorded remains non-pass and includes category, raw log path, fix attempts, remaining risk, selected action, and nextRecommendedAction.
**Why blocking:** R8 names status, final report, report JSON, and human-readable summaries; only report JSON/text are currently tested.

### 6. R10 shared schema coverage is missing
**Target:** specs/311-final-regression-proceed/tests/final-regression-contract.test.js, specs/311-final-regression-proceed/tests/final-regression-record-and-proceed.test.js, specs/311-final-regression-proceed/tests/final-regression-report-and-prompt.test.js
**Issue:** The tests invoke validateFinalRegressionResult on happy-path artifacts, but there is no shared unit test asserting the final-regression schema accepts the new failed-recorded fields and rejects invalid combinations such as validated failed-recorded without required evidence, invalid nextRecommendedAction, or ordinary fail marked complete.
**Required change:** Add shared schema tests for the new final-regression artifact fields and invalid combinations required by R5/R6/R8/R10.
**Why blocking:** R10 requires shared unit tests to cover schema behavior where appropriate, and schema validation failures are part of the acceptance behavior for this feature.


## Advisory Findings

### 1. R1 execution fixture is text-simulated
**Target:** specs/311-final-regression-proceed/tests/final-regression-record-and-proceed.test.js
**Improvement:** The R1 execution-failure branch uses a normal shell script that prints "spawn EPERM" and exits 1. A more direct fixture using an actual spawn error, timeout, or sandbox-denied execution would better prove execution classification.
**Why non-blocking:** The test still exercises production classification using source-backed stderr evidence, but a more realistic fixture would reduce ambiguity.
