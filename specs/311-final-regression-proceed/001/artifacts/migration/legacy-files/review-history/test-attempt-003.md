# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/311-final-regression-proceed/test-coverage.json`

## Blocking Findings

### 1. R1 category limit is contradicted by test expectations
**Target:** specs/311-final-regression-proceed/tests/final-regression-record-and-proceed.test.js
**Issue:** The R2 test asserts `failureCategory` is `invalid_project_test`, but R1 says automatic user-visible failure categories are limited to `caused_by_current_change`, `existing_failure`, `environment`, `sandbox`, `timeout`, and `dependency`; `out_of_scope` and `flaky_suspected` require explicit record-and-proceed evidence. The test encodes an implementation premise that conflicts with the required category vocabulary.
**Required change:** Change the invalid project-test assertion to use an allowed Issue #403 category plus separate invalid-project-test metadata, or update the requirement/category artifact if `invalid_project_test` is intentionally part of the allowed category set.
**Why blocking:** A test that expects a category outside the specified allowed set would drive implementation away from R1 and make category validation ambiguous.

### 2. R7 auto-mode selection has no executable coverage
**Target:** specs/311-final-regression-proceed/tests/final-regression-report-and-prompt.test.js
**Issue:** R7 requires that auto mode select the recommended action, but the only auto-mode coverage is a prompt text regex. No executable test drives final-regression prompt/selection behavior in auto mode and asserts that the selected action equals the computed recommendation.
**Required change:** Add a spec-local executable test that invokes the relevant prompt/selection path in auto mode for both recommendation states and asserts the selected action follows the recommendation.
**Why blocking:** This is a required behavior with no corresponding executable regression coverage; prompt wording alone can pass without exercising production behavior.

### 3. R6 registry post-hook completion behavior is not exercised
**Target:** specs/311-final-regression-proceed/tests/final-regression-contract.test.js
**Issue:** R6 requires both the final-regression registry post-hook and `flow-judgment-contract.js` completion policy to complete only pass, skipped, or validated failed-recorded artifacts. The tests exercise `CompletionValidator`, but do not exercise the registry post-hook path.
**Required change:** Add a spec-local test for the final-regression registry post-hook that accepts validated failed-recorded artifacts and rejects ordinary failed or validation-failed artifacts.
**Why blocking:** The requirement explicitly names two production surfaces; one of them has no executable coverage, so implementation could regress the registry hook while tests still pass.

### 4. R5 stale validation is incomplete for changed-file fingerprint equality
**Target:** specs/311-final-regression-proceed/tests/final-regression-record-and-proceed.test.js
**Issue:** R5 defines stale as differing current command identity or current changed-file fingerprints. The test mutates a changed file after the failed artifact but does not assert the positive case where unchanged command identity and unchanged fingerprints allow record-and-proceed validation. That leaves the fingerprint comparison contract only tested as rejection.
**Required change:** Add a successful record-and-proceed test where the failed artifact remains current with matching command identity and changed-file fingerprints, then assert validation succeeds and the post-hook envelope can mark the step done.
**Why blocking:** The acceptance requirement includes validation of current failed artifacts, not just stale rejection; without the positive fingerprint case, an implementation could reject all fingerprint-bearing failures and still satisfy the current tests.


## Advisory Findings

### 1. Coverage artifact paths are ambiguous
**Target:** Requirement-to-Test Coverage Artifact
**Improvement:** Use full spec-local paths such as `specs/311-final-regression-proceed/tests/final-regression-record-and-proceed.test.js`, or state explicitly that `tests/...` paths are relative to the spec directory.
**Why non-blocking:** The executable code is provided under the required spec-local directory, so this looks like notation drift rather than a coverage failure.
