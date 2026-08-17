# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/300-final-regression-skip/test-coverage.json`

## Blocking Findings

### 1. R2 coverage omits required allowlist variants
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The R2 tests do not cover several explicit requirement branches: upgrade-backed template source paths, top-level *.mdx documentation, generic test-only paths under test/**, nested **/*.test.js, and **/*.spec.js. The coverage artifact marks R2 covered, but an implementation could fail these accepted path families while passing the current tests.
**Required change:** Add spec-local R2 cases for the missing allowlist/pattern variants, reusing the existing table-driven allowlist and generic test-only evidence tests where possible.
**Why blocking:** R2 is a must requirement and the coverage artifact overstates actual executable coverage for concrete acceptance branches.

### 2. Skipped raw decision log is not exercised
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The skipped artifact assertions only regex-match rawOutputPath and check rawOutputLines keys. They do not verify that the retained tests/.raw/final-regression-attempt-*.log file exists, nor that rawOutputLines is a valid numeric range covering decision lines written to that log.
**Required change:** Extend skipped-output assertions to read the artifact rawOutputPath from disk and assert rawOutputLines.start/end are numeric, ordered, in bounds, and correspond to retained decision log content.
**Why blocking:** R3 and R5 require preserved skip evidence. The current test would pass if production emitted a plausible path without retaining or indexing any raw decision log.

### 3. Emitted skipped artifact fields and proof values are under-asserted
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Issue:** The production skip assertions do not check required emitted fields such as version, reason, command, commandSource, and changedFiles, and the covered-by-test-execute proof only checks commandIdentity keys and changed file paths, not exact identity values or fingerprints.
**Required change:** Extend assertCoveredByTestExecuteProof and assertRiskBasedProof to assert all required skipped artifact fields and exact proof values, including commandIdentity values and changedFileFingerprints matching the current file fingerprints.
**Why blocking:** R3 is a must requirement for artifact shape and evidence. The current tests could pass with incomplete or misleading skipped artifacts.


## Advisory Findings

### 1. Add primitive env and metadata boundary cases
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js
**Improvement:** Add non-string JSON primitive cases for env/metadata comparison, such as boolean, number, and null values, plus reordered keys to document sorting-for-comparison behavior.
**Why non-blocking:** R1 already has meaningful stale checks for env and metadata key/value mismatches, so this would improve boundary clarity rather than fill a total coverage gap.
