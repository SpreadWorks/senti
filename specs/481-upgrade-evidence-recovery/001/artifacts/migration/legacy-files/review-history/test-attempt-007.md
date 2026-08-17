# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/481-upgrade-evidence-recovery/test-coverage.json`

## Blocking Findings

### 1. Missing audit evidence persistence coverage
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js R4 tests
**Issue:** R4 requires the recovery owner to record the decision, fingerprint, checkedPaths, artifact paths, and next active step in flow audit evidence. The tests only inspect returned in-memory result/audit fields and do not verify that flow audit evidence is actually written or updated.
**Required change:** Add a spec-local assertion that reads the produced flow audit evidence artifact/log and verifies decision, currentFingerprint, checkedPaths, artifactPaths, and next active step are recorded there.
**Why blocking:** An implementation could return the expected object while never recording audit evidence, leaving an acceptance requirement without executable coverage.

### 2. Raw log match condition is not covered
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js R2/R5 coverage
**Issue:** R2 requires reuse/preserve only when the existing raw upgrade log matches the upgrade-result evidence. The tests cover a missing raw log, but not a mismatched rawLogPath or otherwise non-matching raw log evidence.
**Required change:** Add a test where upgrade-result.json points to or claims a raw log that does not match the current raw log evidence, and assert reuse/preserve is rejected or regeneration occurs before impl-gate.
**Why blocking:** Old or unrelated raw logs could be accepted as current evidence without violating any existing test.

### 3. Regenerated artifact current checkedPaths not directly verified
**Target:** specs/481-upgrade-evidence-recovery/tests/upgrade-evidence-recovery.test.js R3 tests
**Issue:** R3 requires regenerated upgrade-result.json to contain current checkedPaths. The regeneration test asserts only that artifacts exist; it relies on the test stub writing the expected default checkedPaths rather than verifying the resulting artifact content against currentRequiredPaths.
**Required change:** After regeneration, read upgrade-result.json and assert its checkedPaths exactly equal the current required paths used for recovery.
**Why blocking:** An implementation could regenerate an artifact with stale or wrong checkedPaths and still satisfy the current R3 test assertions.

### 4. Shared lifecycle contract regression coverage artifact is inconsistent
**Target:** Requirement-to-Test Coverage Artifact for R7
**Issue:** R7 explicitly requires updated regression tests for the changed shared lifecycle contract, but the coverage artifact lists only the spec-local test file. No shared lifecycle contract regression test file is identified.
**Required change:** Either add/update the relevant shared lifecycle contract regression test and list it in the coverage artifact, or narrow R7 if no shared lifecycle contract changed.
**Why blocking:** The coverage artifact claims R7 is covered while omitting a required category of regression coverage stated by R7 itself.


## Advisory Findings

No advisory findings.