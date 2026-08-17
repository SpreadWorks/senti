# Code Review Results

### [x] 1. Reintroduce a single command-execution abstraction
**File:** `src/lib/process.js`
**Issue:** The refactor moved many callers back to direct `execFileSync`/`execFile` usage, so subprocess behavior is now duplicated across multiple files with slightly different error handling, encoding, timeout, and buffer rules.
**Suggestion:** Restore a shared helper layer in `src/lib/process.js` for sync/async command execution and migrate callers back to it. That will remove repeated `try/catch + execFileSync + String(...)` patterns and keep subprocess contracts consistent.

**Verdict:** APPROVED
**Reason:** The diff shows `process.js` was shrunk from `runCmd`/`runCmdAsync` (unified helpers) down to just `runSync`, and 14 files now import `execFileSync` directly with inconsistent error handling (some use try/catch returning empty strings, some rethrow, some ignore). This violates the project's own DRY rule ("2箇所以上で繰り返される場合、共通ヘルパーに抽出する"). The previous `runCmd` abstraction was deleted but its need clearly remains — `run-retro.js`, `run-gate.js`, `get-issue.js`, `flow-state.js`, `cli.js`, etc. all independently re-implement the same `try { execFileSync(..., { encoding: "utf8" }) } catch` pattern. Restoring a shared helper would reduce ~80 lines of duplicated boilerplate and ensure consistent timeout/maxBuffer/encoding defaults.

### [x] 2. Extract the repeated git summary collection logic
**File:** `src/flow/lib/run-finalize.js`
**Issue:** `run-finalize.js` and `src/flow/lib/run-report.js` now both implement the same “`git diff --stat` + `git log --format=%s`” collection logic inline, which invites drift.
**Suggestion:** Add a shared helper such as `collectGitSummary(root, baseBranch)` in a git utility module and reuse it from both commands.

**Verdict:** APPROVED
**Reason:** `run-finalize.js` (lines ~144–155) and `run-report.js` (lines ~28–37) contain near-identical 10-line blocks: `execFileSync("git", ["diff", "--stat", ...])` → trim → assign, then `execFileSync("git", ["log", "--format=%s", ...])` → trim → split → filter. The previous code had `collectGitSummary()` in `git-helpers.js` that served this exact purpose — it was deleted in this refactor. The project rule explicitly mandates extraction at 2 occurrences. This is a clear regression.

### [x] 3. Align module naming with actual responsibility
**File:** `src/lib/git-state.js`
**Issue:** The module is named `git-state`, but it also performs side-effecting GitHub operations like `commentOnIssue()`. That makes the name misleading and less consistent with the design.
**Suggestion:** Either rename it back to a broader name like `git-helpers.js` or split write actions into a separate module such as `github-cli.js`, leaving `git-state.js` read-only.

**Verdict:** APPROVED
**Reason:** `git-state.js` exports `commentOnIssue()` which performs a write operation (posts a GitHub issue comment via `gh issue comment`). The module name "state" implies read-only queries, making the API misleading. The diff shows this file was previously named `git-helpers.js` (which was more accurate) and was renamed to `git-state.js` in this refactor. Either splitting write operations into a separate `github-cli.js` module or reverting to a broader name like `git-helpers.js` would improve discoverability and align naming with actual behavior.

### [ ] 4. Extract duplicated diff-reading logic in review target resolution
**File:** `src/flow/commands/review.js`
**Issue:** `resolveReviewTarget()` repeats the same committed-vs-staged diff retrieval pattern twice, once for selected files and again for the fallback case.
**Suggestion:** Introduce a small helper like `collectDiffParts(root, baseBranch, file?)` or `readGitDiff(root, args)` to remove duplication and make the fallback path easier to follow.

**Verdict:** REJECTED
**Reason:** While the two code paths in `resolveReviewTarget()` (lines 61–71 and 78–83) both call `runSync("git", [..., "diff", ...])`, they serve different purposes with different arguments: the first iterates per-file with `--` file specifier on both committed and staged diffs, while the fallback collects the entire branch diff without file filtering. The structural similarity is shallow — extracting a helper would either need multiple parameters that obscure intent or would be a trivial 2-line wrapper. The current code is readable and the "duplication" is only in the `runSync` call pattern, not in real logic.

### [ ] 5. Remove the empty `aliases` boilerplate
**File:** `src/presets/ci/preset.json`
**Issue:** After removing `"github-actions"` from `aliases`, the file now keeps `"aliases": []`, which adds noise without conveying useful configuration.
**Suggestion:** Drop the empty `aliases` property entirely unless the preset loader requires it. That keeps preset definitions smaller and more consistent with minimal-config files.

**Verdict:** REJECTED
**Reason:** This is a cosmetic-only change. The empty `"aliases": []` is harmless and consistent with the explicit schema pattern used across other preset.json files (e.g., `github-actions/preset.json` also has `"aliases": []`). Removing it risks inconsistency if the preset loader expects the field to exist, and provides no functional improvement.

### [x] 6. Normalize git command wrappers instead of mixing styles
**File:** `src/flow/lib/run-sync.js`
**Issue:** This file now mixes `runSync()` and direct `execFileSync()` calls for related git operations, which makes the command-handling style inconsistent within the same module.
**Suggestion:** Standardize on one wrapper style per module. Prefer a small local helper or shared process helper so build, review, add, diff, and commit all follow the same result/error contract.

**Verdict:** APPROVED
**Reason:** `run-sync.js` imports both `execFileSync` from `child_process` (line 8) AND `runSync` from `process.js` (line 10), then uses `runSync()` for docs build/review but `execFileSync()` for git add/diff/commit operations — all within the same 100-line file. This inconsistency means error handling follows two different contracts: `runSync` returns `{ ok, status, stdout, stderr }` objects, while `execFileSync` throws on failure requiring try/catch. The same file shouldn't require callers to mentally switch between two result contracts. Standardizing on one style per module is a real quality improvement.

### [x] 7. Restore testable exports for parsing helpers
**File:** `src/flow/lib/run-review.js`
**Issue:** `parseTestReviewOutput` and `parseSpecReviewOutput` are now internal-only even though they contain non-trivial parsing logic and previously supported direct verification.
**Suggestion:** Re-export these pure helpers, or move them into a small parser module. That improves design consistency by separating subprocess orchestration from output parsing and makes the parsing logic easier to test independently.

**Verdict:** APPROVED
**Reason:** `parseTestReviewOutput` and `parseSpecReviewOutput` contain non-trivial logic: regex parsing of structured stderr output, conditional error construction based on gap/issue counts, and result normalization. The diff shows these were previously exported and had dedicated tests in `specs/136-fix-review-cmd-bugs/tests/review-bugs.test.js` (now deleted). Making them internal-only means the parsing logic — which has already had bugs (the "0 gap(s)" error message issue from spec #136) — can only be tested through subprocess integration tests. Re-exporting or extracting to a parser module improves testability for error-prone code.
