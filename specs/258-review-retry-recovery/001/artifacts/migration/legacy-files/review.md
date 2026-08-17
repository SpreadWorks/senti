# Code Review Results

### 1. 1. Centralize Review Stop Projection
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** `applyReviewStopProjection()` manually copies many fields from `reviewStop` onto `result`. This creates a second flattened shape alongside the nested `reviewStop` object and makes future field additions easy to miss.  
**Suggestion:** Either expose only `result.reviewStop` or add a small method/helper on the review-stop view that returns the flattened projection. If the flattened fields are required for compatibility, use a single projection object and `Object.assign()` to avoid hand-copy drift.

### 2. 2. Avoid Hard-Coded Error Code Derivation
**File:** `src/flow/lib/run-review.js`  
**Issue:** `failure.classification.toUpperCase()` assumes every classification string maps directly to a valid envelope error code. That spreads error-code formatting knowledge into the caller.  
**Suggestion:** Move the error-code mapping behind the failure abstraction, for example `failure.toEnvelopeCode()`, and call that from `RunReviewCommand`. That keeps classification naming independent from external envelope codes.

### 3. 3. Bound Retry Delay Input
**File:** `src/flow/lib/run-review.js`  
**Issue:** `retryCount` is explicitly bounded, but `retryDelayMs` still accepts any value from `opts.retryDelayMs`, including negative, non-finite, or extremely large values. Under the bounded-resource-usage guardrail, retry behavior should have explicit bounds for both count and waiting cost.  
**Suggestion:** Add a `normalizeReviewSubprocessRetryDelayMs()` helper with a documented maximum and minimum, similar to `normalizeReviewSubprocessRetryCount()`, and use it in `runCmdWithRetry()`.

### 4. 4. Reuse CLI Phase Normalization
**File:** `src/flow/commands/review.js`  
**Issue:** `parseReviewCliArgsForError()` parses only enough CLI state for error reporting, but it allows any raw `--phase` value to flow into `classifyReviewCommandError()`, which can produce misleading recovery commands for invalid phase values.  
**Suggestion:** Normalize or validate the parsed phase using the same phase rules as the main review command path before building the recovery command. Fall back to `null` or the default phase when the phase is invalid.
