# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/313-resume-recovery-only/test-coverage.json`

## Blocking Findings

### 1. R4 lacks recovered-root continuation coverage
**Target:** specs/313-resume-recovery-only/tests/resume-recovery-contract.test.js
**Issue:** The R4 test only verifies --expect-run-id mismatch against a normal registry active flow in the main root. It never resumes a recovery candidate and then runs status, next-action, or run from the selected candidate execution root, so the execution-root requirement can regress while this test still passes.
**Required change:** Add a spec-local test that selects a resumable recovery candidate, invokes continuation commands with cwd/execution root set to the selected executionRoot and the selected runId, and verifies a mismatched runId returns ACTIVE_FLOW_MISMATCH before command execution.
**Why blocking:** R4 explicitly requires post-resume continuation to run from the selected execution root and verify the selected runId before command work; that acceptance behavior has no direct executable coverage.


## Advisory Findings

No advisory findings.