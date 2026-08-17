# Code Review Results

### [x] 1. Extract repeated `git diff` execution logic
**File:** `src/flow/commands/review.js`  
**Issue:** `collectCommittedAndStagedDiff` duplicates the same pattern twice (`runGit` → check `ok` → check trimmed stdout → push). This increases maintenance cost and risks divergence in behavior/error handling.  
**Suggestion:** Introduce a small helper (e.g. `runDiffOrThrow(args, errorLabel)`) that returns stdout or throws, then call it for committed/staged diffs. This removes duplication and keeps failure handling consistent.

**Verdict:** APPROVED
**Reason:** This is real duplication in error/empty-output handling, and a small helper can centralize it without behavior change if it keeps the same args, throw conditions, and returned stdout.

### [ ] 2. Tighten constant naming to match actual scope
**File:** `src/flow/commands/review.js`  
**Issue:** `REVIEW_EXCLUDE_PATHS` sounds globally applicable to all review modes, but it is only used in the fallback whole-repo diff path when `filePath` is absent.  
**Suggestion:** Rename to something scope-specific like `FALLBACK_DIFF_EXCLUDE_PATHS` (or `WHOLE_REPO_DIFF_EXCLUDE_PATHS`) to make intent and usage constraints explicit.

**Verdict:** REJECTED
**Reason:** This is primarily naming/cosmetic. It marginally improves readability but does not materially improve quality, so it doesn’t clear a conservative refactor bar.

### [x] 3. Isolate pathspec construction for readability
**File:** `src/flow/commands/review.js`  
**Issue:** `fileArgs` now contains conditional pathspec logic inline, including exclusions and magic pathspec syntax (`:!`). This mixes policy with command execution and makes the function harder to scan.  
**Suggestion:** Move this into a dedicated helper (e.g. `buildReviewDiffPathspec(filePath)`), returning either `["--", filePath]` or `["--", ".", ...excludes]`. This keeps `collectCommittedAndStagedDiff` focused on orchestration and improves design consistency.

**Verdict:** APPROVED
**Reason:** Pathspec policy is currently mixed into orchestration logic; extracting it into a dedicated builder improves separation of concerns. Behavior should remain unchanged if the helper returns the exact same argument arrays (`["--", filePath]` vs `["--", ".", ...:!excludes]`).
