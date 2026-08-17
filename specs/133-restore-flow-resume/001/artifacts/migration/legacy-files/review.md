# Code Review Results

### [x] 1. Reuse the shared `gh` probe instead of re-implementing it
**File:** `src/flow/lib/get-check.js`
**Issue:** `checkGh()` now inlines `execFileSync("gh", ["--version"])` again, duplicating the GitHub CLI availability logic that already exists in `src/lib/git-state.js`. This invites drift in timeout, error handling, and summary behavior.
**Suggestion:** Restore a shared helper-based design. Reuse `isGhAvailable()` for the boolean check, and if the version string is needed, add a dedicated shared helper such as `getGhVersion()` in `src/lib/git-state.js`.

**Verdict:** APPROVED
**Reason:** Confirmed: `get-check.js` (line 46–61) reimplements `gh --version` probing with `execFileSync` + `try/catch` and a 5000ms timeout — this is exactly what `isGhAvailable()` in `git-state.js` (line 50–52) already does via `tryExec`. The only additional value in `checkGh()` is capturing the version string for the summary. This is real duplication that can drift independently. The fix is straightforward: call `isGhAvailable()` for the boolean, and if the version string is needed for the summary, add a `getGhVersion()` helper or call `tryExec("gh", ["--version"])` once and derive both.

### [x] 2. Remove the redundant dynamic import and variable shadowing
**File:** `src/flow/lib/run-finalize.js`
**Issue:** `loadIssueLog` is already imported at module scope, but `executeCommitPost()` dynamically imports it again and shadows the existing binding. This adds unnecessary indirection and makes the control flow harder to follow.
**Suggestion:** Delete the inner `await import("./set-issue-log.js")` block and call the top-level `loadIssueLog` import directly.

**Verdict:** APPROVED
**Reason:** Confirmed: `loadIssueLog` is statically imported at line 17 (`import { loadIssueLog, saveIssueLog } from "./set-issue-log.js"`), yet line 157 does `const { loadIssueLog } = await import("./set-issue-log.js")` which shadows it needlessly. There is no lazy-load justification — the module is already in the dependency graph via the static import and is used elsewhere in the file (e.g., `finalizeOnError` at line 29). This is a clear bug-in-waiting that adds runtime cost and cognitive overhead. Trivial fix: delete line 157 and use the existing binding.

### [x] 3. Restore module responsibility consistency in `git-state.js`
**File:** `src/lib/git-state.js`
**Issue:** The header was changed back to “All functions are read-only,” but the module still appears to contain `commentOnIssue()` according to the broader change set metadata. That makes the module contract misleading.
**Suggestion:** Either move side-effecting GitHub operations into a separate helper module, or keep them here and update the module header to state that it contains both state queries and GitHub actions.

**Verdict:** APPROVED
**Reason:** Confirmed: The header at lines 4–5 states "Shared helpers for reading Git and GitHub CLI state" and "All functions are read-only (no side effects)." However, `commentOnIssue()` (lines 61–72) executes `gh issue comment` — a mutating write operation that posts to GitHub. The documented contract is factually wrong. Either move `commentOnIssue` out or update the header. This is a real design consistency issue, not cosmetic.

### [ ] 4. Eliminate top-level command dispatch duplication
**File:** `src/flow.js`
**Issue:** `resume` was added with a new special-case branch that duplicates the existing top-level handling pattern already used for `prepare`. As more top-level commands are added, this will keep growing into repetitive branching.
**Suggestion:** Normalize top-level commands behind a small lookup table or shared helper so `prepare`, `resume`, and future top-level entries use the same dispatch path.

**Verdict:** REJECTED
**Reason:** There are currently only two top-level commands (`resume` and `prepare`), and they are not identical — `prepare` has additional config validation logic that `resume` does not. At two instances with differing behavior, a lookup table would add indirection without meaningful DRY improvement. The branching is clear and localized. This becomes worthwhile only if a third top-level command with the same pattern is added. Premature abstraction.

### [ ] 5. Avoid reintroducing single-phase review special-casing
**File:** `src/flow/commands/review.js`
**Issue:** The previous shared review-loop abstraction was removed and replaced with a hand-rolled loop specific to test review. That simplifies the current file, but it also bakes phase behavior back into imperative control flow and makes future review-phase expansion more repetitive.
**Suggestion:** Keep the simplified test-only behavior if spec review is intentionally removed, but extract the retry loop into a narrowly named helper such as `runRetryingGapReview()` so the loop mechanics stay reusable without reviving the full previous abstraction.

**Verdict:** REJECTED
**Reason:** The diff shows that `runReviewLoop` and the entire spec review pipeline were intentionally removed, leaving only a test review loop. The hand-rolled loop in `runTestReview` is now the *only* review loop in the codebase — there is no duplication to extract from. Extracting a `runRetryingGapReview()` helper from a single call site adds indirection with zero reuse benefit. The project's own CLAUDE.md explicitly warns against "extracting functions called from only one place." If a second review phase is re-added later, that's the right time to extract.
