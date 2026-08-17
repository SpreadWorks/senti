# Spec Review Results

## Proposals

### 1. I’ll inspect the finalize and flow context code paths plus template/test references, then report only concrete spec gaps in the requested proposal format.The declared worktree root points at `.tmp`, but the expected `src/` and `tests/` directories are not present there. I’m checking the directory layout without leaving the worktree boundary.The source tree appears to be one level above the scratch directory, while the shell cwd is the `.tmp` subdirectory. I’ll read the parent tree by explicit paths and keep all operations read-only.The newest files I can see are under `tests/`, with source/test mtimes newer than generated `docs/` would matter if we were changing code. Since this is a read-only spec review, I’m continuing with direct source inspection.I’ve confirmed the shared dispatcher already wraps returned `Envelope` instances and skips post hooks only for `ok:false`; that matters for the cleanup warning requirement. Next I’m checking the concrete finalize command implementations and merge strategy details.### 1. Shared Resolve-Context Builder Is Omitted
**File:** `src/flow/lib/resolve-context-envelope.js`  
**Issue:** The spec lists `get-resolve-context.js` / `run-resume.js`, but the real authority-sensitive logic lives in `buildResolvedFlowContext()`. It currently derives `flowJsonPath`, `effectiveRoot`, dirty state, requirements, and active-flow errors from `root` / `worktreePath`, which conflicts with “main repo authority after merge” and “active:false after cleanup”.  
**Suggestion:** Add this file to Scope/Modules and require it to consume the shared authority resolver, including exact post-merge and post-cleanup output semantics.

### 2. 2. FlowCommand Re-Resolves Context Separately
**File:** `src/flow/lib/base-command.js`  
**Issue:** The dispatcher builds hook context via `resolveFlowContext()`, then `FlowCommand.run()` calls `resolveFlowContext()` again for command execution. The spec says context resolution is centralized, but does not address this double-resolution path or guarantee command ctx and post-hook ctx use the same authority.  
**Suggestion:** Specify whether the dispatcher passes one resolved ctx through to commands, or whether both calls must use the same authority resolver and return an authority-scoped `flowManager`.

### 3. 3. Next-Action Writes May Target The Wrong FlowStore
**File:** `src/flow/lib/get-next-action.js`  
**Issue:** `get next-action` auto-promotes pending steps and persists with `ctx.flowManager.save(state)`. The spec covers reading main repo authority after merge, but not this write path. If `ctx.flowState` is loaded from main while `ctx.flowManager` still points at the worktree, promotion can be saved to the wrong `flow.json`.  
**Suggestion:** Require `resolveFlowContext()` to expose an authority-scoped manager, or require `get-next-action` to write through the resolved authority manager.

### 4. 4. Cleanup Post-Hook Requirement Contradicts Final Commit Cleanliness
**File:** `src/flow/registry.js`  
**Issue:** R1 says `finalize-cleanup` post hook may idempotently re-set the step, while R5 says cleanup itself commits the final `flow.json` and leaves the main repo clean. A post-hook after command return can either fail after worktree removal or dirty main `flow.json` after the final commit.  
**Suggestion:** Clarify that `finalize-cleanup` has no state-mutating post hook, or that the post hook is verification-only. Keep all cleanup step mutation inside `run-finalize-cleanup.js`.

### 5. 5. Cleanup Transaction Omits Active Pointer And Last-Finalized Pointer Ordering
**File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The spec defines transactional ordering for `flow.json`, but not for `.active-flow` clearing or `.sdd-forge/last-finalized-spec` writing. Clearing active state before a failed commit would break retryability, while writing the pointer too early can make post-cleanup commands see an unfinalized flow.  
**Suggestion:** Extend R5 with exact ordering for: update main `flow.json`, stage/commit, rollback on commit failure, then write last-finalized pointer, clear `.active-flow`, remove worktree/branch, and embed report.

### 6. 6. Cleanup Removal Failures Are Undefined
**File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The current code ignores `git worktree remove` and `git branch -D` failures. The spec verifies worktree/branch deletion in e2e, but does not define whether these failures are fatal, warnings, or retryable after final `flow.json` is committed.  
**Suggestion:** Add cleanup failure semantics: which removal errors return `ok:false`, which become envelope warnings, and what state remains for retry or manual recovery.

### 7. 7. PR Route Authority And Step Progression Are Ambiguous
**File:** `src/flow/lib/run-finalize-merge.js`  
**Issue:** R2 says post-merge hooks update main repo `flow.json`, but R19 says PR route is out of scope after PR creation. In PR route, no squash merge has placed `flow.json` on main, so `finalize-merge` cannot use main authority. It is also unclear whether `finalize-sync` / `finalize-cleanup` should remain pending, be skipped, or be blocked until the PR merges.  
**Suggestion:** Add explicit PR-route rules: status update target, authority source, and next-action behavior for `finalize-sync` / `finalize-cleanup`.

### 8. 8. OnError Hooks Are Not Covered By Authority Switching
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `finalizeOnError()` writes issue-log data under `ctx.root`. The spec covers post hooks and read commands, but not error hooks. After merge, `finalize-sync` / `finalize-cleanup` failures should likely record against main repo authority, not stale worktree state.  
**Suggestion:** Require finalize onError hooks to use the same authority resolver as post hooks, including skipped-step writes and issue-log writes.

### 9. 9. Finalize Result Normalization Field Is Underspecified
**File:** `src/flow/registry.js`  
**Issue:** The commands return mixed fields: `finalize-commit` preflight returns `result: "preflight_failed"` plus `status: "failed"`, while normal paths use `status: "done"` / `"skipped"`. The spec says “command result status” but does not define precedence.  
**Suggestion:** Define a single helper/contract, e.g. normalize from `result.result ?? result.status`, with tests for `done`, `completed`, `skipped`, `failed`, and `preflight_failed`.

### 10. 10. Finalize Prompt Tests Are Not Mentioned
**File:** `tests/unit/flow/prompt-impl-finalize.test.js`  
**Issue:** The spec changes `src/flow/prompts/impl/finalize-*.md`, but only mentions `skill-report-show-wiring.test.js`. The existing prompt test file does not assert the finalize prompt contents, so stale `cd <mainRepoPath>` / `flow report show` instructions could remain.  
**Suggestion:** Add/update tests asserting old manual instructions are absent from finalize prompts and `finalize-cleanup.md` instructs reading `envelope.data.report.text`.
