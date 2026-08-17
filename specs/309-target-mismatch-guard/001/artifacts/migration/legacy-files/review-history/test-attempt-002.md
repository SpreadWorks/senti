# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/309-target-mismatch-guard/test-coverage.json`

## Blocking Findings

### 1. Test name lacks matching header id
**Target:** tests/target-mismatch-guard.test.js:R7
**Issue:** The file has a 'R7: ...' test name but the header does not declare R7.
**Required change:** Add R7 to the file header or rename the test.
**Why blocking:** The coverage artifact omits a requirement referenced by executable tests.

### 2. R1 dispatcher command coverage is incomplete
**Target:** specs/309-target-mismatch-guard/tests/target-mismatch-guard.test.js
**Issue:** R1 requires mismatched explicit Issue targets to prevent next-action, repair, run, finalize, and cleanup command execution, but the executable regression coverage only exercises status and next-action. The repair, run, finalize, and cleanup dispatcher paths are only mentioned in skill guidance text checks, which can pass without exercising production behavior.
**Required change:** Add the smallest executable regression coverage that invokes mismatched explicit issue targets for the missing dispatcher commands, or otherwise proves those command paths are not executed under ACTIVE_FLOW_MISMATCH.
**Why blocking:** This leaves required acceptance behavior untested for several command paths that could still execute another active flow despite the guard.

### 3. R3 canonical spec comparison is not exercised
**Target:** specs/309-target-mismatch-guard/tests/target-mismatch-guard.test.js
**Issue:** R3 requires ACTIVE_FLOW_MISMATCH responses to use canonical spec IDs for spec comparisons, but the spec mismatch test passes an already-canonical value and does not prove path-like or non-canonical spec input is normalized before reporting/comparison.
**Required change:** Add or adjust a spec mismatch assertion to use a non-canonical spec target form and assert expectedSpec/activeSpec are reported as canonical spec IDs.
**Why blocking:** An implementation could compare/report raw spec input and still pass the current tests while violating the canonical spec ID requirement.


## Advisory Findings

### 1. Coverage artifact has stale R7 file mapping
**Target:** Requirement-to-Test Coverage Artifact
**Improvement:** Update R7's requirement files list to include tests/target-mismatch-guard.test.js, or remove the R7 test name from that file if it is not intended to count there.
**Why non-blocking:** The detailed file section already exposes the mismatch, and executable R7 coverage exists; this is a traceability cleanup rather than a test design blocker.
