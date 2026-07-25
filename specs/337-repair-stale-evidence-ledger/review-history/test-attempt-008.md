# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/337-repair-stale-evidence-ledger/test-coverage.json`

## Blocking Findings

### 1. R6 lacks fail-closed coverage for malformed evidence recovery mutation
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Issue:** The malformed evidence case only calls `checkIntegrationTestArtifacts()` and asserts `ok === false`; it never exercises a recovery path or verifies that malformed evidence cannot create/resume a refresh transaction. A broken implementation could still mutate during malformed-evidence recovery and these tests would pass.
**Required change:** Add a spec-local assertion that a malformed evidence entrypoint fails closed without creating `impl-repair-transaction.json`, changing the ledger, or moving lifecycle state.
**Why blocking:** R6 explicitly requires malformed evidence to fail closed without recovery mutation, and the current tests do not cover that recovery-mutation behavior.

### 2. R5 retry tests do not verify identical transaction roll-forward
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js
**Issue:** The durable-boundary retry matrix checks a single appended ledger entry and current hash, but it does not compare the pending transaction identity/staged artifacts before retry with the committed ledger/delta/invalidation effects after retry for each boundary. An implementation could rebuild a different transaction on retry while still appending one current-hash entry.
**Required change:** For each injected durable boundary, capture the pending owned transaction after failure and assert the retry commits that same transaction's staged artifact set/invalidation data without replacing it.
**Why blocking:** R5 requires retry to roll the identical owned transaction forward exactly once or fail closed; current coverage only proves no duplicate ledger entry, not transaction identity preservation.


## Advisory Findings

No advisory findings.