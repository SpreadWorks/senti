# Code Review Results

### [ ] 1. Extract Issue Comment Posting Into a Dedicated Helper
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** The new `issueComment` block mixes three concerns in `executeCommitPost()`: precondition checks, GitHub CLI execution, and result-shape construction. It also repeats the same `{ status: "skipped", reason: ... }` pattern several times.  
**Suggestion:** Move this block into a helper such as `postReportComment({ issue, reportText, root })` that returns a normalized result object. This removes branching noise from `executeCommitPost()` and keeps the finalize post-hook focused on orchestration.

**Verdict:** REJECTED
**Reason:** The `issueComment` block is 15 lines of straightforward sequential logic — precondition guard → call → result assignment. Extracting it into a separate helper function at this size adds indirection without meaningful improvement. The `{ status: "skipped", reason: ... }` pattern is the same structure used throughout `executeCommitPost()` for all result entries (report, merge, etc.), so it's a consistent local convention, not duplication. Refactoring this now is premature; it becomes worthwhile only if a second caller needs the same logic.

### [x] 2. Restore Module Responsibility Consistency
**File:** `src/lib/git-state.js`  
**Issue:** The file header says “All functions are read-only (no side effects)”, but `commentOnIssue()` now performs a mutating `gh issue comment`. That makes the module contract misleading and weakens design consistency.  
**Suggestion:** Either move `commentOnIssue()` into a dedicated side-effecting GitHub helper module, or rename/re-document `git-state.js` so its responsibility clearly includes GitHub actions as well as state inspection.

**Verdict:** APPROVED
**Reason:** `git-state.js` line 5 explicitly states "All functions are read-only (no side effects)". `commentOnIssue()` performs a mutating `gh issue comment` write operation, directly violating the module's documented contract. This is a real design consistency issue. The function should be moved to a separate side-effecting module (e.g., `src/lib/gh-actions.js`) or, at minimum, the module header must be updated. Given the project's stated principle of "deep modules with clear interfaces," keeping the read-only invariant and moving `commentOnIssue` out is the better path.

### [x] 3. Remove `gh` Availability Check Duplication
**File:** `src/flow/lib/get-check.js`  
**Issue:** `checkGh()` reimplements the same `gh --version` probing logic already centralized in `isGhAvailable()`. This creates duplicate behavior and increases the chance of drift if the check changes later.  
**Suggestion:** Reuse `isGhAvailable()` here. If the version string is still needed for the summary, add a shared helper like `getGhVersion()` in `src/lib/git-state.js` and build both callers on top of it.

**Verdict:** APPROVED
**Reason:** `checkGh()` in `get-check.js` (line 46–56) reimplements `gh --version` probing with `execFileSync` + `try/catch`, which is exactly what `isGhAvailable()` in `git-state.js` already does via `tryExec`. The only difference is `checkGh()` also captures the version string for its summary. The fix is straightforward: call `isGhAvailable()` for the boolean check and optionally expose the version string via a shared helper. This eliminates real duplication that could drift (e.g., different timeouts — `isGhAvailable` uses 5000ms, `checkGh` also uses 5000ms, but they're defined independently).

### [x] 4. Eliminate the Redundant Dynamic Import Nearby
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `loadIssueLog` is already imported at module scope, but inside the report section it is imported again dynamically before use. That adds unnecessary indirection and makes the function read as more complex than it is.  
**Suggestion:** Use the existing top-level `loadIssueLog` import directly and remove the inner dynamic import unless there is a specific lazy-load requirement.

**Verdict:** APPROVED
**Reason:** `loadIssueLog` is already imported at the top of the file (line 17: `import { loadIssueLog, saveIssueLog } from "./set-issue-log.js"`), yet line 158 does `const { loadIssueLog } = await import("./set-issue-log.js")` redundantly. This shadows the top-level import with an unnecessary dynamic import, adding both runtime cost and cognitive overhead. There's no lazy-load justification — the module is already in the dependency graph. The fix is trivial: delete the dynamic import and use the existing top-level binding.
