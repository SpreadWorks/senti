# Spec Review Results

## Proposals

### 1. I’ll inspect the flow/review, registry, retry, dispatcher, templates, and existing tests to find places the spec’s scope misses or contradicts current behavior. I’m staying inside the provided worktree and won’t modify files.The current directory is the flow temp worktree root from the prompt, but it doesn’t contain `src/` or `docs/` directly. I’m checking the local layout now so I can locate the actual checked-out repository without leaving the worktree boundary.Git reports the worktree top as the parent directory, and `.tmp` only contains agent runtime folders. I’ll read repository files via `../...` paths from the current directory so the review is based on the actual checkout.The current implementation still has a dedicated `set-gate-retry` command and `RunReviewCommand` throws on invalid phases before envelope conversion. I’m tracing dispatcher and flow-state behavior now because short-circuit/error contracts often depend on those shared layers.### 1. Duplicate Attempt Semantics
**File:** `src/flow/commands/review.js`  
**Issue:** The review subprocess already resolves `maxAttempts` from `FLOW_DEFINITION` and `runReviewLoop()` can run an extra verification detect after the configured attempts. The spec says CLI-side enforcement is the invariant while review AI logic stays unchanged, but it does not define whether an “attempt” means a CLI invocation or an internal AI detect/fix iteration.  
**Suggestion:** Clarify the attempt unit. Either state `reviewRetry` counts only `flow run review` invocations, or bring `src/flow/commands/review.js` into scope to align/remove the internal maxAttempts loop behavior.

### 2. 2. Prompt Templates Still Encode Soft Retry Rules
**File:** `src/flow/prompts/plan/review-draft.md`  
**Issue:** The plan review prompts still instruct the AI to re-run until `maxAttempts` is reached. The spec updates the skill command reference, but not these next-action prompt templates. The same issue applies to `review-spec.md`, `review-test.md`, `impl/review.md`, and `task/review.md`.  
**Suggestion:** Add prompt-template updates to scope, especially handling `REVIEW_MAX_ATTEMPTS_EXCEEDED` and the reset recovery path, or explicitly mark prompt wording as out of scope.

### 3. 3. Set Retry Module Naming Is Ambiguous
**File:** `src/flow/lib/set-gate-retry.js`  
**Issue:** R20 changes the registry key/envelope key to `retry`, but the overview still points at `set-gate-retry.js`. The current file/class/comments/errors are gate-specific, so the spec leaves unclear whether the implementation should rename the module or keep a misleading legacy filename.  
**Suggestion:** Specify either “rename to `src/flow/lib/set-retry.js`” or “keep `set-gate-retry.js` but update class name, comments, envelope key, usage text, and tests to the new generic retry command.”

### 4. 4. Structured Error Matrix Missed
**File:** `tests/unit/flow/throw-to-envelope-codes.test.js`  
**Issue:** The spec updates `tests/unit/flow/set-gate-retry.test.js`, but this table-driven test also covers `flow set` argument error codes. New `INVALID_USAGE`, `INVALID_ACTION`, `INVALID_KIND`, and `INVALID_PHASE` behavior for `flow set retry` is not mentioned.  
**Suggestion:** Add this test file to scope and require cases for missing args, invalid action, invalid kind, invalid gate phase, invalid review phase, and old `flow set gate-retry` removal behavior.

### 5. 5. Reset-Aware Metrics Display Undefined
**File:** `src/flow/lib/get-status.js`  
**Issue:** `buildMetricsSummary()` aggregates counter deltas but does not interpret `reset:true`. If `reviewRetry` appears in status/report summaries, reset history will be displayed as raw accumulated data rather than current retry count.  
**Suggestion:** Define whether retry counters in `metricsSummary` are audit-only raw totals or reset-aware current counts. If current counts matter, update `buildMetricsSummary()` and related report tests.

### 6. 6. Post Hook Failure Contradiction
**File:** `src/flow/registry.js`  
**Issue:** R4/R22 require `updateReviewRetryCounter()` to run before step-done updates and propagate errors to the dispatcher. R21 says impl review keeps the existing “step done after run” behavior. With the current dispatcher, a thrown counter update prevents the later step-done update.  
**Suggestion:** Clarify precedence: either persist counter before step status and accept that step status is not updated on persistence failure, or mark the step done first / isolate the counter failure so R21 remains true.
