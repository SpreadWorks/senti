# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-expose-semantic-deferral-exhausted-plan-gates/test-coverage.json`

## Blocking Findings

### 1. R1 lacks bounded-read coverage
**Target:** specs/318-expose-semantic-deferral-exhausted-plan-gates/tests/plan-gate-semantic-deferral.test.js
**Issue:** The R1 test only verifies read-only behavior for a normal small source artifact. It does not create an artifact larger than 1 MiB or otherwise assert that exhausted draft/spec gate inspection uses the bounded source-artifact read limit instead of reading the full durable source.
**Required change:** Add a spec-local test case that uses an oversized canonical gate source and asserts the bounded-read/classification behavior required by R1.
**Why blocking:** R1 explicitly requires inspection to read at most 1 MiB through the existing bounded reader; the current tests could pass with an implementation that reads the entire source artifact.

### 2. R6 get-next-action recovery exposure is untested
**Target:** specs/318-expose-semantic-deferral-exhausted-plan-gates/tests/plan-gate-semantic-deferral.test.js
**Issue:** The R6 test exercises `senti flow set retry reset gate` directly, but does not verify guarded `get next-action` behavior for task-impl or integration when retries are exhausted. It therefore misses the requirement that recoveryPossible is true only when the current evidence fingerprint differs from the latest baseline and that the exposed recovery command remains the specified reset command.
**Required change:** Add spec-local task-impl and integration next-action cases for changed and unchanged evidence fingerprints, asserting recoveryPossible and the exposed recovery command contract before executing the reset command.
**Why blocking:** A core acceptance requirement for R6 concerns the next-action recovery surface, and the current tests could pass even if get-next-action never exposes or incorrectly exposes task/integration retry recovery.


## Advisory Findings

No advisory findings.