# Code Review Results

### [x] 1. Centralize Review Failure Reporting
**File:** `src/docs/commands/review.js`  
**Issue:** The command now repeats the same pattern in many places: `console.log(...)` followed by `fail = 1`. That duplication makes it easier for future checks to forget setting the exit status or to format messages inconsistently.  
**Suggestion:** Extract a small helper such as `reportFailure(message)` or `failCheck(key, params)` that logs the message and flips the failure flag once. Use it for all fail conditions.

**Verdict:** APPROVED
**Reason:** The diff clearly shows a growing pattern of `console.log(...); fail = 1;` repeated across many check blocks (unfilled text, unfilled data, analysis missing, README missing, lang dir missing, uncovered category). A `reportFailure()` helper would reduce the risk of forgetting `fail = 1` after a log (which was the exact bug this diff fixes for unfilled text/data checks that previously only warned). Genuine duplication with a real consistency risk.

### [x] 2. Restore Message Localization Consistency
**File:** `src/docs/commands/review.js`  
**Issue:** Several new failures are emitted as hard-coded English strings like ``[FAIL] docs/${lang}/ directory missing...`` and ``[FAIL] uncovered analysis category...``, while the rest of the command uses `t("messages:...")`. This breaks the existing i18n pattern.  
**Suggestion:** Add locale entries for the new failure cases in `src/locale/en/messages.json` and `src/locale/ja/messages.json`, then route all review output through `t(...)` for consistent formatting and translation support.

**Verdict:** APPROVED
**Reason:** The diff introduces hard-coded English strings like `[FAIL] docs/${lang}/ directory missing...` and `[FAIL] uncovered analysis category: ${cat}...` while all other failure messages use `t("messages:...")` with locale entries in both `en/messages.json` and `ja/messages.json`. This is a clear regression in i18n consistency and breaks the established pattern. The fix is straightforward — add locale keys and route through `t()`.

### [ ] 3. Rename `readmePath2`
**File:** `src/docs/commands/review.js`  
**Issue:** `readmePath2` is a low-signal name and suggests leftover refactoring rather than intentional design.  
**Suggestion:** Rename it to `readmePath` and, if needed, scope it more tightly so there is no naming conflict.

**Verdict:** REJECTED
**Reason:** This is a cosmetic rename with no behavioral improvement. The variable is locally scoped within the coverage-check block and its meaning is unambiguous in context. The risk of introducing a naming conflict or missed reference outweighs the negligible readability gain.

### [ ] 4. Extract Reusable Test Execution Helper
**File:** `tests/docs/commands/review.test.js`  
**Issue:** The test file still duplicates review command execution details across `runReview` and `runReviewExpectFail`, including the same `execFileSync` arguments and environment setup.  
**Suggestion:** Replace both with a single helper like `execReview(tmp, { expectFailure: true })` that returns normalized `{ stdout, stderr, status }`. This removes duplication and makes future test additions simpler.

**Verdict:** REJECTED
**Reason:** The diff already extracts `runReview()` and `runReviewExpectFail()` — this proposal is essentially asking to merge them into one. The current two-function approach is already clean and each function is simple (4-5 lines). Merging them into `execReview(tmp, { expectFailure })` adds indirection without meaningful deduplication. The current code is clear enough.

### [ ] 5. Replace Repeated Chapter Fixture Construction
**File:** `tests/docs/commands/review.test.js`  
**Issue:** Many tests manually build chapter content arrays with the same “H1 + blank line + numbered lines” structure. `writeValidChapter` helps, but several tests still reimplement the pattern inline.  
**Suggestion:** Add a fixture helper such as `makeChapter({ extraLines, body, valid })` or extend `writeValidChapter` so tests can override only the relevant part. That will reduce noise and make each test focus on the specific failure condition.

**Verdict:** REJECTED
**Reason:** The diff already introduces `writeValidChapter()` and `setupPassingTmp()` helpers that handle the common case. The remaining inline chapter constructions are intentionally different — they test specific failure conditions (missing H1, unfilled directives, specific data patterns) where the inline construction makes the test's intent clearer. Abstracting these further would obscure what each test is actually verifying.

### [x] 6. Avoid Inline Review Logic for Analysis Metadata Filtering
**File:** `src/docs/commands/review.js`  
**Issue:** `META_KEYS` is defined inline inside the coverage check and now includes a growing set of special-case keys. That logic is becoming policy-like rather than local implementation detail.  
**Suggestion:** Move metadata key classification into a named helper like `isAnalysisMetaKey(key)` or a shared constant near the top of the module. This makes the rule easier to maintain and keeps the coverage-check block simpler.

**Verdict:** APPROVED
**Reason:** `META_KEYS` grew from 5 to 6 entries in this diff (adding `_incrementalMeta`) and is likely to keep growing as new metadata fields are added to `analysis.json`. Extracting it as a module-level constant or `isAnalysisMetaKey()` function makes the policy explicit, easier to find, and reduces the chance of a new metadata key being missed. This is a maintenance improvement, not cosmetic.
