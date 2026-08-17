# Code Review Results

### [x] 1. Extract Report Posting Into a Reusable Helper
**File:** `src/flow/run/finalize.js`
**Issue:** The new issue-comment block adds another inline responsibility to `finalize.js`, which already duplicates report-building logic found in `src/flow/run/report.js`. This makes the finalize step harder to read and increases the chance that report generation/posting behavior diverges across commands.
**Suggestion:** Move report collection and issue-posting into a shared helper, for example in `src/flow/commands/report.js`, so both `flow run report` and `flow run finalize` can call the same code path.

**Verdict:** APPROVED
**Reason:** `finalize.js` already imports `generateReport`/`saveReport` from `report.js`, so the report module is the natural home for posting logic too. Extracting a `postReportToIssue()` helper prevents report-building and posting behavior from diverging if a standalone `flow run report` command later wants to post as well. This is a genuine cohesion improvement, not cosmetic.

### [x] 2. Standardize `gh` Availability Checks
**File:** `src/flow/run/finalize.js`
**Issue:** This change uses `isGhAvailable()` from `src/lib/git-state.js`, but similar `gh` checks still exist in `src/flow/commands/merge.js` and `src/flow/get/check.js`. The project now has multiple patterns for the same capability check.
**Suggestion:** Consolidate all GitHub CLI availability checks behind `src/lib/git-state.js` and remove the local duplicates. That keeps behavior, timeout handling, and naming consistent.

**Verdict:** APPROVED
**Reason:** The codebase has a shared `isGhAvailable()` in `git-state.js` already used by `resolve-context.js` and now `finalize.js`, but `merge.js` still has its own local `isGhAvailable()` and `check.js` has yet another inline variant. Consolidating behind the shared helper eliminates behavioral drift (e.g., `merge.js`'s version uses `stdio: "ignore"` without a timeout, while `git-state.js` sets `timeout: 5000`). Clear deduplication with concrete risk reduction.

### [ ] 3. Make the Result Key Action-Oriented
**File:** `src/flow/run/finalize.js`
**Issue:** `results.issueComment` is vague. It describes the target object, not the action performed, and is less clear next to action-based entries like `commit`, `merge`, and `sync`.
**Suggestion:** Rename it to something like `reportComment` or `postReport` so the result shape reflects the step that actually ran.

**Verdict:** REJECTED
**Reason:** Cosmetic rename. The existing key `issueComment` is adequately descriptive alongside `commit`, `retro`, and `report`. The sibling keys are a mix of nouns and verbs already (`commit` is ambiguous, `sync` is a verb). Renaming adds churn without meaningful clarity gain, and any consumers already using the key would break.

### [x] 4. Return an Explicit Skipped Status for the New Step
**File:** `src/flow/run/finalize.js`
**Issue:** The new step only writes `results.issueComment` on success or failure. If `state.issue` is missing, `gh` is unavailable, or `results.report.text` is absent, the step silently disappears from the result object. That is inconsistent with the rest of the finalize pipeline, which usually reports `done`, `failed`, `dry-run`, or `skipped`.
**Suggestion:** Always set a result entry for this step, using `skipped` with a concrete reason such as `no linked issue`, `gh unavailable`, or `report text missing`.

**Verdict:** APPROVED
**Reason:** This is a real consistency gap. Every other step in the pipeline reports `done`/`failed`/`skipped`/`dry-run`, but this new step silently disappears from `results` when preconditions aren't met. The bottom-of-function `STEP_MAP` loop (lines 307-309) only backfills the four canonical steps, so `issueComment` would be absent with no explanation. Adding explicit `skipped` entries with reasons improves debuggability and aligns with existing conventions.

### [x] 5. Avoid Hardcoding Another Raw `gh` Invocation in `finalize`
**File:** `src/flow/run/finalize.js`
**Issue:** The new `execFileSync("gh", ["issue", "comment", ...])` call introduces another direct CLI integration path inside a large orchestrator. This pushes command construction and error formatting into the flow runner instead of a dedicated boundary.
**Suggestion:** Wrap GitHub issue commenting in a small helper such as `commentOnIssue(issueNumber, body, cwd)` in `src/lib/git-state.js` or a flow command helper, then have `finalize.js` call that abstraction. This reduces duplication and keeps orchestration code focused on step sequencing.

**Verdict:** APPROVED
**Reason:** This pairs well with proposal #1 and #2. `finalize.js` is an orchestrator; embedding `execFileSync("gh", ["issue", "comment", ...])` directly mixes command construction with step sequencing. A small `commentOnIssue()` helper in `git-state.js` (which already wraps `gh` calls via `tryExec`) would keep the boundary consistent and make the operation testable in isolation. This is a legitimate separation-of-concerns improvement, not just indirection for its own sake.
