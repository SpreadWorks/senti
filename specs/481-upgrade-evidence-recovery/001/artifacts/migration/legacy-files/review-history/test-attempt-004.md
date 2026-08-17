# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/481-upgrade-evidence-recovery/test-coverage.json`

## Blocking Findings

### 1. R6 repeated stale recovery scenario is not actually covered
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js:188
**Issue:** The R6 test starts from missing evidence, regenerates once, then verifies a normal reuse path. It does not make evidence stale across multiple recovery attempts, and it does not verify the impl-gate path after repeated stale recovery.
**Required change:** Change or add a spec-local R6 test that runs recovery multiple times from stale evidence states and then verifies impl-gate accepts the regenerated current upgrade-result.json/raw log rather than re-blocking on missing upgrade-result.json.
**Why blocking:** R6 explicitly requires repeated stale recovery behavior and impl-gate non-reclosure; the current test can pass without exercising that requirement.

### 2. R5 authority mismatch can pass without testing authority rejection
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js:153
**Issue:** The impl-gate stale authority case also uses a stale fingerprint, so an implementation that rejects only fingerprint mismatches and ignores target authority mismatch would still pass.
**Required change:** Add or adjust an R5 impl-gate case with current checkedPaths and current fingerprint but mismatched target authority, and assert it is rejected.
**Why blocking:** R5 requires authority mismatch to fail closed; the current test encodes a masking condition that does not independently exercise production authority validation.


## Advisory Findings

No advisory findings.