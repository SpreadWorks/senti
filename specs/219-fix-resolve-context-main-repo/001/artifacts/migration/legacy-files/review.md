# Code Review Results

### [x] 1. Extract shared resolve-context envelope builder
**File:** `src/flow/lib/get-resolve-context.js`  
**Issue:** `get-resolve-context` and `run-resume` now duplicate the same active-flow resolution and envelope field assembly (`mainRepoPath`, `worktreePath`, `flowJsonPath`, etc.), which increases drift risk.  
**Suggestion:** Move the shared payload-building logic into one helper (e.g., `buildResolvedFlowContext(ctx)` in this module) and reuse it from both commands so future field changes stay consistent.

**Verdict:** APPROVED
**Reason:** This is a real maintainability improvement (removes duplicated contract-shaping logic) and should preserve behavior if the helper returns the exact same fields/values.

### [x] 2. Mirror the shared helper usage to keep command behavior in lockstep
**File:** `src/flow/lib/run-resume.js`  
**Issue:** This command repeats the same context-shaping logic as `get-resolve-context`, so contract consistency depends on manual edits in two places.  
**Suggestion:** Consume the same helper used by `get-resolve-context` and keep `run-resume` focused on resume-specific behavior only.

**Verdict:** APPROVED
**Reason:** Using the same helper in `run-resume` directly reduces drift risk between two commands that expose the same envelope; behavior remains unchanged if output parity is preserved.

### [ ] 3. Replace abbreviated variable names with domain terms
**File:** `tests/unit/flow/resolve-context-worktree-main-repo.test.js`  
**Issue:** `wtPath` is an abbreviation while the rest of the flow/domain uses `worktreePath`, reducing readability and consistency.  
**Suggestion:** Rename `wtPath` to `worktreePath` throughout the test to match command output keys and existing naming patterns.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic in test code (`wtPath` → `worktreePath`) and does not materially improve quality or correctness.

### [x] 4. Remove unused return value from test fixture setup
**File:** `tests/unit/flow/resolve-context-worktree-main-repo.test.js`  
**Issue:** `writeFlowState()` returns `{ specId, state }`, but `specId` is never consumed by callers (dead return data).  
**Suggestion:** Return only `state` (or use `specId` in assertions); prefer removing the unused value to keep fixture APIs minimal.

**Verdict:** APPROVED
**Reason:** Removing unused `specId` from `writeFlowState()` simplifies the fixture API and reduces dead surface area, with no behavior impact when callers already ignore it.

### [x] 5. Eliminate repeated test setup sequence
**File:** `tests/unit/flow/resolve-context-worktree-main-repo.test.js`  
**Issue:** Both test cases repeat the same setup lines (`setupMainAndWorktree` → `writeFlowState` → `makeCtx`), which adds maintenance overhead.  
**Suggestion:** Add a small helper (e.g., `prepareWorktreeCommandCtx()`) that returns `{ ctx, mainRoot, worktreePath }` and reuse it in both tests to keep each test focused on assertions.

**Verdict:** APPROVED
**Reason:** Extracting repeated setup into a local test helper improves maintainability and reduces copy/paste drift without changing production behavior.
