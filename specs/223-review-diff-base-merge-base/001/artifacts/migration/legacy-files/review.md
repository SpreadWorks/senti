# Code Review Results

### [x] 1. Consolidate repeated “committed + staged” diff traversal
**File:** `src/flow/commands/review.js`  
**Issue:** `collectCommittedAndStagedDiff` and `collectTouchedFiles` both implement the same two-source pattern (`git diff <baseRef>` + `git diff --cached`) with separate control flow, which duplicates logic and makes future scope changes error-prone.  
**Suggestion:** Extract a small shared helper like `forEachReviewDiffSource(baseRef, fn)` that yields both diff sources once, then reuse it in both functions (one for full patch output, one for `--name-only` collection).

**Verdict:** APPROVED
**Reason:** The two functions share the same diff-source iteration pattern; extracting only that iteration into a small helper reduces duplication without changing command semantics.

### [ ] 2. Tighten naming to reflect the actual invariant (merge-base SHA)
**File:** `src/flow/commands/review.js`  
**Issue:** The parameter name `baseRef` is generic, but in the new flow the intended value is specifically the merge-base SHA. This weakens readability and invites accidental branch-tip usage at call sites.  
**Suggestion:** Rename `baseRef` to `mergeBaseSha` (or `diffBaseSha`) in `collectCommittedAndStagedDiff` and `collectTouchedFiles`, and update JSDoc accordingly to make misuse harder.

**Verdict:** REJECTED
**Reason:** This is mostly cosmetic in JavaScript (parameter names do not enforce invariants), and these functions are still used with non-merge-base refs in tests; the rename adds little real safety.

### [ ] 3. Reduce public API surface for test-only export
**File:** `src/flow/commands/review.js`  
**Issue:** `resolveMergeBase` was added to the module exports primarily to support unit tests, which increases externally visible API surface for a command-internal helper.  
**Suggestion:** Keep it internal and expose test access through an explicit internal namespace (for example, `export const __internal = { resolveMergeBase }`) or test via higher-level command behavior, so the public export list stays command-focused.

**Verdict:** REJECTED
**Reason:** Hiding `resolveMergeBase` behind `__internal` (or removing export) risks breaking existing imports for minimal practical gain; command behavior quality does not materially improve.

### [x] 4. Extract branch-divergence fixture setup to a reusable test helper
**File:** `tests/unit/flow/commands/review.test.js`  
**Issue:** The new spec-223 tests repeat a long sequence (create feature commit, advance main, switch back), increasing noise and maintenance cost.  
**Suggestion:** Add a local helper (for example, `createDivergedHistoryFixture(tmp)`) that returns useful refs (`featureBranch`, `mergeBase`, changed files), then reuse it across both “upstream-only” tests to remove duplication and clarify intent.

**Verdict:** APPROVED
**Reason:** The duplicated test setup is substantial; a shared fixture helper improves test readability and maintenance while keeping runtime behavior unchanged.
