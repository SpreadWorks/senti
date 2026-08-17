# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/347-bind-mandatory-repair-evidence/test-coverage.json`

## Blocking Findings

### 1. R3 does not cover reviewed HEAD binding
**Target:** specs/347-bind-mandatory-repair-evidence/tests/finding-disposition-policy.test.js
**Issue:** R3 requires repair evidence to bind both reviewed HEAD/tree, but the spec-local tests only model and assert reviewedTree. No test would fail if reviewed HEAD were omitted from the evidence contract or ignored by the gate.
**Required change:** Add spec-local coverage that supplies the expected reviewed HEAD value and rejects evidence whose reviewed HEAD is missing or mismatched.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage for one of its required evidence binding fields.


## Advisory Findings

No advisory findings.