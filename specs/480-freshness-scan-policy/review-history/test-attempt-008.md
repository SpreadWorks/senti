# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/480-freshness-scan-policy/test-coverage.json`

## Blocking Findings

### 1. R4 file-budget scenario does not exceed maxFiles per excluded boundary
**Target:** specs/480-freshness-scan-policy/tests/freshness-source-surface.test.js:28
**Issue:** The R1/R4 excluded-boundary tests create only 3 files in each excluded directory while configuring maxFiles to 2. That exceeds the configured test override, but it does not cover the requirement that each excluded area can contain more than the production maxFiles limit. An implementation could incorrectly use the default 10,000-file budget for excluded directories and still pass these tests.
**Required change:** Make the excluded-directory fixture exceed the actual maxFiles policy limit being asserted, or explicitly set the policy limit to the production maximum and create more than that many files in the excluded areas.
**Why blocking:** R4 specifically requires unit tests in which .senti, node_modules, vendor, .git, and generated specs evidence contain more than maxFiles files; the current tests do not prove that behavior against the real limit premise.

### 2. R4 omits stale result coverage with oversized excluded content
**Target:** specs/480-freshness-scan-policy/tests/freshness-source-surface.test.js:128
**Issue:** The R4 test proves excluded timestamp changes keep a fresh result fresh, while the R1 test separately returns stale with small excluded directories. There is no test in which the required oversized excluded directories coexist with a stale source/docs comparison and still return stale instead of indeterminate.
**Required change:** Add or adjust one test so oversized excluded .git, .senti, node_modules, vendor, and generated specs evidence are present while a non-excluded source file is newer than docs and the result remains stale.
**Why blocking:** R4 requires tests where excluded areas contain more than maxFiles files but source and docs still return fresh or stale. Current oversized-exclusion coverage is only fresh, and stale coverage is not tied to the required oversized excluded-content condition.


## Advisory Findings

### 1. Depth and directory-entry checks are grouped
**Target:** specs/480-freshness-scan-policy/tests/freshness-source-surface.test.js:80
**Improvement:** Consider splitting depth, directory-entry, and unreadable-path assertions into separate test cases so a first failure does not hide later limit coverage.
**Why non-blocking:** The grouped test is still executable and covers the required limit kinds; this is only a diagnosability improvement.
