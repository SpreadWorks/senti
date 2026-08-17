# Code Review Results

### [x] 1. ### Extract shared test-code rendering
**File:** `src/flow/commands/review.js`
**Issue:** `buildGapAnalysisPrompt` and `buildTestFixPrompt` both duplicate the same `testFiles -> markdown/code block` serialization logic. That makes prompt formatting harder to change consistently.
**Suggestion:** Introduce a small helper such as `formatTestFilesForPrompt(testFiles, emptyText = "(no test files found)")` and reuse it from both prompt builders.

2. ### Split test review pipeline into its own module
**File:** `src/flow/commands/review.js`
**Issue:** The new `--phase test` flow adds a large second workflow into a file that already owns the normal review command. The file now mixes CLI handling, classic review flow, prompt construction, parsing, file collection, auto-fix orchestration, and markdown formatting.
**Suggestion:** Move the test-phase logic into a dedicated module such as `src/flow/review/test-phase.js` or `src/flow/commands/review-test.js`, and keep `review.js` focused on argument routing and shared command concerns.

3. ### Remove unused exported internals
**File:** `src/flow/commands/review.js`
**Issue:** `MAX_TEST_REVIEW_RETRIES`, `extractRequirements`, `collectTestFiles`, `parseGaps`, `applyTestFixes`, and `formatTestReviewMd` are newly exported, but the added tests do not use them. That expands the module API without a clear caller.
**Suggestion:** Keep these helpers private unless another module or test imports them. If they need to be tested directly, move them into a dedicated helper module and export them there intentionally.

4. ### Use more specific helper names
**File:** `src/flow/commands/review.js`
**Issue:** Names like `parseGaps` and `applyTestFixes` are broad and lose context in a file that already handles other review phases. They read like generic utilities rather than test-review-specific behavior.
**Suggestion:** Rename them to phase-specific names such as `parseTestReviewGaps`, `writeTestFixFiles`, `buildTestGapAnalysisPrompt`, and `buildTestAutoFixPrompt` so the workflow is easier to follow.

5. ### Consolidate subprocess result parsing with the existing review envelope flow
**File:** `src/flow/run/review.js`
**Issue:** `parseTestReviewOutput` introduces a second ad hoc success/failure formatting path alongside the existing envelope logic in `execute`. The wrapper now has two parallel result-shaping branches with similar responsibilities.
**Suggestion:** Extract a shared result builder for review subprocesses, or make phase parsers return a normalized object that one final `ok/fail` formatter consumes. That keeps design consistent as more phases are added.

6. ### Simplify test file collection precedence logic
**File:** `src/flow/commands/review.js`
**Issue:** `collectTestFiles` has two near-identical directory checks and relies on call order plus `Map#set` overwrite behavior to express precedence. The behavior is correct but implicit.
**Suggestion:** Replace the duplicated blocks with a small loop over an ordered source list, for example `[projectTests, specTests]`, and document precedence in code through that structure rather than comments alone.

**Verdict:** APPROVED
**Reason:** `buildGapAnalysisPrompt` and `buildTestFixPrompt` both contain identical `testFiles.map(f => ...).join("\n\n")` serialization and the same `"(no test files found)"` fallback pattern. A shared `formatTestFilesForPrompt()` helper eliminates a real DRY violation and reduces the risk of prompt formatting diverging between the two paths. Low-risk extraction with clear benefit.
