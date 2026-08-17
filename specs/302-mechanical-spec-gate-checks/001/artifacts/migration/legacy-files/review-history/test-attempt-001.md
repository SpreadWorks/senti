# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/302-mechanical-spec-gate-checks/test-coverage.json`

## Blocking Findings

### 1. R2 does not test checkSpecJson non-duplication for non-null invalid priorities
**Target:** specs/302-mechanical-spec-gate-checks/tests/gate-spec-precheck.test.js R2
**Issue:** The R2 test only asserts that validateSpecJsonObject() rejects one invalid priority string, then separately checks null priority handling. It would still pass if checkSpecJson() also emitted duplicate enum/type priority issues for non-null invalid values, which R2 explicitly forbids. It also omits the required empty-string and non-string non-null cases.
**Required change:** Add spec-local assertions that non-null invalid priority values, including empty string, invalid string, and a non-string value, are schema validation failures and do not produce checkSpecJson() priority issues.
**Why blocking:** R2 has no executable coverage for the core checkSpecJson() boundary it requires, and the current test can pass without exercising the prohibited duplicate production behavior.

### 2. R5 coverage does not exercise preserved gate-flow behavior
**Target:** specs/302-mechanical-spec-gate-checks/tests/gate-spec-precheck.test.js R5
**Issue:** The R5 test only calls checkSpecJson() and asserts deterministic issue ordering. It does not cover runGateFlow() ordering, --skip-guardrail semantics, retry accounting, issue-log semantics, gateFail() envelope shape, schema validation boundaries, or AI guardrail definitions, despite the coverage artifact marking R5 covered.
**Required change:** Add spec-local tests or adjust the coverage artifact so R5 is not claimed covered until the preserved runGateFlow/spec-gate behaviors named in R5 are actually exercised.
**Why blocking:** The requirement-to-test artifact claims coverage for a broad gate behavior preservation requirement, but the actual test only covers a narrow checkSpecJson() ordering case.

### 3. R6 existing mechanical checks are mostly untested
**Target:** specs/302-mechanical-spec-gate-checks/tests/gate-spec-precheck.test.js R6
**Issue:** The R6 test only checks an unresolved goal marker and the new task test_strategy issue. It does not cover empty goal, empty requirements, empty acceptance criteria, missing tasks, empty tasks, task depth, or validateTestHeaders() coverage behavior, while the artifact marks R6 covered.
**Required change:** Add spec-local regression assertions for the existing mechanical checks listed in R6, or narrow the coverage artifact to the subset actually tested.
**Why blocking:** R6 is a non-regression requirement for multiple existing checks, and the current test would pass even if most of those production behaviors regressed.


## Advisory Findings

### 1. Add boundary coverage for priority threshold
**Target:** specs/302-mechanical-spec-gate-checks/tests/gate-spec-precheck.test.js R1
**Improvement:** Consider adding a case with exactly three requirements where missing priority does not produce a checkSpecJson() issue.
**Why non-blocking:** The positive greater-than-three behavior is covered; the exact threshold boundary would make the test design more robust but is not the only acceptance path.
