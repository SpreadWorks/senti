# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/346-gate-fail-closed/test-coverage.json`

## Blocking Findings

### 1. Unset required guardrail path is not covered
**Target:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js R2 test
**Issue:** R2 requires unset configuration for every required guardrail evaluation to produce a blocking non-PASS outcome, but the unavailable-evaluation matrix only covers `requiredAgent: null`; it does not cover an unset required guardrail configuration.
**Required change:** Add a spec-local R2 case for an unset required guardrail configuration and assert it fails, does not mark the gate done, and does not advance approval.
**Why blocking:** This is an acceptance requirement with no corresponding spec-local test coverage for one of the required evaluation classes.

### 2. Flow evidence recovery does not test non-null target rejection
**Target:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js R6 test
**Issue:** R6 requires recovered canonical evidence to be for the current phase with a null task target, but the stale-artifact rejection loop only checks phase, tree, and target state digest mismatches. It does not prove that an artifact with a non-null `taskId` is rejected when the current state target is null.
**Required change:** Add an R6 stale-artifact assertion where `providerArtifact.taskId` is non-null while `state.taskId` is null, and assert recovery rejects it without invoking the provider.
**Why blocking:** The null task target constraint is part of the acceptance requirement and currently lacks executable coverage.


## Advisory Findings

No advisory findings.