# Code Review Results

### [x] 1.


**Verdict:** APPROVED
**Reason:** This is a real correctness bug. `contextEntries` is computed once before `runReviewLoop()` (lines 644–656), but `fix()` rewrites `spec.md`, changing its Goal/Scope sections. Subsequent `detect()` iterations use stale `contextEntries` derived from the old spec text. The test-review pipeline correctly refreshes `testFiles` after each fix (line 515), but spec-review does not refresh `contextEntries`. Moving `contextSearch` into `detect()` (or after `fix()`) would ensure each iteration reviews the current spec against relevant context.

### [ ] 1. Refresh spec context after each auto-fix
**File:** `src/flow/commands/review.js`
**Issue:** `contextEntries` is computed once before `runReviewLoop()`, but `fix()` can rewrite `spec.md`. Later iterations then review the updated spec against stale context, while the test phase correctly refreshes `testFiles` after each fix.
**Suggestion:** Recompute `specText`, `searchQuery`, and `contextEntries` inside `detect()` or immediately after a successful spec fix so every iteration analyzes the current spec with current codebase context.

2.

**Verdict:** REJECTED
**Reason:** While `parseSpecReviewOutput()` and `parseTestReviewOutput()` share structural similarity, they differ in meaningful ways: different regex keys (`gaps=` vs `issues=`), different artifact shapes (`gapCount` vs `issueCount`), different error messages, and different `next` values (`"implement"` vs `"approval"`). These are only ~30 lines each and the "duplication" is superficial pattern similarity, not identical logic. Abstracting into a config-driven helper would obscure the per-phase semantics for minimal DRY gain, and would need to be re-extended for every future phase anyway. Not worth the indirection.

### [ ] 2. Remove phase-specific parser duplication
**File:** `src/flow/lib/run-review.js`
**Issue:** `parseSpecReviewOutput()` largely duplicates the structure of `parseTestReviewOutput()`: regex extraction, changed-artifact collection, error construction, and result shaping. This will keep growing as more review phases are added.
**Suggestion:** Extract a shared `parseReviewOutput({ phase, countKey, failureLabel })` helper or a phase-to-parser config map, and keep only the truly phase-specific fields configurable.

3.

**Verdict:** REJECTED
**Reason:** Premature modularization. There are currently only two phases (test, spec), and they share `runReviewLoop()` and utility functions defined in the same file. Splitting into `review-test.js` and `review-spec.js` would scatter closely related code across files, require re-exporting shared helpers, and increase the import graph — all for a file that is still of manageable size. The project's own CLAUDE.md says "prefer deep modules over thin wrappers." Revisit when a third phase is added.

### [x] 3. Split review phase implementations instead of growing one command file
**File:** `src/flow/commands/review.js`
**Issue:** The file now mixes generic loop orchestration, test-review prompts/formatting, spec-review prompts/formatting, CLI handling, and file I/O. The new spec-review code follows the same overall pattern as test-review but is implemented inline, making the command harder to scan and maintain.
**Suggestion:** Move phase-specific logic into separate modules such as `review-test.js` and `review-spec.js`, and keep `review.js` as a thin dispatcher plus shared utilities like `runReviewLoop()`.

4.

**Verdict:** APPROVED
**Reason:** Phase names and descriptions are duplicated across `review.js` validation (`["test", "spec"].includes()`), help text strings, and `registry.js` help text. Adding a new phase requires updating all three locations independently, which is error-prone. A single `REVIEW_PHASES` metadata object (or even a simple array + description map) referenced from both files would eliminate this class of inconsistency bug with minimal complexity cost.

### [x] 4. Centralize review phase metadata
**File:** `src/flow/commands/review.js`
**Issue:** Supported phase names and descriptions are now duplicated across validation, help text, and dispatch logic (`"test"`, `"spec"`, human-readable descriptions). Similar text is also repeated in `src/flow/registry.js`, which makes future phase additions easy to update incompletely.
**Suggestion:** Define a single `REVIEW_PHASES` metadata object or array and derive validation, help output, and dispatch from it. Reuse that metadata from the registry instead of duplicating phase descriptions.

5.

**Verdict:** APPROVED
**Reason:** The `fix()` closure (lines 678–720) does too much: reads the spec, parses proposals, loads and configures a validation agent, calls the validation agent, filters results, builds a fix prompt, calls the fix agent, cleans fenced output, and writes the file. Critically, `loadAgentConfig` and `ensureAgentWorkDir` for the validation agent are called on every fix iteration despite returning the same result — an unnecessary cost. Extracting this into a named helper (e.g., `applyApprovedSpecProposals()`) and hoisting the validation agent initialization outside the loop would both improve readability and eliminate redundant work. This is a substantive improvement, not cosmetic.

### [ ] 5. Extract spec-fix validation/application into a dedicated helper
**File:** `src/flow/commands/review.js`
**Issue:** The `fix()` closure inside `runSpecReview()` combines multiple responsibilities: reading the spec, parsing proposals, loading the validation agent, validating proposals, filtering approvals, generating the fix prompt, normalizing fenced output, and writing the file. This is harder to test and less consistent with the new shared-loop abstraction.
**Suggestion:** Extract that flow into a helper such as `applyApprovedSpecProposals()` and initialize reusable dependencies like the validation agent once outside the retry loop. This will reduce nesting and make the spec-review pipeline easier to reason about.

**Verdict:** REJECTED
**Reason:** No verdict provided
