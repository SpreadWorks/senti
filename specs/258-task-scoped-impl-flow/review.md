# Code Review Results

### 1. 1. Share Broad-Mode History Limits
**File:** `src/lib/constants.js`  
**Issue:** `50` is duplicated as `MAX_REPORT_BROAD_MODE_HISTORY_ROWS` in `src/flow/commands/report.js` and `MAX_STATUS_BROAD_MODE_HISTORY` in `src/flow/lib/get-status.js`. These appear to represent the same bounded history policy.  
**Suggestion:** Export a shared constant such as `BROAD_MODE_HISTORY_MAX_ENTRIES` from `src/lib/constants.js` and import it in both report/status code.

### 2. 2. Rename Ambiguous Promotion Helper
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** `promoteTaskScope()` sounds like it promotes “scope”, but it actually promotes the next pending task and its first pending step. The name obscures the state mutation.  
**Suggestion:** Rename it to something more behavioral, e.g. `promoteNextPendingTaskStep()` or `promoteNextTaskAndFirstStep()`.

### 3. 3. Extract Repeated Task Cursor Failure Construction
**File:** `src/flow/lib/run-review.js`  
**Issue:** `TASK_CURSOR_REQUIRED` envelope construction is repeated here and in `src/flow/lib/run-gate.js` with only command/action/context differences. This makes future changes to the failure shape easy to miss.  
**Suggestion:** Add a small local helper in `run-review.js`, similar to `taskCursorRequiredGateFailure()` in `run-gate.js`, so the review preflight path has one named failure builder.

### 4. 4. Simplify Task Review Preflight Naming
**File:** `src/flow/lib/run-review.js`  
**Issue:** `IMPLEMENTATION_REVIEW_PHASE` is introduced only as the string `"impl"`, while other code still uses step names like `"review"` and `"gate-impl"`. The constant name describes a phase concept, but `"impl"` is also now part of `VALID_REVIEW_PHASES`, so the distinction is easy to blur.  
**Suggestion:** Rename it to `IMPL_REVIEW_PHASE` or `DEFAULT_REVIEW_PHASE_KEY` to match how it is used by `persistedPhaseKey()` and CLI argument filtering.

### 5. 5. Avoid Unused Broad History Timestamp in Report Text
**File:** `src/flow/commands/report.js`  
**Issue:** `broadModeHistory` stores a capped `ts` field, but `formatText()` never renders it. If the structured report requires it, that is fine; otherwise this is dead report-row data.  
**Suggestion:** Either include `ts` in the text output for audit usefulness, or omit it from the mapped report row if only JSON consumers need the raw bounded entries elsewhere.
