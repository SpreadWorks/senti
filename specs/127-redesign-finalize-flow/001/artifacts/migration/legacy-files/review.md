# Code Review Results

### [x] 1. ### 1. Extract cleanup logic into a shared helper
**File:** `src/flow/run/finalize.js`  
**Issue:** The cleanup branch/worktree/spec-only logic was copied from the removed `cleanup.js` and inlined into `finalize.js`. That reintroduces mode branching and git command orchestration in a second place, making the finalize pipeline harder to read and less consistent with the extracted `merge.js` flow.  
**Suggestion:** Move the cleanup block into a reusable helper such as `executeCleanup({ root, flowState, worktreePath, mainRepoPath })` in `src/flow/commands/cleanup.js` or a shared `src/flow/lib/finalize-cleanup.js`, and have `finalize.js` call it the same way it now calls `merge.js`.

2. ### 2. Rename `main` to reflect its new role
**File:** `src/flow/commands/merge.js`  
**Issue:** `main(ctx)` no longer behaves like a CLI entrypoint, but its name still implies a top-level command wrapper. That is inconsistent with the new design where it is imported and called as a library function from `finalize.js`.  
**Suggestion:** Rename `main` to something like `executeMerge` or `runMerge`, and update the export/import accordingly. This makes the module’s intent clearer and aligns naming with `execute(ctx)` in `finalize.js`.

3. ### 3. Remove unused import and unused context field
**File:** `src/flow/commands/merge.js`  
**Issue:** `resolve` is imported from `path` but not used. Also `ctx.worktreePath` is documented in the JSDoc but never read by the implementation. Both are dead code signals that make the API look broader than it is.  
**Suggestion:** Remove the unused `resolve` import and either drop `worktreePath` from the documented context shape or start using it intentionally if it is part of the contract.

4. ### 4. Consolidate repeated “optional git probe” patterns
**File:** `src/flow/run/finalize.js`  
**Issue:** Step 1 and Step 3 contain multiple near-identical `try { execFileSync(...) } catch (_) {}` blocks for optional diff/log/staging checks. This duplicates error-swallowing behavior and makes the report/sync paths more verbose than necessary.  
**Suggestion:** Introduce a tiny helper like `tryExec(command, args, options)` or `readGitTextOrEmpty(...)` and reuse it for diff stats, commit logs, cached diffs, and optional staging. That will shrink the function and make the “best effort” behavior explicit.

5. ### 5. Split the oversized finalize step into smaller functions
**File:** `src/flow/run/finalize.js`  
**Issue:** `execute(ctx)` now owns commit, retro, report generation, merge dispatch, sync, and cleanup in one function. The step orchestration is understandable, but the implementation is becoming monolithic and mixes pipeline control with step internals.  
**Suggestion:** Extract step handlers such as `runCommitStep`, `runMergeStep`, `runSyncStep`, and `runCleanupStep`. Keep `execute(ctx)` focused on step selection and result aggregation, and move step-specific git/report details into dedicated functions for consistency and simpler maintenance.

6. ### 6. Avoid repeating branch/worktree squash command construction
**File:** `src/flow/commands/merge.js`  
**Issue:** The squash merge path has two separate branches that differ mostly by command prefix (`git` vs `git -C <mainRepoPath>`), but both manually repeat merge and commit orchestration. This is a small duplication hotspot.  
**Suggestion:** Build a helper that returns the target git invocation context, then run the same squash sequence through it. For example, compute `gitArgsPrefix = worktree && mainRepoPath ? ["-C", mainRepoPath] : []` and reuse one code path for squash merge execution.

**Verdict:** APPROVED
**Reason:** The cleanup logic inlined into `finalize.js` (lines 224–260 in the new code) is a non-trivial block handling three modes (spec-only, worktree, branch) with git commands and `clearFlowState` calls. Extracting it into a reusable helper improves readability of the already-large `execute()` function and follows the same pattern already established by delegating merge to `merge.js`. The standalone `cleanup.js` was deleted, so re-extracting the logic as a library function (not a CLI entrypoint) is architecturally sound.
