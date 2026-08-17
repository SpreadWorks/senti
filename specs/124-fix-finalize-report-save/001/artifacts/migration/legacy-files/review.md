# Code Review Results

### [x] 1. ### 1. Extract Spec Artifact Persistence
**File:** `src/flow/run/finalize.js`  
**Issue:** The new worktree handling duplicates spec-artifact path logic in multiple places: `specDir`, main-repo/root selection, directory creation, file copying, and artifact staging are all recomputed separately for `retro.json` and `report.json`. This makes the finalize step harder to follow and easy to drift if another artifact is added later.  
**Suggestion:** Extract a small helper such as `getArtifactRepoRoot(state, root, mainRepoPath)` plus `copySpecArtifact({ fromRoot, toRoot, specPath, fileName })` or `stageSpecArtifacts(repoRoot, specPath, fileNames)`. That would remove repeated path assembly and keep artifact handling consistent.

2. ### 2. Move Report Artifact Responsibility Out Of `finalize`
**File:** `src/flow/run/finalize.js`  
**Issue:** `finalize.js` is an orchestration entrypoint, but the new code now also owns low-level persistence and git commit behavior for `retro.json` and `report.json`. That breaks the existing pattern where specialized modules such as `src/flow/commands/report.js` encapsulate report-specific behavior.  
**Suggestion:** Move the save/copy/commit logic into `src/flow/commands/report.js` or a dedicated artifact module. `finalize.js` should ideally generate the report and delegate artifact persistence through a single function call.

3. ### 3. Replace Ambiguous Variable Names
**File:** `src/flow/run/finalize.js`  
**Issue:** Several new names are imprecise for what they actually represent. `reportRoot` is not just for report saving; it is also the git repo used to add and commit artifacts. `specTitle` is derived from the spec directory name, so it is closer to a spec ID/slug than a title. `srcRetro` and `dstRetro` are also abbreviated compared with surrounding code style.  
**Suggestion:** Rename to clearer intent-revealing names such as `artifactRepoRoot`, `specId`, `sourceRetroPath`, and `targetRetroPath`. That makes the worktree/main-repo behavior easier to reason about.

4. ### 4. Normalize Repeated Git No-Op Handling
**File:** `src/flow/run/finalize.js`  
**Issue:** The new artifact commit path introduces another ad hoc `git add` + `git commit` block with its own `"nothing to commit"` detection. Similar logic already exists in step 1 and step 4. This is duplicate control flow and increases the chance of inconsistent behavior and error formatting across steps.  
**Suggestion:** Introduce a shared helper such as `commitPathsIfChanged(cwd, paths, message)` or `runGitCommit({ cwd, add, message })` that centralizes `execFileSync`, no-op detection, and returned status. Reuse it for commit, sync, and report artifact commits.

5. ### 5. Eliminate The Extra Retro Copy Step By Writing To The Target Repo Once
**File:** `src/flow/run/finalize.js`  
**Issue:** The new `retro.json` copy block is a compensating step that exists only because retro output is first written in one place and then mirrored into another in worktree mode. That adds extra filesystem code, another failure path, and a new `fs` dependency to `finalize.js`.  
**Suggestion:** Refactor `flow run retro` or a shared artifact writer so `retro.json` is written directly to the final repository location in worktree mode. That removes the copy branch entirely and simplifies finalize into orchestration rather than file synchronization.

**Verdict:** APPROVED
**Reason:** `specDir` computation and path assembly for worktree vs. non-worktree mode appear in at least three separate places (R1 retro copy at line 153–155, R2 report save at line 275, R3 artifact commit at line 285–286). A small helper like `getArtifactRepoRoot()` and `copySpecArtifact()` would genuinely reduce duplication and make it harder to drift if more artifacts are added. This is a real maintainability improvement, not cosmetic.
