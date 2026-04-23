# Code Review Results

### [x] 1. Re-extract Shared Resolve-Context Builder
**File:** `src/flow/lib/get-resolve-context.js`  
**Issue:** This file now duplicates large logic blocks that also exist in `run-resume` (`extractSection`, phase-to-skill mapping, spec summary loading, git status snapshot, envelope shaping).  
**Suggestion:** Reintroduce a shared builder module (like the removed `resolve-context-envelope.js`) and keep command files focused on command-specific fields only.

**Verdict:** APPROVED
**Reason:** This removes real duplication across `get-resolve-context` and `run-resume`, reducing drift risk in shared envelope fields without requiring behavior changes.

### [x] 2. Fix `mainRepoPath` Semantics in Worktree Mode
**File:** `src/flow/lib/run-resume.js`  
**Issue:** `mainRepoPath` is assigned from `root`, which can be the worktree path; this makes `mainRepoPath` misleading/incorrect in worktree execution.  
**Suggestion:** Use `ctx.mainRoot` for `mainRepoPath` and keep `root` only as execution context.

**Verdict:** APPROVED
**Reason:** Using `root` for `mainRepoPath` is incorrect in worktree execution; `ctx.mainRoot` matches the field’s intended meaning and fixes incorrect path reporting.

### [x] 3. Normalize `set summary` Input Before Persistence
**File:** `src/flow/lib/set-summary.js`  
**Issue:** Validation accepts `{text, status}` objects, but persistence passes raw elements to `setRequirements`, which stores them as `desc` values and can produce object-valued `desc`.  
**Suggestion:** Normalize input to a single internal shape before calling the store (e.g., always write `{ desc: string, status }`), or restrict accepted input to strings.

**Verdict:** APPROVED
**Reason:** Current validation/persistence mismatch can store object-valued `desc`, which is a data-shape bug. Normalizing input (or restricting to strings) is a correctness fix.

### [x] 4. Remove Conflicting Requirement Sources and Dead Work
**File:** `src/flow/lib/run-retro.js`  
**Issue:** The function builds `requirementsText` from `specJson.requirements`, then immediately switches to `state.requirements`; this creates inconsistent behavior and leaves partial dead work.  
**Suggestion:** Choose one source of truth in this function and use it consistently for both emptiness checks and prompt generation.

**Verdict:** APPROVED
**Reason:** Building text from `specJson.requirements` while validating emptiness from `state.requirements` is internally inconsistent and can fail valid cases.

### [ ] 5. Eliminate Redundant Spec Reads + Improve Naming
**File:** `src/metrics/commands/token.js`  
**Issue:** `computeSpecDifficulty` reads `spec.json` text and also calls `loadSpecJson(specDir)`, causing duplicate I/O; also `specMdChars` is misleading since it measures JSON text size.  
**Suggestion:** Load/parse once and reuse it; rename `specMdChars` to `specJsonChars` (or equivalent) for clarity.

**Verdict:** REJECTED
**Reason:** The optimization is plausible, but it risks subtle behavior drift (e.g., schema-validation/error-path semantics and metric source semantics) unless tightly constrained; proposal is underspecified for a safe refactor.

### [x] 6. Restore Scope-Consistent Final Validation Prompting
**File:** `src/flow/commands/review.js`  
**Issue:** The final validation prompt now uses `draftResult` raw text instead of the filtered proposal list, which can reintroduce scope drift and mismatch between reviewed proposals and verdict mapping.  
**Suggestion:** Reintroduce a dedicated prompt builder that takes the filtered `proposals` array and numbers entries deterministically; keep `mergeVerdicts` mapping aligned with that list.

**Verdict:** APPROVED
**Reason:** Feeding raw `draftResult` into final validation can desync filtered proposals and verdict mapping. Prompting from the filtered `proposals` list restores deterministic, behavior-correct mapping.
