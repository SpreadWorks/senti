# Code Review Results

### [x] 差分に含まれる `src/flow/lib/req-map.js` と `src/flow/lib/run-retro.js` の周辺実装を確認し、重複・命名・設計整合性・簡素化余地の観点でレビューします。カレントディレクトリが作業用の `.tmp` 直下で、ソースはその下にありませんでした。リポジトリ配置を確認して、差分対象ファイルの実体を辿ります。変更の意図は把握できました。次に、追加されたヘルパーの再利用状況と、静的評価パスの設計上のズレを確認します。参照箇所の使用状況を確認したところ、追加ヘルパーは `run-retro.js` だけで使われ、旧経路の評価関数は残置されています。差分内ファイルだけで閉じる改善案を絞ります。改善候補は 2 系統に収束しました。1 つは要件判定ロジックの二重化、もう 1 つは静的評価パスの上限未設定です。### 1. Consolidate the duplicated requirement-status logic
**File:** `src/flow/lib/req-map.js`  
**Issue:** `extractReqResults()` and `evaluateReqByResults()` reintroduce the same status state machine already encoded in `evaluateRequirement()`, but `evaluateRequirement()` is now unused. That leaves two competing evaluation paths in the same file, and `extractReqResults()` is also misleadingly named because it returns counts, not final results.  
**Suggestion:** Collapse this into one API that returns `{ passed, failed, status }` from TAP data for a requirement (or a map of those objects), then remove the dead `evaluateRequirement()` function. Rename the surviving helpers to reflect their real role, for example `countRequirementResults` and `evaluateRequirementCounts`.

**Verdict:** APPROVED
**Reason:** `evaluateRequirement()` has no remaining production callers in `src/` after this diff — only the old test file at `specs/241-.../tests/241-retro-static.test.js` references it. Per the project's alpha policy (`後方互換コードは書かない…旧フォーマット・非推奨パスは保持せず削除する`), the dead function should go, and `extractReqResults` is genuinely misleading (it returns counts, not results). The 241-era test will need updating in tandem, but the consolidation is correct.

### [ ] 2. Stop deriving requirement membership from test titles
**File:** `src/flow/lib/run-retro.js`  
**Issue:** `tryStaticEvaluation()` loads `test-map.json` but only uses it to find files; requirement membership is now inferred from TAP names matching `^R\\d+`. That creates a hidden naming convention and can mark a requirement as `"unverified"` / `"no tests mapped"` even when `test-map.json` contains valid mappings, or silently fall back to AI when test titles do not start with requirement IDs.  
**Suggestion:** Use `test-map.json` as the source of truth for requirement-to-test membership and use parsed TAP output only for pass/fail resolution. That keeps the static evaluator aligned with the mapping file and avoids brittle title-based behavior.

**Verdict:** REJECTED
**Reason:** This contradicts the explicitly chosen design in `specs/244-fix-retro-static-eval-zero/spec.md` and `draft.json`, which deliberately moved to "TAP結果の要件ID集約" (R-prefix aggregation). The previous test-map-keyed lookup is exactly what produced the original bug (key-format mismatch → all `not_done`). Switching membership back to test-map would re-introduce the same key-alignment fragility the spec was written to escape, and the R-prefix convention is documented in the spec's acceptance criteria. Behavior risk too high to approve as a side refactor.

### [ ] 3. Add an explicit bound to static test execution
**File:** `src/flow/lib/run-retro.js`  
**Issue:** `tryStaticEvaluation()` runs all unique mapped test files in a single `node --test` invocation with no explicit cap. That violates the bounded-resource-usage guardrail for bulk processing and allows static retro cost to grow without limit as `test-map.json` expands.  
**Suggestion:** Introduce a hard maximum for the number of mapped files (and optionally TAP output size or batch size). If the limit is exceeded, skip static mode intentionally with a clear reason instead of launching an unbounded test run.

**Verdict:** REJECTED
**Reason:** Speculative defensive coding with no observed scaling problem; violates the project guidance `過剰な防御コードを書かない`. The existing `timeout: 60000` already bounds runtime, and `test-map.json` size is bounded by spec scope. Picking an arbitrary file-count cap would introduce a silent fall-back to AI mode that is harder to reason about than the current behavior.
