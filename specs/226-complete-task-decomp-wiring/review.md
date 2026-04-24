# Code Review Results

### [x] 1. Parent Propagation Complexity Can Be Reduced
**File:** `src/lib/flow-store.js`  
**Issue:** `completeTask()` repeatedly uses `tasks.find()` and `tasks.filter()` inside a loop over ancestors, which makes the propagation path O(n²) and harder to follow.  
**Suggestion:** Build `byId` and `childrenByParent` maps once at the start of the mutation and reuse them during the upward walk. This simplifies logic and removes repeated scans.

**Verdict:** APPROVED
**Reason:** This is a real quality improvement (clearer logic, lower repeated scans) and can preserve behavior if maps are built from the same `tasks` array and reused read-only during the ancestor walk.

### [x] 2. Guardrail Terminology Is Out of Sync With Schema
**File:** `src/presets/base/guardrail.json`  
**Issue:** The `task-single-responsibility` rule text still refers to task “description”, but `spec.schema.json` replaced that with `goal` (plus `acceptance`, `implementation_notes`, etc.).  
**Suggestion:** Update the guardrail wording to reference `goal` (and optionally acceptance/implementation notes) so policy language matches the current task schema.

**Verdict:** APPROVED
**Reason:** The schema now uses `goal`, so updating guardrail wording removes a real inconsistency with minimal behavior risk (policy text alignment, not algorithmic change).

### [x] 3. Repeated “done/skipped” Status Checks Should Be Centralized
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Completion logic (`status === "done" || status === "skipped"`) is repeated in multiple changed files, increasing drift risk if completion semantics change.  
**Suggestion:** Introduce a small shared helper (for example `isTaskTerminalStatus(status)` or `isTaskDoneOrSkipped(task)`) and reuse it in `run-gate.js` (and aligned touched callers) for consistency.

**Verdict:** APPROVED
**Reason:** Centralizing terminal-status semantics reduces drift risk across modules; behavior should remain unchanged if the helper exactly preserves current logic (`done || skipped`).

### [x] 4. Inline Validation in Command Is Overgrown
**File:** `src/flow/lib/run-update-overview.js`  
**Issue:** `execute()` mixes command orchestration with detailed JSON shape validation, making the method long and harder to test independently.  
**Suggestion:** Extract validation into a dedicated function/class (for example `validateOverviewAdditions(raw)` returning `{ok,value}` or throwing typed errors). Keep `execute()` focused on flow loading and persistence.

**Verdict:** APPROVED
**Reason:** Extracting validation from `execute()` materially improves readability/testability and is behavior-safe when extraction is pure (same inputs, same errors/codes/messages).

### [ ] 5. Duplicate Test Fixture Data Should Be Deduplicated
**File:** `tests/unit/specs/commands/gate.test.js`  
**Issue:** The placeholder `tasks` entry object is duplicated in multiple fixture builders/objects in the same test file.  
**Suggestion:** Define a shared `const VALID_TASK = {...}` (or `makeValidTask(overrides)`) and reuse it across test setups to reduce repetition and fixture drift.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic in a single test file; the quality gain is marginal and shared fixtures can accidentally reduce test clarity or introduce coupling if mutated.
