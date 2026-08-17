# Code Review Results

### [ ] 1. Avoid `runGit` Name Shadowing in Prepare-Spec
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** A local helper is named `runGitTrim` while importing `runGit` from `git-helpers.js`, and this file now has a custom wrapper pattern that differs from other modules. This increases cognitive load and risks accidental recursion/confusion during future edits.  
**Suggestion:** Rename the local helper to something explicit like `runGitOrThrowTrim(root, args)` and consider moving this behavior into a shared helper in `git-helpers.js` (e.g., `runGitOrThrow(args, opts, { trimStdout: true })`) to keep one pattern across files.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic now (`runGitTrim` already avoids direct shadowing), and moving trim/throw behavior into shared helpers broadens scope with limited functional gain and some regression risk.

### [x] 2. Extract Repeated “collect committed + staged diff” Logic
**File:** `src/flow/commands/review.js`  
**Issue:** The same two-step diff collection pattern (`git diff <base>` + `git diff --cached`) is repeated in both the per-file loop and fallback branch.  
**Suggestion:** Extract a helper (e.g., `collectCommittedAndStagedDiff(root, baseBranch, filePath?)`) that returns merged output. This removes duplication and ensures consistent behavior for file-scoped and repo-scoped review targets.

**Verdict:** APPROVED
**Reason:** The duplication is real and behaviorally identical in intent; a small helper can reduce drift risk and improve maintainability without changing output semantics.

### [x] 3. Reuse `commitOrSkip` Instead of Repeating Commit Error Handling
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `executeCommitPost` still manually checks `"nothing to commit"` even though `commitOrSkip` already centralizes exactly this behavior.  
**Suggestion:** Replace manual commit handling in `executeCommitPost` with `commitOrSkip(["-m", "chore: add retro and report"], { cwd: root })` and map the returned status into `results.report.commitNote`. This removes duplicate branching and keeps commit semantics consistent.

**Verdict:** APPROVED
**Reason:** This is a clear de-duplication of already-centralized commit policy and should preserve behavior if `results.report.commitNote` mapping is kept equivalent.

### [ ] 4. Consolidate Docs Sync Git Steps Shared Across Commands
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** Docs sync flow (`git add` specific paths, staged diff inspection, commit) is duplicated conceptually with similar logic in `run-sync.js`.  
**Suggestion:** Introduce a shared helper in flow/lib (e.g., `syncDocsAndCommit(root, message)`) used by both finalize and sync paths. Keep path list and commit behavior in one place to avoid drift.

**Verdict:** REJECTED
**Reason:** The flows are similar but not identical (different add targets, result reporting, and context), so aggressive unification risks subtle behavior changes for limited immediate quality benefit.

### [x] 5. Deduplicate “git check with fail-open + stderr log” Pattern
**File:** `src/lib/flow-state.js`  
**Issue:** `worktreeExists` and `branchExists` have nearly identical patterns: run git, on failure log to stderr and return `true` (fail-open safety).  
**Suggestion:** Extract a helper like `runGitFailOpenBoolean(args, contextLabel)` to centralize this safety pattern. This improves consistency and makes policy changes (e.g., logging format) one-line updates.

**Verdict:** APPROVED
**Reason:** The pattern is repeated with the same fail-open policy; extracting it into one helper improves consistency and makes future policy/logging changes safer.
