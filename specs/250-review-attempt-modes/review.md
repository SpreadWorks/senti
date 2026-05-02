# Code Review Results

### 1. I’ll inspect the touched file around `getReviewMaxAttempts` and its call sites so the proposals stay grounded in the actual changed code and within the requested scope.The provided cwd appears to be a temporary work directory without `src/flow/commands/review.js` present. I’ll verify the local layout, but I can still review from the supplied diff if the repo files are not available here.### 1. Require explicit max-attempt context
**File:** `src/flow/commands/review.js`  
**Issue:** `getReviewMaxAttempts(phase, context = {})` silently allows callers to omit the flow/mode context. That weakens R16 because draft/spec/test max-attempt resolution can accidentally fall back to default behavior instead of loaded `flow.autoApprove` or an explicit mode input.  
**Suggestion:** Remove the default `{}` and rename the parameter to something more specific, such as `flow` or `attemptContext`. Update tests/callers to pass an explicit object.

### 2. 2. Remove the generic review fallback for phase max attempts
**File:** `src/flow/commands/review.js`  
**Issue:** `REVIEW_PHASE_NODE_MAP[phase] || "review"` masks invalid or unsupported phases. For review phases with mode-specific attempt behavior, falling back to `"review"` can hide bugs and return an attempt policy for the wrong node.  
**Suggestion:** Fail fast when `phase` is not in `REVIEW_PHASE_NODE_MAP`, or require all supported phases to be explicitly mapped before calling `resolveNodeFor`.

### 3. 3. Clarify attempts versus retries naming
**File:** `src/flow/commands/review.js`  
**Issue:** The resolved value is named `maxAttempts`, but it is passed as `maxRetries`. If `runReviewLoop` treats retries and attempts differently, this naming mismatch can obscure off-by-one behavior.  
**Suggestion:** Standardize the naming at the call boundary, either by renaming the local to `maxRetries` after conversion or by aligning `runReviewLoop` to accept `maxAttempts` if that is the domain term.

### 4. 1. Hoist plan review retry configuration
**File:** `src/flow/definition.js`
**Issue:** `createPlanReviewNode()` recreates the same `maxAttempts` lookup object on every call, and the retry policy is embedded inside the factory body.
**Suggestion:** Move the lookup to a frozen module-level constant such as `PLAN_REVIEW_MAX_ATTEMPTS_BY_ID`. This centralizes the policy and avoids repeated allocation.

### 5. 2. Rename misleading plain-object helper
**File:** `src/flow/definition.js`
**Issue:** `isExactPlainObject()` only checks that a value is a plain object; the exact `auto`/`manual` key validation happens separately. The name overstates what the helper guarantees.
**Suggestion:** Rename it to `isPlainObject()` or fold the key check into the helper so the name matches the behavior.

### 6. 3. Freeze maxAttempts value objects after validation
**File:** `src/flow/definition.js`
**Issue:** `ScalarMaxAttempts` and `ModeMaxAttempts` validate invariants in their constructors, but their public fields remain mutable afterward.
**Suggestion:** Call `Object.freeze(this)` at the end of each constructor, or otherwise make the stored values immutable, so validated retry limits cannot be changed later.

### 7. 1. Validate `maxAttempts` before emitting it
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** The result now exposes `maxAttempts: derived.maxAttempts` without checking that it is actually a resolved numeric value. If `deriveNextAction()` ever returns `undefined`, an object, `NaN`, or another invalid value for an active step, retry consumers may receive an unbounded or unusable retry limit. This conflicts with R5/R10 and the bounded-resource-usage guardrail.  
**Suggestion:** Before constructing the response, assert that `derived.maxAttempts` is a positive safe integer for active next-action responses. Throw a clear internal error if it is not resolved, for example:

```js
if (!Number.isSafeInteger(derived.maxAttempts) || derived.maxAttempts < 1) {
  throw new Error(`INVALID_MAX_ATTEMPTS: ${target.scope}.${target.stepId} did not resolve numeric maxAttempts`);
}
```

### 8. 1. Normalize retry context before resolving scope
**File:** `src/flow/lib/run-gate.js`
**Issue:** `resolveRetryMax(context = {}, phase)` supports both `ctx`-style objects and raw flow-state objects via `context.flowState || context`, but scope detection only checks `context.flowState?.currentTaskId`. Passing a flow state directly with `currentTaskId` would incorrectly select `FLOW_DEFINITION`.
**Suggestion:** Normalize once, then use the normalized state for both scope and max-attempt resolution:

```js
const flowState = context.flowState || context;
const scope = context.scope || (flowState?.currentTaskId != null ? "task" : "flow");
...
return node?.resolveMaxAttempts(flowState) ?? 5;
```

### 9. 2. Rename `context` to clarify accepted shape
**File:** `src/flow/lib/run-gate.js`
**Issue:** `resolveRetryMax(context = {}, phase)` now accepts a mixed shape: sometimes a runtime context, sometimes flow state. The generic name makes it easy to pass the wrong object and miss task-scope resolution.
**Suggestion:** Rename the parameter or split normalization into a named local such as `retryContext` and `flowState`. For example:

```js
export function resolveRetryMax(retryContext = {}, phase) {
  const flowState = retryContext.flowState || retryContext;
  ...
}
```

This makes the flow-state fallback intentional and easier to review.

### 10. 1. Remove Duplicate Completion Instruction
**File:** `src/flow/prompts/plan/review-spec.md`  
**Issue:** The prompt tells the agent to run `sdd-forge flow set step review-spec done` both in the `verdict=PASS` branch and again in the final “On complete” line.  
**Suggestion:** Keep the command in one place only, preferably the `verdict=PASS` branch, and remove the duplicate “On complete” line or reword it to avoid repeating the exact action.

### 11. 2. Normalize The Retry-Limit Heading
**File:** `src/flow/prompts/plan/review-spec.md`  
**Issue:** The heading `resolved numeric maxAttempts reached` is awkward and inconsistent with the surrounding imperative prompt style.  
**Suggestion:** Use a clearer heading such as `**maxAttempts reached:**` and keep the resolved numeric detail in the sentence: `When the resolved numeric maxAttempts from next-action is reached, STOP...`

### 12. 1. Normalize Retry Limit Wording
**File:** `src/flow/prompts/plan/review-test.md`

**Issue:** The phrase “resolved numeric maxAttempts from next-action” is repeated awkwardly, and the bullet label `resolved numeric maxAttempts reached` is inconsistent with the surrounding title-style labels.

**Suggestion:** Define the limit once in the review-loop bullet, then use a cleaner label:

```md
- **Review loop:** repeat review -> fix -> re-review until verdict=PASS or the resolved numeric maxAttempts from next-action is reached.
- **Max attempts reached:** STOP and return control to the user. Do not set step done.
```

### 13. I’ll inspect the touched file around the changed cache path so the review is grounded in the existing patterns and not just the single-line diff.The `.tmp` working directory does not contain `src/metrics/commands/token.js`, so I’m treating the supplied diff as the review source of truth.### 1. Rename `cachePath` to reflect output location
**File:** `src/metrics/commands/token.js`  
**Issue:** The variable is still named `cachePath`, but the path now points to `.sdd-forge/output/metrics.json`, which reads as a generated metrics output rather than a temporary cache.  
**Suggestion:** Rename it to something like `metricsOutputPath` or `metricsPath`, and update its uses in the file for clearer intent.
