# Code Review Results

### [x] 1. Re-extract Diff Collection Helper
**File:** `src/flow/commands/review.js`  
**Issue:** The same “committed diff + staged diff” sequence is now duplicated in both file-scoped and fallback paths.  
**Suggestion:** Reintroduce a shared helper (e.g. `collectCommittedAndStagedDiff(root, baseBranch, filePath?)`) and call it from both branches to avoid drift and keep behavior consistent.

**Verdict:** APPROVED
**Reason:** The duplication in `review.js` is real and behaviorally aligned; a shared helper reduces drift risk without changing outputs if it keeps the same git calls/order.

### [x] 2. Reuse Existing Commit Policy
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `executeCommitPost` reimplements commit error handling (`nothing to commit`) even though `commitOrSkip` already encapsulates that policy.  
**Suggestion:** Replace manual `git commit` handling in `executeCommitPost` with `commitOrSkip(...)` and map its result into `results.report.commitNote` as needed.

**Verdict:** APPROVED
**Reason:** `executeCommitPost` currently duplicates commit-skip logic with narrower matching; reusing `commitOrSkip` improves consistency and lowers divergence risk while preserving behavior.

### [x] 3. Restore Shared Fail-Open Git Check Utility
**File:** `src/lib/flow-state.js`  
**Issue:** `worktreeExists` and `branchExists` now duplicate the same fail-open pattern (`runCmd` + `!ok => true`).  
**Suggestion:** Reintroduce a small shared helper (similar to the removed `runGitFailOpenBoolean`) to centralize fail-open behavior and keep logging/message policy uniform.

**Verdict:** APPROVED
**Reason:** `worktreeExists`/`branchExists` now repeat the same fail-open pattern; centralizing it improves maintainability and policy consistency with minimal behavioral risk.

### [x] 4. Remove Dead Logging Scaffolding
**File:** `src/lib/process.js`  
**Issue:** `Logger` is imported but not used; only commented TODO blocks reference it. This is dead code noise and suggests unresolved design state.  
**Suggestion:** Either fully implement a recursion-safe logging strategy, or remove the `Logger` import and TODO-commented pseudo-calls until a concrete design is ready.

**Verdict:** APPROVED
**Reason:** Removing the unused `Logger` import and commented pseudo-calls is a safe cleanup that reduces confusion and does not alter runtime behavior.

### [ ] 5. Clarify Local Git Wrapper Naming
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** Local helper renamed to `runGit`, which is easy to confuse with historical/shared `runGit` helpers in other modules.  
**Suggestion:** Rename to an intention-revealing name like `runGitOrThrowTrim` (or similar) to make behavior explicit and reduce cognitive load.

**Verdict:** REJECTED
**Reason:** This is primarily naming-level cleanup; quality gain is minor and cosmetic-only, with little concrete behavioral or structural improvement.

### [ ] 6. Keep Recursion-Safety Intent Documented at Call Sites
**File:** `src/lib/cli.js`  
**Issue:** Guard comments explaining why `runCmd("git", ...)` must be used (to avoid logger recursion) were removed, while related TODOs still exist elsewhere.  
**Suggestion:** Restore concise comments or centralize this rule in a shared helper/doc and reference it here, so future refactors don’t accidentally reintroduce recursion.

**Verdict:** REJECTED
**Reason:** Restoring comments is documentation-only and does not improve executable quality directly; it is cosmetic unless paired with enforced code-level safeguards.
