# Spec Review Results

## Proposals

### 1. I’ll inspect the merge/rebase implementation and nearby tests/templates so the proposals are grounded in the actual code rather than only the provided context.The current worktree reports only an untracked spec directory outside `.tmp`, and `rg --files` did not list source files from this cwd. I’m checking the worktree layout before deciding whether the code lives under a nested path or was not populated here.Git reports the actual repository root as the parent directory of `.tmp`. I’ll read from that worktree root, staying within the active worktree, and I won’t make edits.The current implementation has the two hotspots the spec names, plus a separate pre-sync test file already asserting the old conflict-only shape. I’m narrowing into tests and generated skill/template references now, because those are the likely spec omissions.### 1. Finalize Sync Still Runs In `mainRepoPath`
**File:** `src/flow/lib/run-finalize-sync.js`  
**Issue:** R2 adds a temporary detached worktree fallback when `mainRepoPath` cannot checkout `baseBranch`, but the next finalize step always runs docs sync in `mainRepoPath`. If `mainRepoPath` stayed on another branch, docs sync can commit to the wrong branch after a successful fallback merge.  
**Suggestion:** Specify how `finalize-sync` behaves after fallback: either sync in the same temporary/base worktree, checkout/verify `baseBranch` before sync, or stop with a clear follow-up path.

### 2. 2. Detached Worktree Does Not Automatically Advance `baseBranch`
**File:** `src/flow/commands/merge.js`  
**Issue:** R2 says a detached worktree should create the squash commit “on `baseBranch`”, but `git worktree add --detach <tmp> <baseBranch>` followed by commit only creates a detached commit. The spec does not define how `baseBranch` is advanced, or how to keep `baseBranch` unchanged on failure.  
**Suggestion:** Add an explicit success protocol: create detached commit, then atomically update `refs/heads/<baseBranch>` only after commit succeeds, with cleanup guaranteed and no ref update on any failure.

### 3. 3. `runPreSync` Caller Contract Is Missing
**File:** `src/flow/commands/merge.js`  
**Issue:** The spec updates `rebaseOnto` to return a `reason`, but `runPreSync` currently treats every rebase failure as a conflict, calls `abortRebase`, and returns `conflictFiles`. Dirty-worktree failures need different handling here, not only in `git-helpers.js`.  
**Suggestion:** Add a requirement that `runPreSync` branches on `rebaseRes.reason`: conflict failures keep the existing abort/recovery behavior; dirty-worktree failures skip conflict formatting and surface the exact R5 message.

### 4. 4. Existing Rebase Tests Assert The Old Shape
**File:** `tests/unit/lib/git-sync-helpers.test.js`  
**Issue:** The spec does not mention tests that currently assert `rebaseOnto` returns only `ok:false` plus `conflictFiles`. Adding `reason` and dirty-worktree classification needs direct regression coverage here.  
**Suggestion:** Include this file in scope and require tests for at least `reason: "conflict"` and `reason: "dirty-worktree"` while preserving conflict-file behavior.

### 5. 5. Pre-Sync Tests Need Dirty-Worktree Coverage
**File:** `tests/unit/flow/commands/merge-pre-sync.test.js`  
**Issue:** The existing pre-sync tests only cover success, conflict, PR skip, and spec-only skip. The dirty-worktree bug is in this path, but the spec does not require updating the test file that would catch the misleading conflict message.  
**Suggestion:** Add a test requiring dirty worktree rebase failure to return/throw the R5 message and not report `conflictFiles: []` as a conflict.

### 6. 6. Broad “No Stash In Error Messages” Conflicts With Existing Dirty Prompts
**File:** `src/flow/lib/get-prompt.js`  
**Issue:** The constraint says error messages must not include `stash`, but existing dirty-worktree prompt text says “commit or stash first.” The spec does not clarify whether this broad constraint applies only to the new pre-merge rebase error or all active-flow dirty-worktree messages.  
**Suggestion:** Narrow the constraint to the new finalize/pre-merge rebase message, or explicitly add prompt/message cleanup to scope.
