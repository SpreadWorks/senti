# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/313-resume-recovery-only/test-coverage.json`

## Blocking Findings

### 1. R4 does not verify that guarded run mismatch happens before step execution
**Target:** specs/313-resume-recovery-only/tests/resume-recovery-contract.test.js: R4 guarded continuation tests
**Issue:** The tests assert ACTIVE_FLOW_MISMATCH for status, next-action, and run, but the run-command cases do not include any observable step side effect or sentinel that would prove the mismatch is returned before step execution begins.
**Required change:** Add a minimal regression assertion around the run-command mismatch that would fail if the selected phase/step executed, such as checking no flow state/status transition, artifact, or other step side effect is produced before ACTIVE_FLOW_MISMATCH.
**Why blocking:** R4 explicitly requires the mismatch to be returned before step execution. Current tests could pass with an implementation that performs step work and only reports ACTIVE_FLOW_MISMATCH afterward.


## Advisory Findings

### 1. R1 coverage is narrower than the requirement wording
**Target:** specs/313-resume-recovery-only/tests/resume-recovery-contract.test.js: R1 normal active-flow status ignores recovery discovery candidates
**Improvement:** Consider adding a normal flow start or continuation entrypoint case, not only `flow get status`, to make the `/senti.flow` wording explicit.
**Why non-blocking:** The existing test still exercises the key registry-vs-recovery separation through normal active-flow status, and R6 adds coverage for retained normal public surfaces.
