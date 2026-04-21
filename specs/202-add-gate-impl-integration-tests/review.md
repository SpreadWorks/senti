# Code Review Results

### [x] 1. Restore Scoped Staging in Finalize Post-Commit
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `executeCommitPost` now uses `git add -A`, which can sweep unrelated working-tree changes into the retro/report commit. This breaks commit-scope consistency and reintroduces broad staging behavior.  
**Suggestion:** Stage only the current spec directory (derived from `state.spec`) instead of `-A`, and keep post-commit strictly metadata-scoped.

**Verdict:** APPROVED
**Reason:** This fixes a real behavioral regression (`git add -A` can commit unrelated files) and restores the intended commit scope contract without changing intended finalize behavior.

### [x] 2. Keep Exit-Code Side Effects Out of `runText`
**File:** `src/docs/commands/text.js`  
**Issue:** `runText()` mutates `process.exitCode`, coupling reusable logic to process-global CLI behavior. This weakens layering consistency.  
**Suggestion:** Make `runText()` pure (`return { errors }`) and move exit-code handling to `DocsTextCommand.execute()` (throw structured error or set exit code there).

**Verdict:** APPROVED
**Reason:** Separation of concerns is better: reusable logic should not mutate process-global state. Behavior can be preserved by handling exit code in `DocsTextCommand.execute()`.

### [x] 3. Remove Dead Import/Hack in New E2E Test
**File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Issue:** `execFileSync` is imported but unused, and `void execFileSync;` is a dead-code workaround.  
**Suggestion:** Remove the unused import and the trailing `void` line.

**Verdict:** APPROVED
**Reason:** Unused import plus `void` workaround is dead code; removing it is safe and improves clarity with no behavior impact.

### [ ] 4. Extract Repeated Fixture Variants
**File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Issue:** PASS/FAIL modified test contents are duplicated across multiple test cases (`R1` vs `R4a`, `R2` vs `R4b`).  
**Suggestion:** Introduce helper builders (e.g., `makePassDiffTest()`, `makeFailDiffTest()`) or shared constants to eliminate duplication and reduce drift risk.

**Verdict:** REJECTED
**Reason:** Primarily test-code cleanup/cosmetic refactor. Under a conservative bar, duplication alone here is not enough to justify churn and potential accidental test-behavior drift.

### [x] 5. Normalize Retry-Options Method Naming
**File:** `src/lib/agent.js`  
**Issue:** `_normalizeRetryOptionsForTest` is used as core behavior but is named as test-only, which is misleading and inconsistent with intent.  
**Suggestion:** Rename to `_normalizeRetryOptions` and keep a temporary alias only if tests still reference the old name.

**Verdict:** APPROVED
**Reason:** Name currently misrepresents production usage. Renaming improves maintainability and readability; with a temporary alias, behavior remains unchanged.

### [x] 6. Re-Introduce Finalize Commit-Scope Regression Coverage
**File:** `tests/unit/flow/run-finalize-retro-commit-scope.test.js`  
**Issue:** The regression test guarding against broad `git add -A` staging was deleted while the implementation reverted to `git add -A`, removing protection for a previously known failure mode.  
**Suggestion:** Restore this test (or equivalent) to lock the post-commit staging contract to spec-scoped paths only.

**Verdict:** APPROVED
**Reason:** A known regression path lost its guardrail; restoring this test materially improves safety against behavior breakage in future refactors.
