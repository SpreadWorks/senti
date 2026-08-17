# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/340-preserve-child-diagnostics/test-coverage.json`

## Blocking Findings

### 1. R4 stream forwarding preservation is not asserted
**Target:** specs/340-preserve-child-diagnostics/tests/child-execution-evidence.test.js
**Issue:** The coverage artifact marks R4 covered, but the R4 test only checks marker count, spawn count, aggregate exit code, and summary text. It does not assert that nested stdout/stderr content from each category is still forwarded to the parent streams.
**Required change:** Add assertions in the R4 runner test that the planned child stdout and stderr payloads are present on the corresponding captured parent stdout/stderr streams while the execution marker is also emitted.
**Why blocking:** R4 explicitly requires preserving existing stream forwarding. Without this assertion, an implementation could emit markers and summaries while dropping child output and the test would still pass.

### 2. R7 preservation coverage is materially incomplete
**Target:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Issue:** The R7 test covers only pass envelope, report transition, and one outer invocation count. It does not cover the required preserved fail/skipped envelopes, retry behavior, record-and-proceed failed-state display, config-derived timeout behavior, or issue-log side effects.
**Required change:** Add spec-local tests or assertions covering the missing R7 preservation points: fail and skipped envelopes, retry behavior, record-and-proceed failed-state display, config-derived timeout behavior, and issue-log side effects.
**Why blocking:** R7 is a must requirement with multiple regression-sensitive behaviors. The artifact reports it as covered, but the executable tests leave several required behaviors untested.

### 3. R8 migration parity has no executable coverage
**Target:** specs/340-preserve-child-diagnostics/tests/final-regression-diagnostics.test.js
**Issue:** R8 requires automated coverage for migration parity, but neither spec-local test file exercises migration behavior or compares old/new artifact handling across migration boundaries.
**Required change:** Add a spec-local migration parity test that proves existing final-regression artifacts or migrated state remain compatible with the new bounded child-record evidence format.
**Why blocking:** R8 explicitly lists migration parity as required automated coverage. The coverage artifact marks R8 covered, but the actual tests do not cover this dimension.


## Advisory Findings

No advisory findings.