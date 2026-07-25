# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/337-repair-stale-evidence-ledger/test-coverage.json`

## Blocking Findings

### 1. R9 claims broad entrypoint and mismatch coverage but test only exercises one direct helper path
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js R9 test and coverage artifact
**Issue:** The coverage artifact marks R9 covered, but the executable test does not cover integration gate, acceptance-review, explicit rewind-test-evidence, shared unit/CLI lifecycle behavior, malformed evidence, or spec/issue target mismatches. It mostly asserts object construction and a final-regression helper failure path.
**Required change:** Add spec-local executable coverage for each R9 category or narrow the artifact so uncovered requirements are not marked covered.
**Why blocking:** R9 is an acceptance requirement requiring spec-local and affected shared/CLI coverage; the artifact contradicts the actual test file.

### 2. R3 stale evidence entrypoints are not covered
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js R3 test
**Issue:** The test calls StaleTestEvidenceRefresh.recover directly with sourceStep final-regression. It does not exercise integration gate, final-regression, or acceptance-review entrypoint APIs, so it cannot prove those entrypoints delegate to the existing impl-repair transaction authority.
**Required change:** Add executable tests that invoke the actual integration gate, final-regression, and acceptance-review stale evidence entrypoints and assert they use the same impl-repair transaction authority.
**Why blocking:** R3 requires entrypoint delegation behavior, but the current test bypasses the entrypoints under test.

### 3. R2 does not verify required delta and invalidation contents
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js R2 test
**Issue:** The R2 test checks ledger length, previousHash, and currentHash, but it never asserts that the changed-path delta is non-empty or that invalidation records equal the transaction's staged artifact set.
**Required change:** Extend R2 coverage to read the appended entry's delta and invalidation records and compare them with the staged transaction artifact set.
**Why blocking:** Two explicit must-level R2 acceptance conditions have no corresponding assertions.

### 4. R6 current and malformed evidence cases are not actually exercised
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js R6/R9 tests
**Issue:** The tests do not invoke production behavior for valid current evidence, malformed evidence, inconsistent fingerprints, changed material authority, spec mismatch, or issue mismatch. The R9 test creates a local Map named unchanged and asserts its size, which would pass without exercising production recovery behavior.
**Required change:** Replace the inert Map/object assertions with calls through the relevant production consumers for current evidence and malformed/mismatch cases, asserting normal path or fail-closed no-mutation behavior.
**Why blocking:** R6 contains multiple must-level fail-closed and no-recovery cases; the current test includes a static anti-pattern that passes without exercising production behavior.

### 5. R7 does not prove normal flow regeneration after recovery
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js R7 test
**Issue:** The R7 test only asserts ledger tail hash and that downstream steps are pending after recovery. It does not run or simulate test-execute, test-result-review, impl-review, impl-gate, retro, and acceptance-review regeneration, nor does it verify absence of impl-repair ledger schema rejection across those stages.
**Required change:** Add executable lifecycle coverage that advances through the named post-recovery steps and verifies regenerated current evidence is accepted without ledger schema rejection.
**Why blocking:** R7's core acceptance behavior is not tested by checking pending statuses immediately after recovery.

### 6. R8 public behavior of explicit entrypoints is not covered
**Target:** specs/337-repair-stale-evidence-ledger/tests/stale-evidence-repair-transaction.test.js R8 test
**Issue:** The R8 test asserts the projection returned by direct StaleTestEvidenceRefresh.recover, but R8 requires public behavior for integration gate, final-regression, acceptance-review, and explicit rewind-test-evidence, including exact target guards and structural validation.
**Required change:** Add tests through each public entrypoint, including rewind-test-evidence, and assert preserved result fields, next step, exact target guards, and fail-closed structural validation.
**Why blocking:** The direct helper call does not cover the public API contract required by R8.


## Advisory Findings

No advisory findings.