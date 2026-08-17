# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/480-freshness-scan-policy/test-coverage.json`

## Blocking Findings

### 1. Missing coverage for non-file traversal limits and unreadable paths
**Target:** specs/480-freshness-scan-policy/tests/freshness-source-surface.test.js
**Issue:** R2 requires indeterminate results when either scan reaches maxDepth, maxDirectoryEntries, maxFiles, or an unreadable non-excluded path. The tests only exercise maxFiles limits for source and docs scans.
**Required change:** Add spec-local tests for at least maxDepth, maxDirectoryEntries, and unreadable non-excluded path behavior, or otherwise cover each required limit/error condition explicitly.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage, so implementations can ignore several required indeterminate cases and still pass these tests.

### 2. Policy name is not actually asserted
**Target:** specs/480-freshness-scan-policy/tests/freshness-source-surface.test.js
**Issue:** R1/R3 require one named freshness source policy and JSON details containing the policy name, but assertScanDetail only checks that policy is some string.
**Required change:** Assert the expected policy name value for sourceScan/docsScan, and ensure tests distinguish the source freshness policy from an arbitrary string.
**Why blocking:** A test could pass with an unnamed or wrong policy string, leaving the named-policy API requirement unverified.


## Advisory Findings

No advisory findings.