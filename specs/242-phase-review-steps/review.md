# Code Review Results

### [x] 変更差分の対象ファイルだけを見て、重複・命名・不要コード・設計整合性・単純化の観点で確認します。まず該当ファイルの実装文脈を読み、提案が本当に diff 内に閉じるかを絞ります。作業ディレクトリ直下がリポジトリ根ではないようなので、まず構成を確認して diff 対象の実ファイル位置を特定します。確認後、対象ファイルだけを読んで提案に絞ります。関連部分の構造は見えたので、次は既存の `test/spec` レビュー実装との重複と分岐の入り方を比較します。特に `draft` 追加で似た処理が3系統化していないかを確認します。`draft/spec/test` の3相追加で、同じ構造を手で並べた箇所が複数あります。最終提案は、実害がある重複と将来のズレを生みやすい箇所だけに絞ります。### 1. Resolve review retry limits from the active phase, not from `impl.review`
**File:** `src/flow/commands/review.js`
**Issue:** `REVIEW_MAX_ATTEMPTS` is always read from `resolveNodeFor(FLOW_DEFINITION, "review").maxAttempts`, so the newly added `review-draft`, `review-spec`, and `review-test` node settings in `FLOW_DEFINITION` are effectively dead configuration. If those node values ever diverge, the command will silently use the wrong retry budget.
**Suggestion:** Replace the single `REVIEW_MAX_ATTEMPTS` constant with a phase-aware lookup such as `getReviewMaxAttempts(phase)` that resolves `review-draft`, `review-spec`, `review-test`, or `review` as appropriate before calling `runReviewLoop`.

**Verdict:** APPROVED
**Reason:** The diff adds `review-draft`/`review-spec`/`review-test` nodes each with their own `maxAttempts: 3`, but `REVIEW_MAX_ATTEMPTS` is hard-wired to `resolveNodeFor(FLOW_DEFINITION, "review")`. That makes the newly-added node config silently inert — a real correctness/maintenance bug, not cosmetics. A phase-aware lookup is a low-risk fix.

### [x] 2. Extract the duplicated phase-review markdown formatter
**File:** `src/flow/commands/review.js`
**Issue:** `formatSpecReviewMd()` and `formatDraftReviewMd()` are structurally identical except for the heading text. Keeping two copies invites drift when one format changes and the other is forgotten.
**Suggestion:** Introduce a shared helper like `formatPhaseReviewMd(title, history, verdict, finalIssues)` and have both spec and draft review pipelines call it. The same helper could also cover `test-review.md` if desired with small parameterization.

**Verdict:** APPROVED
**Reason:** The new `formatDraftReviewMd` is a near-clone of the existing spec/test formatters (only the heading differs), and the project rule explicitly says to extract a helper as soon as the same pattern appears in 2+ places. Behavior-preserving consolidation.

### [x] 3. Collapse the three subprocess parsers into one generic phase parser
**File:** `src/flow/lib/run-review.js`
**Issue:** `parseTestReviewOutput()`, `parseSpecReviewOutput()`, and `parseDraftReviewOutput()` repeat the same regex extraction, error assembly, `changed` handling, and result-shape construction. The only real differences are phase names, counter labels, and next-step IDs.
**Suggestion:** Replace them with a single helper such as `parsePhaseReviewOutput(res, stdout, stderr, { phase, countKey, failureLabel, next })`. This removes duplication and makes future phase additions much less error-prone.

**Verdict:** APPROVED
**Reason:** `parseDraftReviewOutput` is structurally identical to the test/spec parsers, differing only in phase name, error label, and `next` step. Parameterizing them removes a real drift risk and matches the codebase's DRY policy. Behavior is preserved if the table is filled in faithfully.

### [x] 4. Fix the review command help text drift
**File:** `src/flow/registry.js`
**Issue:** The help string still says `--phase <type>   Review phase: 'test' ... 'spec' ...` even though `draft` is now a valid phase. That makes the CLI surface inconsistent with the actual implementation and the new flow definition.
**Suggestion:** Update the help text to include `draft`, or better, derive the displayed phase list from shared review-phase metadata so the registry help cannot drift from `VALID_REVIEW_PHASES` and `REVIEW_PHASES`.

**Verdict:** APPROVED
**Reason:** `VALID_REVIEW_PHASES` now includes `draft`, but the registry help text still lists only `test`/`spec`. This is a user-visible inconsistency introduced by the same diff and trivial to fix. Deriving the list from the shared constant is the right move.

### [ ] 5. Add an explicit bound to recursive test discovery
**File:** `src/flow/commands/review.js`
**Issue:** `collectTestsRecursive()` performs unbounded recursive directory traversal. That violates the `bounded-resource-usage` guardrail because depth, file count, and total scanned entries are not capped.
**Suggestion:** Add explicit limits such as `maxDepth`, `maxFiles`, or `maxEntries`, and fail fast with a clear error when the bound is exceeded. An iterative queue-based walk with counters would make the limit enforcement straightforward.

**Verdict:** REJECTED
**Reason:** This is unrelated to the draft-review diff and adds defensive code against a non-issue (test directories the user controls). Project policy is "過剰な防御コードを書かない / バリデーションはシステム境界でのみ行う" — adding `maxDepth`/`maxFiles` here is exactly that kind of speculative guard, and it risks new failure modes if the bound is hit on a legitimately large repo.

### [x] 6. Reduce repeated review-node construction in the flow definition
**File:** `src/flow/definition.js`
**Issue:** `review-draft`, `review-spec`, and `review-test` are three near-identical `new FlowNode(...)` blocks that differ in only a few fields. This is repetitive and makes it easier for one review step to drift from the others.
**Suggestion:** Introduce a small local factory for plan review nodes, for example `createPlanReviewNode({ id, label, instructionsKey, contextKinds })`, and build the three review nodes through that helper so shared defaults like `action`, `outputSchemaRef`, `skippable`, and `maxAttempts` stay consistent.

**Verdict:** APPROVED
**Reason:** The three new `FlowNode` blocks share `action`, `outputSchemaRef`, `skippable`, and `maxAttempts` verbatim. A small local factory keeps these defaults aligned and is consistent with the project's "extract on the 2nd occurrence" rule. No behavior change if the factory faithfully forwards fields.
