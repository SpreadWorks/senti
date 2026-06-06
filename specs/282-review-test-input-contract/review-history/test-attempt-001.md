# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/282-review-test-input-contract/test-coverage.json`

## Blocking Findings

### 1. R4 shared npm-test location is not covered
**Target:** Requirement-to-Test Coverage Artifact / specs/282-review-test-input-contract/tests/review-test-input-contract.test.js
**Issue:** R4 requires normal `npm test` coverage through shared tests under `tests/unit` or `tests/e2e`, but the provided executable test is spec-local under `specs/282-review-test-input-contract/tests`, and the artifact references `tests/review-test-input-contract.test.js`, which is not under `tests/unit` or `tests/e2e`. The R4 test only asserts exported helper surface and does not demonstrate shared npm-test placement.
**Required change:** Add or move the shared coverage for R1, R2, and R3 to `tests/unit/...` or `tests/e2e/...`, and update the coverage artifact to point to that shared test file.
**Why blocking:** The requirement coverage artifact marks R4 covered, but the actual provided test design does not satisfy the required shared-test location contract for normal `npm test` coverage.

### 2. R1 does not test non-test module exclusion inside spec-local tests
**Target:** specs/282-review-test-input-contract/tests/review-test-input-contract.test.js R1 test
**Issue:** R1 requires `collectTestFiles` to include only `.test` or `.spec` JavaScript/TypeScript module files under the spec-local tests directory, but the test does not place any non-matching JavaScript/TypeScript files inside `specs/example/tests` such as `helper.js`, `local.test.txt`, or `local.md`. An implementation that collects every file under the spec-local tests directory would still pass this test as written.
**Required change:** Add at least one non-test file under `${specDir}/tests` and assert it is excluded from the collected sources/content.
**Why blocking:** This is a static anti-pattern that can pass without exercising the production behavior required by the `only .test or .spec JavaScript/TypeScript module files` portion of R1.


## Advisory Findings

No advisory findings.