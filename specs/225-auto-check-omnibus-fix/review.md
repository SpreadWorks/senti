# Code Review Results

### [x] 変更差分だけを対象に、重複・命名・不要コード・設計整合性・単純化の観点で確認します。まず差分に出ている実装ファイルの周辺だけを読み、提案が本当にこの変更セット内で完結するものに絞ります。作業ディレクトリが差分のルートではなさそうなので、worktree 内の実際のリポジトリ位置を確認します。差分に出ているファイルだけ追います。差分の主眼は `issueBody` 取得と `issue.md` キャッシュの追加です。いま重複と責務の分散を中心に、同じ変更セット内だけで改善できる点を詰めています。### 1. Extract shared issue-body caching logic
**File:** `src/flow/lib/set-issue.js`
**Issue:** The new issue-fetch/minify/truncate/write flow is now duplicated across `set-issue.js` and `set-init.js`, with a third related write path in `run-prepare-spec.js`. That spreads one concern across multiple commands and makes future format changes to cached issue content easy to miss.
**Suggestion:** Introduce a shared helper for “fetch and normalize issue body” and another for “persist cached issue body to `issue.md`”, then call those from `set-init.js`, `set-issue.js`, and `run-prepare-spec.js`. This removes duplication and keeps the issue-body lifecycle consistent.

**Verdict:** APPROVED
**Reason:** Real duplication exists across `set-issue.js`, `set-init.js`, and `run-prepare-spec.js` (fetch → minify → truncate → optional write). Project CLAUDE.md explicitly mandates helper extraction at the second occurrence. A shared helper unifies the issue-body lifecycle and keeps truncation/minify policy in one place, with no behavioral change.

### [x] 2. Unify sibling file loading into one helper
**File:** `src/flow/lib/resolve-auto-check-input.js`
**Issue:** `loadDraftText()` and `loadIssueMd()` repeat the same path-resolution and file-loading pattern, but with slightly different error-handling behavior. That is a small duplication hotspot and makes the module’s I/O rules inconsistent.
**Suggestion:** Replace both with a single helper such as `loadSpecSiblingText(root, specPath, fileName, { warnOnError })`. That would centralize path construction, trimming, existence checks, and optional warning behavior.

**Verdict:** APPROVED
**Reason:** `loadDraftText` and `loadIssueMd` share path resolution, existence check, read+trim, and empty-to-null semantics. The only divergence is the optional warn-on-error block — a clean fit for a parameterized helper. Small but aligned with the "extract at 2nd occurrence" rule, and preserves current behavior via an option flag.

### [ ] 3. Rename `buildBaseInput` to match its current responsibility
**File:** `src/flow/lib/resolve-auto-check-input.js`
**Issue:** After this change, `buildBaseInput()` no longer just builds a minimal base string. It now performs fallback resolution across request text, in-memory issue body, cached `issue.md`, and issue number. The current name understates that responsibility and makes the control flow harder to scan.
**Suggestion:** Rename it to something like `buildIssueContextInput` or `buildAutoCheckSeedText`, and rename `preparingBody` to something more neutral like `cachedIssueBody` or `inlineIssueBody`. That aligns naming with the new design.

**Verdict:** REJECTED
**Reason:** Cosmetic-only. `buildBaseInput` remains an accurate name for the function that builds the base (non-draft) portion of the input; fallback chains are an implementation detail. `preparingBody` is also sufficiently descriptive given the "preparing phase" context. No behavioral or structural improvement.

### [ ] 4. Make G-keyword matching strategy consistent with the false-positive goal
**File:** `src/flow/lib/auto-check-static.js`
**Issue:** The tests now explicitly emphasize false-positive reduction, but `anyKeyword()` still uses plain substring matching for all keywords. That leaves the design inconsistent with the intent of the change, especially for English tokens such as `token` or future additions that can appear inside unrelated words.
**Suggestion:** Use a stricter matcher for ASCII keywords, such as word-boundary regexes, while keeping substring matching for Japanese phrases. That preserves the reduced-keyword set while making the implementation match the spec direction more reliably.

**Verdict:** REJECTED
**Reason:** Behavior-changing and scope-expanding. Spec 225's documented strategy is keyword-list reduction, not matcher change. Introducing word-boundary regexes would alter match semantics for edge cases (e.g., `tokenizer`, `passwords`), risks regressions in H/I gates if generalized, and requires re-justifying what the new tests assert. Out of scope for a review of this diff.

### [x] 5. Convert repeated retained-keyword assertions into table-driven tests
**File:** `tests/unit/flow/auto-check-static.test.js`
**Issue:** The new test block repeats the same assertion structure many times for retained keywords, while the removed-keyword section is already table-driven. The current style is more verbose than necessary and less consistent within the same test file.
**Suggestion:** Move the retained-keyword cases into an array and iterate, as is already done for removed keywords. That keeps the test pattern uniform and makes future keyword edits cheaper.

**Verdict:** APPROVED
**Reason:** The removed-keyword block in the same file is already table-driven; unifying the retained-keyword block matches the in-file convention and reduces edit cost for future keyword changes. Pure test restructure with no assertion-strength loss, low risk.
