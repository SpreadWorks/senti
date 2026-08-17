# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/331-draft-repair-target-advisory/test-coverage.json`

## Blocking Findings

### 1. R1 Does Not Cover Result Recording Completion
**Target:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js: R1 test
**Issue:** The R1 test only constructs canonical findings through ReviewDisposition and asserts advisory ID/count. It does not exercise the result_recording path or assert that result_recording completes for a draft-questions repairTargets-only artifact.
**Required change:** Add a spec-local assertion path for R1 that records the draft-questions repairTargets-only artifact through the result_recording mechanism and verifies completion.
**Why blocking:** R1 explicitly requires both canonical advisory recording and completed result_recording, but the executable test only covers canonicalization.

### 2. R3 Preservation Is Only Counted, Not Verified
**Target:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js: R3 test
**Issue:** The R3 test asserts no blocking findings, total advisory count, and fallback IDs, but it does not assert that the advisoryFindings and repairTargets input content is preserved in the canonical advisory findings.
**Required change:** Assert the canonical advisory findings retain the input advisory and repair-target content needed by the contract, such as title, target/evidence/rationale where present, and category/classification semantics.
**Why blocking:** An implementation could drop or rewrite the actual advisory input content while preserving only count and IDs, and this test would still pass without validating the required preservation behavior.


## Advisory Findings

No advisory findings.