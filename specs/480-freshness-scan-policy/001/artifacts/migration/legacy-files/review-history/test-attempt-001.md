# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/480-freshness-scan-policy/test-coverage.json`

## Blocking Findings

### 1. Missing docs limit regression coverage
**Target:** specs/480-freshness-scan-policy/tests/freshness-source-surface.test.js
**Issue:** R2 requires indeterminate when either the source scan or docs scan reaches limits. The executable test only forces a non-excluded source maxFiles limit and never proves a docs/ limit fails closed without source exclusions.
**Required change:** Add a spec-local unit test that exceeds a scan limit under docs/ and asserts result is indeterminate with docsScan.complete false and the docs limit recorded.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage for the docs-side limit behavior.

### 2. Incomplete JSON detail assertions
**Target:** specs/480-freshness-scan-policy/tests/freshness-source-surface.test.js
**Issue:** R3 requires sourceScan and docsScan details containing target, policy name, complete, and limits with kind, relativePath, and maximum. The tests only assert top-level keys and one source limit kind; they do not verify policy name values or limit relativePath/maximum shape for both scan details.
**Required change:** Extend tests to assert the named policy value and that recorded limits include kind, relativePath, and maximum, including docsScan when docs reaches a limit.
**Why blocking:** The requirement coverage artifact marks R3 covered, but the actual tests do not cover required JSON fields and limit metadata.

### 3. Result text labels and guidance are under-specified
**Target:** specs/480-freshness-scan-policy/tests/freshness-source-surface.test.js
**Issue:** R3 requires retaining toText labels for fresh, stale with docs-build guidance, never-built with docs-build guidance, and indeterminate with limits. The current regex only checks that one returned string starts with any result name, so it would pass if stale/never-built guidance or indeterminate limit text were removed.
**Required change:** Add assertions for toText output in stale, never-built, and indeterminate cases that verify the required docs-build guidance and limit text.
**Why blocking:** The test has a static anti-pattern that would pass without exercising the required production behavior.


## Advisory Findings

No advisory findings.