# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/480-freshness-scan-policy/test-coverage.json`

## Blocking Findings

### 1. R4 generated maxFiles coverage is incomplete
**Target:** specs/480-freshness-scan-policy/tests/freshness-source-surface.test.js
**Issue:** R4 requires unit tests where `.senti`, `node_modules`, `vendor`, `.git`, and generated specs evidence each contain more than `maxFiles` files while source and docs still return fresh or stale. The tests only put more-than-budget files in these paths collectively in the R1 stale case, and only `.senti/output` in the R4 fresh case. There is no fresh/stale assertion proving `node_modules`, `vendor`, `.git`, `specs/*/review-history`, `specs/*/review-evidence`, and `specs/*/tests/.raw` remain ignored under the over-budget condition in the R4 scenario.
**Required change:** Extend the R4 coverage so every required excluded directory/path contains more than `maxFiles` files and the scan still returns `fresh` or `stale`.
**Why blocking:** An explicit acceptance requirement has no corresponding spec-local test coverage for several required excluded paths under the stated over-budget fresh/stale condition.


## Advisory Findings

No advisory findings.