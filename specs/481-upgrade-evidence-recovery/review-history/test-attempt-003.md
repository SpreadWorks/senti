# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/481-upgrade-evidence-recovery/test-coverage.json`

## Blocking Findings

### 1. Preserve coverage encodes wrong authority premise
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js:151
**Issue:** The preserve case creates evidence with `evidenceTarget: { ...target, decision: "preserve" }`, which contradicts R2/R4's requirement that reusable or preserved evidence match the current flow target authority. This makes the test expect an audit decision of `preserve` from evidence whose target authority should be rejected as mismatched.
**Required change:** Change the preserve scenario to use target-authoritative evidence and distinguish preserve through the intended production condition, not by mutating the target authority.
**Why blocking:** A test that encodes an incorrect implementation premise can force production code to accept authority-mismatched evidence, directly conflicting with R2 and R5 fail-closed behavior.

### 2. R5 missing raw log rejection is not tested at impl-gate target API
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js:170
**Issue:** The missing raw log case is only asserted by expecting `recovery(...)` construction to reject. R5 specifically requires impl-gate to fail-closed for a missing raw log and reject old/current-invalid evidence; the impl-gate API coverage only checks stale checkedPaths and authority.
**Required change:** Add a spec-local impl-gate test using `recoverUpgradeEvidenceForIntegration` with otherwise matching evidence but no `tests/.raw/upgrade.log`, asserting rejection.
**Why blocking:** The acceptance requirement explicitly assigns this fail-closed behavior to impl-gate, and current tests could pass while the shared lifecycle gate accepts evidence missing the raw log.

### 3. R5 malformed artifact and failed upgrade result are not tested at impl-gate target API
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js:170
**Issue:** Malformed `upgrade-result.json` and failed upgrade result are only covered through `UpgradeEvidenceRecovery` construction rejection. R5 requires impl-gate itself to reject malformed artifacts and failed upgrade results fail-closed.
**Required change:** Add spec-local impl-gate assertions with `recoverUpgradeEvidenceForIntegration` for malformed `upgrade-result.json` and for schema-valid evidence with a failed result, both rejecting before accepting current evidence.
**Why blocking:** Without target API coverage, the changed shared lifecycle contract can regress while these tests still pass against the lower-level recovery class.

### 4. R7 coverage artifact claims upgrade non-target path coverage that is absent
**Target:** Requirement-to-Test Coverage Artifact / specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js
**Issue:** R7 requires tests for `upgrade 非対象 path`, but the only no-upgrade case passes an empty required path list. There is no test showing changed paths outside upgrade-required areas are filtered to no required upgrade paths while continuing without upgrade artifacts.
**Required change:** Add a spec-local test for a non-upgrade-target changed path scenario, or correct the coverage artifact if that behavior is outside this spec's executable surface.
**Why blocking:** The coverage artifact marks R7 covered, but the actual test file does not cover one of R7's enumerated required scenarios.


## Advisory Findings

### 1. R4 artifact path audit could assert exact contents
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js:140
**Improvement:** Assert the complete expected `artifactPaths` set instead of only `includes`, so unexpected or missing audit path shape changes are caught more directly.
**Why non-blocking:** The current assertions still verify that both required artifact paths are recorded, so this is a precision improvement rather than missing acceptance coverage.
