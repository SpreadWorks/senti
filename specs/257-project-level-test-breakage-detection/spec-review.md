# Spec Review Results

## Proposals

### 1. I’ll inspect the repo around the scoped modules and cross-references so the proposals are grounded in actual files, not just the supplied related-file list. No code changes are needed for this review.The current directory only shows review logs, so I’m checking the worktree layout before looking at source. I’ll stay inside the declared worktree path boundary.The Git worktree root is the parent directory of `.tmp`, so source files are inside the same worktree. I’m going to read from that root for context, without editing anything.I found several existing readers and generated surfaces beyond the main flow modules. I’m narrowing this to concrete overlooked files where the current spec text is either too broad to be actionable or misses a dependency.### 1. Config load failures can be downgraded to “no config”
**File:** `src/lib/container.js`  
**Issue:** The spec requires config validation failures to stop commands non-zero, but `initContainer()` currently catches non-missing config errors and registers `config=null`. That can make invalid config look like missing config through dispatcher preconditions.  
**Suggestion:** Add a requirement that invalid `.sdd-forge/config.json` is preserved as a distinct config-load failure and surfaced through the existing command error/envelope path, not converted to `NO_CONFIG`.

### 2. 2. Generated skill rules still encourage manual step completion
**File:** `src/templates/skills/rules.json`  
**Issue:** The spec updates `flow-tracking.md` and generated flow skills, but `rules.json` also tells agents to run `flow set step <id> done` after each step and includes `flow.test-execute`, `flow.test-result-review`, and `flow.retro`. This can contradict the post-hook/prerequisite failure contract.  
**Suggestion:** Add `src/templates/skills/rules.json` to scope and require its rule text to exempt post-hook-managed steps and forbid manual completion from masking failed prerequisites.

### 3. 3. Review-test scope is internally ambiguous
**File:** `src/flow/commands/review.js`  
**Issue:** `collectTestFiles()` still reads root `tests/` into review-test. The spec says removing that is out of scope, but also lists “Continuing to pass full project-level tests content to review-test” as out of scope, leaving no clear intended behavior.  
**Suggestion:** Clarify the spec: either explicitly preserve current review-test collection until the companion board removes it, or move the removal into this scope. Do not list both changing and continuing the behavior as out.

### 4. 4. Docs test-command reporting is narrower than runtime discovery
**File:** `src/presets/base/data/package.js`  
**Issue:** R27 only calls out configured `test.command`, but runtime discovery includes package.json, composer.json, and Makefile. The base package analysis currently stores package scripts and composer deps, not composer scripts, and has no Makefile test metadata, so generated docs can still contradict R4 discovery.  
**Suggestion:** Extend R27 to require generated docs/test-env detection to use the same R4 source order, either by extending package/Makefile analysis metadata or by a shared discovery helper.

### 5. 5. Existing changed-file helpers can diverge from regression snapshots
**File:** `src/lib/git-helpers.js`  
**Issue:** The spec requires stable `{status,path}` / rename-aware changed-file snapshots and gate freshness comparison, but does not name the existing Git helper layer. Current helpers like `listUncommittedFiles()` lose status and rename details.  
**Suggestion:** Add a requirement for a shared changed-file enumeration helper used by test-execute and gate-impl, with status/rename/untracked normalization covered by tests.

### 6. 6. Impl-confirm can still point operators past test-execute
**File:** `src/flow/lib/run-impl-confirm.js`  
**Issue:** When requirements are complete, this command returns `next: "review"`, but the new impl sequence must go `test-execute` → `test-result-review` → `review` → `gate-impl` → `retro`.  
**Suggestion:** Add `run-impl-confirm.js` to scope and require its next-step guidance to point to `test-execute` or otherwise avoid bypassing the execution-phase test contract.
