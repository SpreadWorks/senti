# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/480-freshness-scan-policy/test-coverage.json`

## Blocking Findings

### 1. Docs traversal exclusion scope is not tested
**Target:** specs/480-freshness-scan-policy/tests/freshness-source-surface.test.js
**Issue:** R2 requires the `freshness-source` exclusions to apply only to sourceRoot traversal and docs/ to be traversed without source exclusions. The tests prove docs/ can hit a normal file limit, but they never place a source-excluded path such as `docs/.senti`, `docs/node_modules`, or `docs/specs/.../review-evidence` under docs/. An implementation that incorrectly applies `freshness-source` to docsScan would still pass these tests.
**Required change:** Add a spec-local unit test where an otherwise source-excluded directory under docs/ contains more than the maxFiles budget and assert the result is `indeterminate` with `docsScan.policy === "default"`.
**Why blocking:** This is a must requirement with no corresponding test coverage for the policy-scope behavior.


## Advisory Findings

No advisory findings.