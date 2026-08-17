# Code Review Results

### [x] 1. Extract shared review-failure message logic
**File:** `src/flow/lib/run-review.js`  
**Issue:** `parseSpecReviewOutput` and `parseTestReviewOutput` now contain nearly identical branching for `count === 0`, `count !== null`, and generic subprocess errors. This duplicates control flow and message construction, which makes future changes easy to miss in one parser.  
**Suggestion:** Introduce a small shared helper such as `buildReviewFailureDetail({ kind, count, unit })` or a generic parser factory, and have both functions delegate to it. That keeps spec/test review behavior aligned and removes repeated ternary logic.

**Verdict:** APPROVED
**Reason:** The `!res.ok` branching in `parseSpecReviewOutput` (lines 65–73) and `parseTestReviewOutput` (lines 27–35) is structurally identical — only the label ("Spec"/"Test"), unit ("issue"/"gap"), and count variable differ. The project's own coding rules mandate extraction at 2 occurrences ("2箇所以上で繰り返される場合、共通ヘルパーに抽出すること"). A small `buildReviewErrorDetail({ kind, count, unit })` helper eliminates the duplicated ternary chain and ensures future error-message changes (e.g. adding more context) are applied consistently to both parsers.

### [ ] 2. Keep verification inside the retry loop
**File:** `src/flow/commands/review.js`  
**Issue:** The new verification pass is implemented as a second phase after the main loop. That works, but it splits one review cycle across two control-flow regions and makes `finalIssues`/`history` updates happen in two different places. The design is now less consistent with the existing `detect -> fix -> decide` pattern.  
**Suggestion:** Restructure the loop so the last attempt explicitly becomes `detect -> fix -> verification detect`, with verdict/final state decided in one place. That will simplify reasoning about retries, reduce mutable state handling after the loop, and make the retry semantics clearer.

**Verdict:** REJECTED
**Reason:** The current post-loop verification block is well-isolated (~10 lines, clearly commented) and its guard condition (`finalIssues.length > 0 && !dryRun`) is trivially auditable. Folding it into the loop would require special-casing the last iteration with a "verification" flag or `attempt === maxRetries` branch, making the loop's control flow harder to reason about. The existing separation between "retry cycles" and "final verification" is a feature, not a defect — it maps directly to the spec's "detect → fix → verification detect" design. The proposal trades clear structure for tighter coupling with marginal benefit and real risk of introducing off-by-one errors in retry semantics.

### [ ] 3. Remove repeated module imports in tests
**File:** `specs/137-fix-review-exit-code/tests/review-exit-code.test.js`  
**Issue:** Most test cases repeatedly call `await import(...)` for the same modules, even though the module instances are reused. This adds noise and makes the test intent harder to scan.  
**Suggestion:** Import `review.js` and `run-review.js` once per `describe` block or once at file scope, then reuse the loaded exports. That eliminates duplication and makes each test focus only on its scenario rather than setup boilerplate.

**Verdict:** REJECTED
**Reason:** This is cosmetic-only. ES module `import()` calls are cached by the runtime after the first resolution, so the repeated `await import(...)` calls have no behavioral or performance impact. The test file is under `specs/` (not shipped production code), and each test case being self-contained with its own import makes it independently runnable and readable without scrolling to a shared setup block. The refactoring adds no functional value and introduces minor risk of stale module references if tests are later reorganized.
