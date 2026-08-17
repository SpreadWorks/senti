# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/481-upgrade-evidence-recovery/test-coverage.json`

## Blocking Findings

### 1. Missing spec-local coverage for fingerprint and authority matching
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js
**Issue:** R2 and R5 require evidence to match the current repair fingerprint and flow target authority, and to reject authority-mismatched old evidence. The test fixture never writes fingerprint or authority metadata into upgrade-result.json, and no test creates mismatched fingerprint or target authority evidence.
**Required change:** Add spec-local tests that create otherwise-valid upgrade evidence with stale fingerprint and mismatched target authority, then assert it is not reused/preserved and is rejected or regenerated according to the canonical path/impl-gate contract.
**Why blocking:** The coverage artifact marks R2/R5/R7 covered, but the actual tests do not exercise two required evidence identity checks. Implementation could ignore fingerprint/authority and still pass.

### 2. Missing fail-closed coverage for checkedPaths mismatch at impl-gate
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js
**Issue:** R5 specifically requires impl-gate to reject checkedPaths that do not match current required paths. The only checkedPaths mismatch case is in R3, where recovery regenerates evidence; no test verifies impl-gate fail-closed rejection of stale checkedPaths as current evidence.
**Required change:** Add a spec-local impl-gate/recovery-owner contract test that presents stale checkedPaths as evidence and asserts it cannot be accepted as current evidence.
**Why blocking:** A critical fail-closed requirement could be unimplemented while the current tests still pass through regeneration-only behavior.

### 3. R4 decision audit coverage does not cover all required decision variants
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js
**Issue:** R4 requires audit evidence to record whether the recovery owner selected preserve, reuse, regenerate, missing, or stale. Current assertions verify only a regenerated result’s fingerprint, target, next step, and artifact paths; they do not assert audit records for missing or stale decisions, and preserve/reuse are treated as interchangeable via regex.
**Required change:** Add assertions covering the audit evidence fields for each required decision category: preserve, reuse, regenerate, missing, and stale, or split them into focused tests if the API exposes them separately.
**Why blocking:** The required audit contract can be partially or incorrectly implemented while satisfying the current broad assertions.

### 4. R7 shared lifecycle contract regression is not represented
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js
**Issue:** R7 requires updated regression coverage for the changed shared lifecycle contract, but the provided spec-local test file only tests UpgradeEvidenceRecovery directly. There is no test exercising the shared lifecycle/impl-gate integration surface that consumes the recovered evidence.
**Required change:** Add or update a spec-local regression test that exercises the changed shared lifecycle contract through the lifecycle/impl-gate integration path, not only the recovery helper.
**Why blocking:** The coverage artifact claims R7 is covered, but the actual test file does not cover the shared contract regression required by the acceptance criteria.


## Advisory Findings

### 1. Decision naming is underspecified
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js
**Improvement:** Avoid `assert.match(result.decision, /preserve|reuse/)` when preserve and reuse have distinct semantics; use separate fixtures if both states are externally observable.
**Why non-blocking:** This is mostly precision and maintainability unless the API contract requires distinguishing those states in this specific test.
