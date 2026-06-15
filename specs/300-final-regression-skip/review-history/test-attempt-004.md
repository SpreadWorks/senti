# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/300-final-regression-skip/test-coverage.json`

## Blocking Findings

### 1. R1 argv equality is only tested by length mismatch
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js:221
**Issue:** The stale identity matrix mutates `artifact.regression.argv` from `["sh", SCRIPT_PATH]` to `["sh"]`, which proves length mismatch only. R1 specifically requires same length and same string at each index, so an implementation that checks only array length could still pass these tests.
**Required change:** Add a spec-local stale-evidence case where `argv` has the same length as the expected identity but a different string at one index, and assert full regression runs.
**Why blocking:** R1 has no executable coverage for one of its explicit exact-comparison rules, leaving a concrete implementation premise untested.

### 2. R1 env and metadata primitive value equality is not exercised
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js:222
**Issue:** The identity stale cases change expected empty `env`/`metadata` objects to non-empty objects. That covers extra-key rejection, but not exact JSON primitive value comparison for an existing key after key sorting. An implementation that compares only key sets, or mishandles primitive values, could pass.
**Required change:** Add a passing evidence setup with non-empty `env` and `metadata`, then stale cases that keep the same keys but change primitive values and assert full regression runs.
**Why blocking:** R1 explicitly requires exact key set plus exact JSON primitive values for `env` and `metadata`; current tests do not cover value equality.


## Advisory Findings

### 1. Extra evidence set case also changes fingerprint
**Target:** specs/300-final-regression-skip/tests/final-regression-skip.test.js:247
**Improvement:** The case named `extra stale evidence file` writes the extra file after capturing evidence, so it exercises a fingerprint mismatch rather than a pure extra-file set mismatch. Add or adjust a case where evidence contains an unchanged extra path that is not currently trigger-relevant.
**Why non-blocking:** R1 already has adjacent set-equality coverage for missing and path mismatch plus stale fingerprint rejection, but a cleaner pure extra-entry case would make the intent harder to regress.
