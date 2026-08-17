# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/481-upgrade-evidence-recovery/test-coverage.json`

## Blocking Findings

### 1. R4 audit coverage can be satisfied by test-only forceDecision
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js:136
**Issue:** The preserve/reuse/regenerate/missing/stale audit test injects `forceDecision: entry.decision`, so the test can pass even if production recovery never classifies those states correctly or never records the real selected decision. This is a static anti-pattern that bypasses production behavior for a required audit contract.
**Required change:** Remove the test-only forced decision path from the audit assertions and create real fixture states that cause production recovery to select each required decision, then assert the resulting audit fields.
**Why blocking:** R4 requires recording which recovery owner decision was selected. A test that supplies the expected decision as input does not exercise that production selection or audit behavior.

### 2. R5 fail-closed cases are not all covered
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js:151
**Issue:** R5 requires fail-closed rejection for current required path mismatch, missing raw log, malformed artifact, failed upgrade result, and authority mismatch. The executable R5 test covers malformed artifact, missing raw log, and failed result, but does not cover current required path mismatch or authority mismatch in the impl-gate fail-closed path. Authority mismatch appears only in an R2 regeneration test, which expects regeneration rather than rejection.
**Required change:** Add spec-local R5 tests that assert impl-gate/recovery validation rejects checkedPaths that do not match current required paths and rejects recoveryAuthority target/fingerprint mismatch as stale evidence rather than accepting it as current evidence.
**Why blocking:** A must requirement has incomplete spec-local regression coverage for two explicit fail-closed rejection conditions.

### 3. R6 repeated recovery test contradicts the requirement premise
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js:169
**Issue:** R6 requires multiple stale recovery executions to avoid re-blocking impl-gate because canonical regeneration supplies current evidence. The test deletes both upgrade-result.json and the raw log after each recovery, then expects regeneration again. That models externally removed evidence, not repeated stale recovery preserving current evidence through impl-gate.
**Required change:** Change the R6 scenario so the first stale recovery regenerates current evidence, the next recovery/impl-gate pass runs against that current evidence without deleting it, and the assertion verifies it does not fail due to missing upgrade-result.json.
**Why blocking:** The current test encodes an incorrect implementation premise for R6 and would not verify the stated no re-closure behavior.


## Advisory Findings

### 1. R1 next-step assertion is implicit
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js:60
**Improvement:** Assert the bypass result advances to the next lifecycle step, not only that the command did not run and no artifact exists.
**Why non-blocking:** R4 already checks `nextActiveStep`, so this is a useful strengthening of R1 rather than missing core coverage.
