# Code Review Results

### [x] 変更差分のレビューとして扱います。まず、差分に含まれる各ファイルの周辺実装を確認して、重複・命名・未使用・設計整合性・単純化余地、それと resource bound の観点で絞って指摘を作ります。作業ディレクトリ直下に `src/` がないので、まず worktree 内の実コード位置を特定します。差分レビュー自体はこの変更セットに限定したまま進めます。差分の新規ロジックが既存ヘルパーと整合しているかだけ確認します。提案は diff 対象ファイルに限定します。新規 CLI 引数仕様が既存実装と衝突していないかだけ確認します。ここで問題があれば、指摘先は diff 対象の `registry.js` / `dispatcher.js` に限定します。### 1. Normalize static retro statuses to the existing retro schema
**File:** `src/flow/lib/run-retro.js`  
**Issue:** `tryStaticEvaluation()` can emit `status: "unverified"` via `evaluateRequirement()`, but this file’s own AI schema and summary logic only recognize `done|partial|not_done`. That makes counts inconsistent (`total` can exceed `done + partial + not_done`) and risks downstream consumers silently ignoring those entries.  
**Suggestion:** Convert `"unverified"` to `"not_done"` with a note like `"no tests mapped"`, or extend this file’s schema and all local summary/counting logic to handle `"unverified"` explicitly. The simpler and more consistent option is to normalize it before building `reqs`.

**Verdict:** APPROVED
**Reason:** `evaluateRequirement()` returns `"unverified"` (req-map.js:87) for unmapped requirements, but the summary in `tryStaticEvaluation()` only counts `done|partial|not_done`. This makes `total !== done + partial + not_done` whenever a requirement has no mapped tests — a real consistency bug, not cosmetic. Normalization (or explicit handling) is required.

### [ ] 2. Add an explicit bound to static test execution
**File:** `src/flow/lib/run-retro.js`  
**Issue:** `tryStaticEvaluation()` expands every distinct file referenced in `test-map.json` into a single `node --test ...` invocation with no explicit upper bound on file count or argument size. That violates the bounded-resource-usage guardrail and can turn a malformed or oversized map into an expensive subprocess.  
**Suggestion:** Enforce a hard limit such as `MAX_STATIC_TEST_FILES`, fail or skip static mode when exceeded, and report why. If needed, batch execution in capped chunks so runtime and argument growth stay controlled.

**Verdict:** REJECTED
**Reason:** Defensive over-engineering. `test-map.json` is an internal, user-authored artifact for the current spec — not an external/system boundary. The existing 60s `timeout` and `fs.existsSync` filter already bound runtime, and OS argv limits are far above realistic test counts. Project rule explicitly says "過剰な防御コードを書かない。内部インターフェースは信頼し、バリデーションはシステム境界でのみ行う". Adding a hard cap solves no real failure mode in this code path.

### [x] 3. Extract the duplicated retro summary calculation
**File:** `src/flow/lib/run-retro.js`  
**Issue:** The `total/done/partial/not_done/rate` summary block is implemented twice: once in `parseRetroResponse()` and again in `tryStaticEvaluation()`. This is straightforward duplication and makes future status changes easy to apply inconsistently.  
**Suggestion:** Extract a local helper such as `buildRetroSummary(requirements, notes)` and reuse it from both code paths. That keeps the two retro modes aligned and reduces maintenance risk.

**Verdict:** APPROVED
**Reason:** The `total/done/partial/not_done/rate` block is verbatim duplicated between `parseRetroResponse` (lines 105–122) and `tryStaticEvaluation` (lines 305–321). Project rule mandates extraction when a pattern occurs 2+ times ("3回目の出現を待つ必要はない"). Risk-free local refactor that prevents drift, particularly relevant if proposal 1 is adopted.

### [ ] 4. Keep review prompt enrichment scoped and bounded
**File:** `src/flow/commands/review.js`  
**Issue:** `runReview()` prepends the entire `file-map.json` contents to the review prompt whenever the map is non-empty. That adds unrelated context for large specs, increases token usage, and has no explicit cap.  
**Suggestion:** Limit the injected mapping to entries that intersect the current diff files, and apply a hard ceiling on number of entries or rendered characters. This keeps the prompt focused and avoids unbounded bulk loading.

**Verdict:** REJECTED
**Reason:** `file-map.json` is per-spec and naturally scoped to the current feature's requirements; it is not a generic risk vector. "Limit to entries intersecting the diff" is also a behavior change (R7's intent is to give the reviewer the requirement→file mapping, not just diff intersections). The proposal mixes a speculative resource concern with a semantic change that is not clearly an improvement.

### [x] 5. Replace the stringly-typed map loader with explicit loaders
**File:** `src/flow/commands/review.js`  
**Issue:** `loadReqMap(root, flow, kind)` uses a loose string switch where anything other than `"test"` falls back to `loadFileMap()`. A typo or future caller mistake would silently load the wrong map. The dynamic import also breaks the otherwise static import style used in this module.  
**Suggestion:** Use explicit helpers such as `loadFileReqMap()` and `loadTestReqMap()`, or validate `kind` against a fixed loader map and throw on unknown values. Prefer a normal top-level import for consistency unless lazy loading is required for startup cost.

**Verdict:** APPROVED
**Reason:** Two concrete defects: (a) `kind` is an unvalidated string with silent fallback to `loadFileMap` on typo; (b) `await import()` is gratuitous lazy loading inconsistent with the rest of the file's static imports — and the function is even declared between `import` statements (lines 16 and 25), which is a clear style break. Two explicit helpers (or a fixed loader table with `throw` on unknown kind) are clearly better. Low risk to change.

### [x] 6. Remove feature-specific example data from the distributed prompt template
**File:** `src/flow/prompts/plan/test.md`  
**Issue:** The example `test-map.json` uses concrete names like `241-set-files.test.js`, which is project/spec-specific content inside `src/`. That conflicts with the repository rule that `src/` must not embed project-specific information.  
**Suggestion:** Replace the example with generic placeholders such as `feature.test.js > creates the mapping file` or `<spec>.test.js > <test description>`, while keeping the format explanation unchanged.

**Verdict:** APPROVED
**Reason:** Direct violation of the explicit MUST rule "`src/` 以下のファイルには、特定のプロジェクトや環境に固有の情報を含めてはならない". The example references `241-set-files.test.js` (this very spec's filename) inside a template that ships in the npm package. Must be replaced with generic placeholders.
