# Code Review Results

### [x] 1. Centralize Gate Logic Instead of Reintroducing `simpleGate`
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** `RunDraftTaskCommand` now uses a local `simpleGate()` instead of the shared gate command path, which creates design inconsistency and duplicates validation responsibility in a feature-specific file.  
**Suggestion:** Route validation through the existing gate command abstraction (resolved via container/factory) and remove `simpleGate()` so gate behavior stays centralized and uniform.

**Verdict:** APPROVED
**Reason:** This is a real design improvement (single gate path, no duplicated validation policy) and aligns behavior with the established full-gate contract rather than fragmenting it in a feature file.

### [x] 2. Fail Fast on Agent Resolution Errors
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** `invokeAgent()` returns `""` when agent resolution fails, which makes the retry loop churn on guaranteed failures and obscures the real root cause.  
**Suggestion:** Throw a typed error immediately when `agent` is unavailable or `resolve("flow.draft-task")` fails, and skip retries for non-retryable setup/config failures.

**Verdict:** APPROVED
**Reason:** Returning `""` hides setup failures and causes pointless retries; a typed non-retryable error improves diagnosability and avoids retry churn without changing successful-path behavior.

### [x] 3. Restore Shared Draft Fixture to Remove Literal Duplication
**File:** `tests/unit/flow/flow-run-draft-task.test.js`  
**Issue:** Inline draft strings like `"# Draft\n## Goal\n..."` are duplicated across multiple test cases after removing `fixtures/drafts.js`, increasing maintenance cost.  
**Suggestion:** Reintroduce a shared fixture/helper (for minimal pass draft text) and reuse it in all related tests.

**Verdict:** APPROVED
**Reason:** Consolidating duplicated draft literals into one fixture improves test maintainability and consistency with minimal behavior risk if test expectations stay identical.

### [ ] 4. Extract Repeated `execFileSync` Failure Assertions
**File:** `tests/e2e/dispatchers.test.js`  
**Issue:** Multiple tests repeat the same `try/catch + execFileSync + assert.fail + stderr/stdout checks` structure.  
**Suggestion:** Add a small helper (e.g., `expectCommandFailure(args)`) that returns combined output and error object, then reuse it to reduce boilerplate and keep assertion intent clearer.

**Verdict:** REJECTED
**Reason:** This is mostly boilerplate cleanup in tests; under a conservative bar it is primarily cosmetic and risks obscuring per-test assertion intent if over-abstracted.
