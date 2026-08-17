# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/325-fix-flow-review-scope/test-coverage.json`

## Blocking Findings

### 1. R2 RunReviewCommand execution path is not covered
**Target:** specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js
**Issue:** The R2 test exercises updateReviewRetryCounter directly, but does not execute RunReviewCommand through the production path that must resolve scope once before clearing review stop state or launching subprocesses. It also does not assert task-spec argument selection, audited broad-mode metadata, parsing/reviewRetry shared decision use, result artifact scope, or the retry bounds/delay cap.
**Required change:** Add spec-local tests around RunReviewCommand.execute with controlled collaborators/spies that prove scope resolution occurs before durable state clearing and subprocess launch, and that the resolved flow/task/broad decision drives subprocess args, artifacts, retry metadata, StepAttempt scope, and retry bounds.
**Why blocking:** R2 contains core orchestration requirements, but the current tests can pass even if RunReviewCommand.execute resolves scope at the wrong time or does not use the decision consistently.

### 2. R1 resolver edge cases are under-covered
**Target:** specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js
**Issue:** The R1 test covers stale flow cursor, a single active task review, and one ambiguous both-active case, but omits required cases for null cursor with no actionable work resolving to flow, null cursor with actionable work retaining broad/blocked, multiple active task reviews, no active review leaf, unknown currentTaskId, and task/currentTaskId mismatch with non-empty reasons.
**Required change:** Add resolver tests for each omitted R1 branch and assert the expected existing TaskScopeDecision kind or blocked/invalid decision with a non-empty reason.
**Why blocking:** The requirement defines a decision matrix; several required branches have no corresponding spec-local regression coverage.

### 3. R4 task-scoped verdict coverage only tests PASS
**Target:** specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js
**Issue:** R4 requires task-scoped PASS, ADVISORY, and FAIL to retain selected taskId, metric/outcome scope, and task-review lifecycle without mutating flow impl-review, impl-triage, or impl-repair. The test only covers task-scoped PASS and does not assert metrics/outcome scope.
**Required change:** Extend the task-scoped R4 coverage to include ADVISORY and FAIL, and assert selected taskId is retained in metrics/outcome artifacts while flow review/triage/repair steps remain unchanged.
**Why blocking:** Two required task-scoped verdict branches and the metric/outcome scope requirement are untested.

### 4. R5 pre-mutation guarantee is only partially exercised
**Target:** specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js
**Issue:** The R5 test checks that flowManager.mutate is not called, but it does not guard against subprocess launch, review stop state clearing, metrics, stepAttempts, review artifacts, runtime review state, or step status changes before returning REVIEW_SCOPE_INVALID.
**Required change:** Add spies or fixture state assertions covering subprocess launch and each listed durable surface so invalid scope proves no pre-error side effects occur.
**Why blocking:** A test could pass while the implementation still performs prohibited side effects outside flowManager.mutate before returning the invalid-scope envelope.

### 5. R6 broad-mode contract is not tested through RunReviewCommand
**Target:** specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js
**Issue:** R6 checks resolver output and target guard helper output directly, but does not test the stated command contract that impl review fails before subprocess launch without an audited broad-mode record, succeeds as broad only with a matching non-empty reason record, and returns ACTIVE_FLOW_MISMATCH before scope resolution or durable mutation for mismatched guards.
**Required change:** Add RunReviewCommand.execute-level tests for null currentTaskId with actionable work: no broad record fails before subprocess, matching broad record proceeds as broad, and mismatched expectRunId/expectIssue/expectSpec returns ACTIVE_FLOW_MISMATCH before scope resolution and mutation.
**Why blocking:** The current helper-level assertions can pass while the command violates the Issue #325 ordering and side-effect contract.


## Advisory Findings

No advisory findings.