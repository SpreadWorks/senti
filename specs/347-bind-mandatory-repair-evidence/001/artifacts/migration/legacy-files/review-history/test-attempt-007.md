# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/347-bind-mandatory-repair-evidence/test-coverage.json`

## Blocking Findings

### 1. R3/R4 do not statically prove repair diff binding to the evaluated target state
**Target:** specs/347-bind-mandatory-repair-evidence/tests/finding-disposition-policy.test.js:90
**Issue:** The tests model `repairDiff` only as an arbitrary `repairRef.diffSha256` value and assert acceptance/rejection based on that field, but they do not provide or assert any evaluated target-state diff/hash source for the gate to compare against. This allows an implementation to accept any evidence-carried diff token as long as it matches itself, without exercising production behavior that binds repair evidence to the actual evaluated target state.
**Required change:** Add spec-local coverage where `evaluateGate` is given the current/evaluated repair diff or equivalent production target-state input, and assert evidence is accepted only when `repairRef.diffSha256` matches that target-state diff and rejected when it does not.
**Why blocking:** R3 requires the gate to accept evidence only when fingerprint, reviewed tree, repair diff, and validating test result each match the current finding and evaluated target state; the current test design does not exercise the target-state side of the repair diff comparison.

### 2. R4 stale evidence test encodes an unsupported timestamp premise
**Target:** specs/347-bind-mandatory-repair-evidence/tests/finding-disposition-policy.test.js:95
**Issue:** The `stale timestamp` case expects evidence to be rejected solely because `timestamp` is old. The requirements define stale evidence in terms of mismatch with the current finding and evaluated target state, specifically fingerprint/tree/diff/test-result binding. Timestamp age is not one of the required validation values and is not sufficient by itself to prove staleness.
**Required change:** Replace the timestamp-only stale case with a target-state mismatch case, such as evidence whose reviewed HEAD/tree or reviewedTree no longer matches the evaluated target state.
**Why blocking:** A test that requires timestamp-age rejection contradicts the specified gate contract and can force an incorrect implementation premise unrelated to the required evidence binding.


## Advisory Findings

No advisory findings.