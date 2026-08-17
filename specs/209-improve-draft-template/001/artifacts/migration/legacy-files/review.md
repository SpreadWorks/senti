# Code Review Results

### [x] 1. Reduce Repeated “created file” Message Construction
**File:** `src/flow/lib/run-prepare-spec.js`  
**Issue:** The same `created spec/qa/draft` message lines are repeated in multiple branches (`worktree`, `skipBranch`, default), which increases maintenance cost and drift risk.  
**Suggestion:** Build a small helper that returns common created-file lines (or iterates over the `changed` array) and reuse it in all three branches.

**Verdict:** APPROVED
**Reason:** This is a real maintainability improvement with low behavior risk if it only centralizes shared `created ...` line generation and keeps branch-specific messaging unchanged.

### [x] 2. Tighten Development Type Value Matching
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `DRAFT_DEV_TYPE_VALUE_RE` is not line-anchored, so it can match unintended inline occurrences outside the intended field line.  
**Suggestion:** Anchor the regex to line start with multiline mode (e.g. `^\s*...` with `/m`) so only actual `開発種別` / `Development Type` field lines are parsed.

**Verdict:** APPROVED
**Reason:** Anchoring to actual field lines reduces false positives from incidental inline text and better matches intended parsing semantics, with minimal risk when implemented to preserve current accepted label formats.

### [ ] 3. Improve Naming Consistency for Development Type Constants
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `DRAFT_DEV_TYPE_ENUM` and `DRAFT_DEV_TYPE_VALUE_RE` abbreviate “development” as `DEV`, while surrounding code/messages use “development type” explicitly; this is slightly inconsistent and less searchable.  
**Suggestion:** Rename to fully explicit names such as `DRAFT_DEVELOPMENT_TYPES` and `DRAFT_DEVELOPMENT_TYPE_VALUE_RE` for readability and convention consistency.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic renaming; it adds churn without materially improving behavior or robustness.

### [x] 4. Extract Repeated Test Assertions
**File:** `tests/unit/flow/check-draft-text.test.js`  
**Issue:** Many tests repeat the same pattern: run `checkDraftText`, then `assert.ok(issues.some(...), JSON.stringify(issues))`.  
**Suggestion:** Add a local helper like `assertHasIssue(text, predicate, message)` (and optionally `assertNoIssues(text)`) to reduce duplication and make each test intention clearer.

**Verdict:** APPROVED
**Reason:** Consolidating repeated assertion patterns in tests can improve readability and reduce maintenance cost, and it does not affect production behavior if helper logic is thin and explicit.

### [ ] 5. Remove Duplicated Mandatory Rules Between Modes
**File:** `src/flow/prompts/plan/draft.md`  
**Issue:** The “MUST” constraints for required draft sections/fields are repeated in both auto and interactive branches with near-identical content, which can diverge over time.  
**Suggestion:** Keep one canonical “required draft structure” block and have each branch reference it, so updates happen in one place only.

**Verdict:** REJECTED
**Reason:** In prompt files, “referencing” a shared block can be fragile unless there is a guaranteed include mechanism; it risks dropping critical instructions in one branch and changing runtime behavior.
