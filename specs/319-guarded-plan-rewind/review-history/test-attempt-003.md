# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/319-guarded-plan-rewind/test-coverage.json`

## Blocking Findings

### 1. FlowStore mutation contract is not exercised
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js
**Issue:** R2 specifically requires FlowStore to apply the flow-level rewind in one mutation and validate the candidate before save, but the tests use a fake manager whose rewindPlan directly calls applyPlanRewind and mutates an in-memory object. This can pass even if the real FlowStore does not implement the required mutation/save behavior.
**Required change:** Add a spec-local test that exercises the real FlowStore/flow manager rewind path and asserts the persisted state reflects the one-mutation rewind and invariant validation before save.
**Why blocking:** This is a static anti-pattern that bypasses the production behavior named by the acceptance requirement.

### 2. Preservation requirements are only partially covered
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js
**Issue:** R5 requires product source files, worktree and branch metadata, tasks, task steps, task requirements, task statuses, currentTaskId, runId, Issue, and spec identity to remain unchanged. The tests assert task preservation and one prior artifact file, but do not assert preservation of branch/worktree metadata, currentTaskId, runId, issue, spec, task step details, task requirements, task statuses, or product source files through the rewind path.
**Required change:** Add assertions around a successful rewind comparing these required fields and source file bytes before and after the operation.
**Why blocking:** The coverage artifact marks R5 covered, but several explicit acceptance requirements have no corresponding executable coverage.

### 3. Evidence eligibility after normal renewal is not exercised
**Target:** specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js
**Issue:** R4 requires stale evidence to be ineligible while evidence created afterward through the normal route is eligible. The test only calls isPlanEvidenceFresh with synthetic timestamps; it does not exercise renewed approval/evidence being created through the normal flow route after rewind.
**Required change:** Extend the end-to-end fixture or add a focused test that records renewed approval/evidence through the normal route after rewind and asserts it is eligible while pre-rewind evidence remains ineligible.
**Why blocking:** A key acceptance behavior has only helper-level timestamp checks and lacks route-level regression coverage.

### 4. Shared-test requirement is not represented
**Target:** Requirement-to-Test Coverage Artifact
**Issue:** R8 requires spec-local and shared tests, but the coverage artifact lists only specs/319-guarded-plan-rewind/tests/guarded-plan-rewind.test.js and no shared test file.
**Required change:** Either add the required shared test coverage to the artifact and test set, or narrow the requirement if shared tests are not actually required.
**Why blocking:** The requirement coverage artifact contradicts the stated acceptance requirement by marking R8 covered without any shared test coverage.


## Advisory Findings

No advisory findings.