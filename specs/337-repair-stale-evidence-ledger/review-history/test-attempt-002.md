# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/337-repair-stale-evidence-ledger/test-coverage.json`

## Blocking Findings

### 1. Malformed evidence is asserted as non-stale instead of fail-closed
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js: R9 malformed evidence case
**Issue:** The test expects `StaleTestEvidenceMismatch.detect(...)` to return `null` when an artifact has `repairFingerprint: "not-a-hash"`. R6 requires malformed evidence to fail closed without recovery mutation, so this encodes the opposite behavior as acceptable.
**Required change:** Change the malformed evidence case to assert a fail-closed error/result and verify no recovery mutation occurs.
**Why blocking:** A test that accepts malformed evidence as current/non-stale would pass an implementation that violates R6.

### 2. Explicit rewind stale recovery path is not covered
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js: R8/R9 coverage
**Issue:** The only `RunRewindTestEvidenceCommand` assertion covers the missing-target guard (`STALE_TEST_EVIDENCE_TARGET_REQUIRED`). There is no executable test that explicit `rewind-test-evidence` performs stale evidence recovery while preserving existing result fields, next step, target guards, and structural validation.
**Required change:** Add a spec-local test that invokes explicit rewind-test-evidence with the required target, stale evidence, and asserts the successful recovery projection and lifecycle effects.
**Why blocking:** R8 and R9 require all stale recovery entrypoints, including explicit rewind-test-evidence, to be covered; the coverage artifact marks this as covered but the actual test only covers a guard failure.

### 3. Foreign pending transaction and changed material authority fail-closed cases are missing
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js: R6 coverage
**Issue:** R6 requires fail-closed behavior without recovery mutation for foreign pending transactions and changed material authority. The tests cover run/spec/issue target mismatches after a pending transaction, but do not cover a pending transaction owned by another authority or a material authority change.
**Required change:** Add tests that seed a foreign pending transaction and a changed material authority condition, then assert recovery fails closed and ledger/transaction/artifacts are not mutated.
**Why blocking:** These are explicit R6 acceptance cases with no corresponding spec-local coverage despite the artifact marking R6 covered.


## Advisory Findings

No advisory findings.