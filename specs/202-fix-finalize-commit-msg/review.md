# Code Review Results

### [x] 1. Keep Exit-Code Responsibility in Command Layer
**File:** `src/docs/commands/text.js`  
**Issue:** `runText()` now mutates `process.exitCode` directly, which introduces a process-global side effect in a reusable function and weakens design consistency (core logic vs CLI boundary).  
**Suggestion:** Move exit-code handling back to `DocsTextCommand.execute()` (or dispatcher boundary) and keep `runText()` pure by returning `{ errors }` only. If needed, throw a structured error object from `execute()`.

**Verdict:** APPROVED
**Reason:** This is a real design improvement (separates core logic from CLI/process side effects) and can preserve behavior if `execute()`/dispatcher still maps failures to non-zero exit.

### [x] 2. Remove Test-Specific Naming From Production Logic
**File:** `src/lib/agent.js`  
**Issue:** `_normalizeRetryOptionsForTest()` is now core behavior (defaulting retry to `0`), but its name implies test-only use, which is misleading.  
**Suggestion:** Rename it to `_normalizeRetryOptions()` and keep any test hook as a thin alias if required for backward test compatibility.

**Verdict:** APPROVED
**Reason:** Renaming to reflect actual production responsibility improves clarity without behavior change; keeping a thin alias avoids test breakage during transition.

### [x] 3. Reinstate Safe stdin Write Handling
**File:** `src/lib/agent.js`  
**Issue:** Removing `stdin` error handling (`stdinError`) makes subprocess stdin failures harder to classify and can reintroduce fragile behavior on broken pipes.  
**Suggestion:** Add a small helper to write/end stdin with explicit error capture (Promise-based), then reject with a normalized error shape. This also improves consistency with existing retry/error classification paths.

**Verdict:** APPROVED
**Reason:** This addresses a concrete robustness regression (stdin/broken-pipe handling), improves error classification, and is unlikely to change intended successful-path behavior.

### [ ] 4. Extract Repeated Optional-Agent Step Pattern
**File:** `tests/acceptance/lib/pipeline.js`  
**Issue:** The `ctx.agent ? run step : skipped` flow is repeated for `enrich` and `text`, with slightly different control flow, which increases branching complexity and makes behavior drift likely.  
**Suggestion:** Extract a helper like `runAgentStepOrSkip(stepName, CommandClass, options)` to centralize skip/execute/error behavior and reduce duplication.

**Verdict:** REJECTED
**Reason:** As proposed, this is mostly structural and risks changing nuanced step-specific control flow (`enrich` vs `text`) in acceptance behavior unless semantics are proven equivalent.

### [ ] 5. Use Shared Allowed-Status Constant in Assertions
**File:** `tests/e2e/acceptance/report.test.js`  
**Issue:** Inline status checks (`step.status === "ok" || ...`) are less maintainable and inconsistent with previous enum-style checks.  
**Suggestion:** Define `const ALLOWED_STATUSES = ["ok", "skipped", "error"]` and use `ALLOWED_STATUSES.includes(step.status)` for readability and easier future updates.

**Verdict:** REJECTED
**Reason:** Primarily cosmetic/readability-only refactoring with little quality gain and no behavior benefit; not worth churn under a conservative review standard.
