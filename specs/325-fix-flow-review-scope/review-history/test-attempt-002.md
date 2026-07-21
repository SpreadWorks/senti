# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/325-fix-flow-review-scope/test-coverage.json`

## Blocking Findings

### 1. R2 max-attempt scope precheck is untested
**Target:** specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js / test "R2: RunReviewCommand uses one scope decision for flow and task execution"
**Issue:** R2 requires the single impl-review scope decision to be used for the max-attempt precheck, preserving four semantic impl-review attempts per selected scope. The test covers subprocess retry normalization and flow/task command arguments, but does not create prior stepAttempts or assert that max-attempt blocking is evaluated against the resolved flow vs task scope before subprocess launch.
**Required change:** Add a spec-local regression case that seeds prior impl-review/task-review attempts and asserts the max-attempt precheck uses the resolved decision's stepId/taskId and blocks before subprocess when the selected scope is exhausted.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage for a required pre-subprocess decision use.

### 2. R6 guard coverage artifact overstates actual target-guard tests
**Target:** Requirement-to-Test Coverage Artifact R6 and specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js / test "R6: RunReviewCommand enforces broad-mode audit and target guards before scope effects"
**Issue:** R6 requires matching runId/Issue/spec guards to proceed and any mismatched guard to return ACTIVE_FLOW_MISMATCH before scope resolution or durable mutation. The executable test only covers a runId mismatch; it does not cover expectIssue or expectSpec mismatches, while the artifact marks R6 fully covered.
**Required change:** Add mismatch assertions for expectIssue and expectSpec, each verifying ACTIVE_FLOW_MISMATCH with no scope resolution, subprocess launch, or durable mutation.
**Why blocking:** The requirement coverage artifact claims coverage that the actual test file does not provide for required guard cases.


## Advisory Findings

No advisory findings.