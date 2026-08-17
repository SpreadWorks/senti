# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/277-post-flow-board-candidates/test-coverage.json`

## Blocking Findings

### 1. R3 only-if gating is not actually covered
**Target:** specs/277-post-flow-board-candidates/tests/post-flow-board-candidates.test.js
**Issue:** The R3 test only checks that cleanup success, active:false, workflow.flowIntegration, and "enable" appear somewhere in the skill. It does not assert that post-flow guidance is gated to run only when all three conditions are satisfied, so wording that mentions these terms independently would pass.
**Required change:** Add a spec-local assertion that the post-flow guidance states the handling runs only when finalize-cleanup succeeded, flow get status reports active:false, and workflow.flowIntegration is "enable" as a combined gate.
**Why blocking:** R3 is a must acceptance requirement and the current test can pass without covering the critical only-if execution condition.

### 2. R4 main-repo execution is uncovered
**Target:** specs/277-post-flow-board-candidates/tests/post-flow-board-candidates.test.js
**Issue:** The R4 test verifies .sdd-forge/last-finalized-spec and the issue-log-import command, but it does not verify that the command is run from the main repo side.
**Required change:** Add an assertion for main-repo-side execution wording near the last-finalized-spec and issue-log-import guidance.
**Why blocking:** R4 explicitly requires running issue-log-import from the main repo, and that acceptance condition has no corresponding test coverage.

### 3. R5 one-import bounded candidate processing is incomplete
**Target:** specs/277-post-flow-board-candidates/tests/post-flow-board-candidates.test.js
**Issue:** The R5 test checks for data.candidates and bounded wording, but it does not assert that candidates come from exactly one issue-log-import invocation or that candidates are screened for board readiness before display/add.
**Required change:** Add assertions that the guidance uses only the bounded data.candidates array returned by one issue-log-import invocation and screens candidates for board readiness before presenting or adding them.
**Why blocking:** R5 is a must requirement, and the current test would pass without covering two core constraints that prevent unbounded or duplicated post-flow board creation.


## Advisory Findings

No advisory findings.