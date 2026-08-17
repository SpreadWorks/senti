# Code Review Results

### [x] 変更差分のレビューとして、まず対象の2ファイルだけを読んで周辺コンテキストを確認します。重複、命名、一貫性、不要コード、単純化余地に絞って、差分内の提案だけに限定します。作業ディレクトリ直下にソースが見当たらないので、worktree 内で実ファイルの位置を確認します。差分ファイルだけ見つけて、その場でレビューします。周辺実装を見ると、主な論点は `src/metrics/commands/token.js` に集約されています。差分内で増えた集計と整形ロジックの重複、CSV 表現の一貫性、未使用集計値の扱いを詰めます。### 1. Extract Shared Metric Formatting
**File:** `src/metrics/commands/token.js`  
**Issue:** `asDisplayValue()` and `asCsvValue()` now duplicate the same null-placeholder and numeric-formatting branches for `cost` and `difficulty`. The new `—` behavior makes that duplication more fragile, because any future formatting change has to stay synchronized across both functions.  
**Suggestion:** Pull the shared logic into a single helper such as `formatMetricScalar(value, kind)` plus a small wrapper for text-only duration formatting. That removes duplication and keeps placeholder policy consistent in one place.

**Verdict:** APPROVED
**Reason:** `asDisplayValue` and `asCsvValue` now share three identical branches (null→placeholder, cost→toFixed(6), difficulty→toFixed(2)). The new placeholder branch makes drift more likely, and the project's CLAUDE.md explicitly mandates extracting shared helpers when patterns repeat in 2+ places. Pure refactor with no behavior change.

### [x] 2. Remove Or Complete Half-Used Summary Fields
**File:** `src/metrics/commands/token.js`  
**Issue:** `computePhaseSummary()` accumulates `totalCacheCreate`, but never returns or renders it. It also returns `rowCount`, which is not used by any of the new output paths. This is dead or half-finished code that makes the summary contract look larger than it really is.  
**Suggestion:** Either remove `totalCacheCreate` and `rowCount` for now, or expose them consistently in the returned summary and use them in text/JSON/CSV output. The current middle state adds maintenance cost without value.

**Verdict:** APPROVED
**Reason:** `totalCacheCreate` is accumulated in the loop but never included in the returned object — pure dead code. `rowCount` is returned but unused by any formatter. Per the alpha-version policy ("後方互換コードは書かない"), removing dead fields is appropriate. Low-risk cleanup.

### [ ] 3. Clarify What “Average” Means
**File:** `src/metrics/commands/token.js`  
**Issue:** `avgCost`, `avgDuration`, `avgTokenInput`, and `avgTokenOutput` are averaged by `phaseRows.length`, so they are really per-row averages, not necessarily per-call averages. Since each row can already aggregate multiple calls, labels like `avg cost` and `avg tokens` are ambiguous and easy to misread.  
**Suggestion:** Rename these fields to something explicit like `avgCostPerRow`, `avgDurationPerRow`, and `avgTokenInputPerRow`, or change the calculation to a call-weighted average if that is the intended meaning. The API and output labels should state the aggregation level clearly.

**Verdict:** REJECTED
**Reason:** Speculative semantics. The proposal isn't clear whether the original intent was per-row or per-call averaging, and changing either the field names or the calculation formula alters the public API/JSON schema and visible output without evidence the current behavior is wrong. This is a clarification request, not a defect — should be resolved by the author rather than refactored blindly.

### [x] 4. Keep CSV Schema Homogeneous
**File:** `src/metrics/commands/token.js`  
**Issue:** `formatCsv()` now mixes normal data rows with synthetic `SUMMARY` rows under the same header, and also emits the display glyph `—` into CSV fields. That makes the CSV less machine-friendly and forces consumers to special-case row types and placeholder text.  
**Suggestion:** Keep CSV rows uniform by either emitting only detail rows in CSV, or starting a separate summary section with its own header/schema. For missing CSV values, prefer empty fields over display-oriented glyphs.

**Verdict:** APPROVED
**Reason:** Genuine machine-readability regression: a `SUMMARY` row with a string in the `date` column and the em-dash glyph `—` in numeric fields breaks downstream parsers expecting uniform schema. Empty fields or a separate summary section is the standard CSV convention. Real quality issue, not cosmetic.

### [x] 5. Centralize Row Ordering Instead Of Sorting Twice
**File:** `src/metrics/commands/token.js`  
**Issue:** `formatText()` groups `sortRows(rows)` and then immediately creates another sorted copy of each phase group to reverse date order. Ordering responsibility is now split between `sortRows()` and ad hoc per-format sorting, which makes output behavior harder to reason about.  
**Suggestion:** Move ordering into a single helper, such as a phase-group builder that accepts the desired intra-phase order, or extend `sortRows()` so each formatter does not need to re-sort locally. This simplifies the formatting path and makes ordering rules consistent.

**Verdict:** APPROVED
**Reason:** `sortRows` produces ascending date order, then `formatText` immediately re-sorts each phase group descending — split ordering responsibility across two layers. Consolidating into a single helper (or letting the caller pass intra-phase direction) removes the redundant sort and makes ordering rules discoverable in one place. Straightforward refactor.
