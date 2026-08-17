# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/345-required-hook-failure-policy/test-coverage.json`

## Blocking Findings

### 1. Required post-hook failures are not asserted to fail the caller
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js: R2/R3
**Issue:** R3 requires any required hook business failure to produce a typed caller failure and not be converted into ok:true, warning-only, or follow-up-only success. The business-failure matrix in R3 only exercises required pre-hooks. The only required post-hook failure test, R2, asserts outcome fields but never asserts result.ok is false or that the caller received the typed failure.
**Required change:** Add a spec-local assertion or case for a required post-hook business failure that verifies result.ok is false and the typed required failure is exposed to the caller.
**Why blocking:** An implementation could still treat required post-hook failures as successful lifecycle results while attaching outcome metadata, and these tests would not catch it.

### 2. Integrity hard failures are only tested for advisory policy
**Target:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js: R5
**Issue:** R5 says import failure, invalid register(api), invalid FlowCommandHook inheritance, missing snapshot module, and snapshot metadata mismatch remain hard failures regardless of hook policy. The integrityCases table only uses failurePolicy: "advisory" for these cases.
**Required change:** Exercise the same integrity hard-failure cases with failurePolicy: "required" as well, or parameterize the existing cases over both policies.
**Why blocking:** A regression that only normalizes required-policy integrity failures, or otherwise handles required-policy integrity differently from advisory, would pass the current tests despite violating R5.


## Advisory Findings

No advisory findings.