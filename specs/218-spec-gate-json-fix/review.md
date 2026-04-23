# Code Review Results

### [ ] 1. Fix Retry Off-by-One and Clarify Retry Semantics
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** The loop uses `while (attempts <= retryMax)` with pre-increment, so it can run `retryMax + 1` times, which conflicts with “up to `config.flow.retry.max`”.  
**Suggestion:** Change to `while (attempts < retryMax)` (or initialize `attempts = 1` and use `<=`) and rename variables to `maxAttempts`/`attemptCount` to make behavior explicit.

**Verdict:** REJECTED
**Reason:** `retry.max` may be interpreted as “max retries after first attempt,” so changing loop bounds can alter behavior (fewer attempts) and break expected retry flow without clear spec confirmation.

### [x] 2. Remove Silent Parse Failure in Stub Path
**File:** `src/flow/lib/run-draft-task.js`  
**Issue:** The `catch { return ""; }` around stub JSON parsing swallows parse errors and turns them into empty drafts, making failures harder to diagnose.  
**Suggestion:** Return a structured error (or at least log stderr with context) when stub output is invalid JSON, instead of silently degrading.

**Verdict:** APPROVED
**Reason:** Silent JSON parse failure hides actionable errors; adding explicit error reporting/logging improves diagnosability, and can be done without changing core success/fail semantics.

### [x] 3. Restore `integer` Type Support in Schema Validator
**File:** `src/lib/schema-validate.js`  
**Issue:** `integer` handling was removed from both type-check and numeric constraint path, which makes validator behavior inconsistent with JSON Schema usage patterns.  
**Suggestion:** Reintroduce `integer` in `checkType` and include it in numeric constraint evaluation (`number || integer`) to preserve schema consistency.

**Verdict:** APPROVED
**Reason:** Removing `integer` is a functional regression for JSON Schema-style validation; restoring it improves correctness and compatibility with existing schemas.

### [x] 4. Align Step Status Update with Command Intent
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** `run-prepare-spec` now marks `spec` as `done` instead of `prepare-spec`, which is inconsistent with command naming and step lifecycle semantics.  
**Suggestion:** Mark `branch` + `prepare-spec` as done (or explicitly document/rename the lifecycle if intentional). Prefer a shared constant for “steps completed by prepare-spec” to avoid drift.

**Verdict:** APPROVED
**Reason:** Marking `spec` done from `run-prepare-spec` is lifecycle-inconsistent; updating `branch` + `prepare-spec` aligns behavior with command intent and step model.

### [ ] 5. Improve Function Naming for Phase-Specific Checkers
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `checkSpecText` is now used for task draft markdown (`task-spec`) while `checkSpecJson` handles parent spec validation (`spec`), but naming still implies both are “spec” checks, which is confusing.  
**Suggestion:** Rename to phase-specific names (e.g., `checkTaskSpecMarkdown` and `checkParentSpecJson`) and keep exports aligned with phase terminology for design consistency.

**Verdict:** REJECTED
**Reason:** Mostly naming cleanup; limited quality gain versus churn/risk across exports/callers, and no direct behavior fix.

### [ ] 6. Eliminate Repeated Stub/Fixture Setup in Draft-Task Tests
**File:** `tests/unit/flow/flow-run-draft-task.test.js`  
**Issue:** Stub agent creation, flow setup, and command execution patterns are repeated across cases, increasing maintenance cost.  
**Suggestion:** Extract shared helpers (`createDraftTaskFixture`, `runDraftTaskCli`, `createStubAgent`) within the same file (or existing test helper module already in touched scope) to reduce duplication and improve readability.

**Verdict:** REJECTED
**Reason:** Primarily cosmetic test refactor; maintainability benefit is real but not enough to justify change under a conservative, behavior-first review standard.
