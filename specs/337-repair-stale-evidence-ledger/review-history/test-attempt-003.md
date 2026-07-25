# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/337-repair-stale-evidence-ledger/test-coverage.json`

## Blocking Findings

### 1. Current-evidence normal path is not exercised through an entrypoint
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js R6/R9
**Issue:** R6 requires valid evidence already matching the current fingerprint to retain its normal path. The test only calls `StaleTestEvidenceMismatch.detect(...)` with a matching fingerprint and asserts `null`; it does not exercise any stale evidence entrypoint or assert that no recovery mutation/lifecycle transition occurs on the normal path.
**Required change:** Add a spec-local test that runs at least one affected public entrypoint with current evidence, asserts the normal non-recovery result/projection, and asserts no recovery transaction, ledger append, artifact invalidation, or lifecycle reset occurred.
**Why blocking:** This is a required behavior with no corresponding executable coverage; the existing assertion only tests mismatch detection, not the consumer path that must avoid recovery mutation.

### 2. Mutation-owner requirement is not actually checked
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js R3
**Issue:** `TransactionalFlowManager` tracks both `updateCalls` and `mutateCalls`, but R3 only asserts `updateCalls === 1` for each entrypoint. A production change could add a second mutation owner via `flowManager.mutate(...)` while still passing these tests.
**Required change:** Assert `mutateCalls === 0` for the integration gate, final-regression, and acceptance-review recovery entrypoint fixtures in the R3 coverage.
**Why blocking:** R3 specifically requires delegation to the existing impl-repair transaction authority without another mutation owner; the current test would pass without detecting the forbidden extra owner.


## Advisory Findings

No advisory findings.