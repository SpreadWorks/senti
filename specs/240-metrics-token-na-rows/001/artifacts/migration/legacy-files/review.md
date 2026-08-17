# Code Review Results

### [ ] 差分に含まれる `src/flow/definition.js`、`src/lib/flow-manager.js`、`src/metrics/commands/token.js` の周辺実装を確認し、重複・命名・不要化・設計整合性・単純化の観点でレビューします。ワークツリー直下が `.tmp` なので、まず実際のリポジトリルート位置を特定します。差分対象の実ファイルを開いてから指摘を絞ります。対象ファイルは `..` 側にありました。次に `src/AGENTS.md` と差分周辺の実装を見て、既存パターンとの整合性を確認します。`flow` 側はネストされた step 構造を前提にしており、`metrics token` 側は agent metric 集約に限定した変更でした。もう少し周辺を見て、既存ヘルパーとの重複や無制限処理の有無を確認します。`token.js` には行集約ロジックの重複が残っており、`definition.js` には再帰処理の上限なしというガードレール違反候補があります。`flow-manager.js` は flow/task で active-step 解決方式が揃っていない点を確認中です。### 1. Bound test-directory traversal
**File:** `src/metrics/commands/token.js`  
**Issue:** `countFilesRecursive()` walks the `tests/` tree with unbounded recursion and no explicit cap on depth, directories, or files. That violates the `bounded-resource-usage` guardrail and can blow up on unusually deep or large trees.  
**Suggestion:** Replace it with an iterative stack/queue traversal and enforce explicit limits such as `MAX_TEST_SCAN_DEPTH` and/or `MAX_TEST_FILES`. If a limit is exceeded, return `null` or surface a controlled error instead of continuing indefinitely.

**Verdict:** REJECTED
**Reason:** Out of scope for this spec (metrics-token-na-rows). `countFilesRecursive` walks a per-spec `tests/` directory, which is bounded by project structure in practice — there's no concrete unbounded-input risk. Switching the failure mode to "return null on limit" would also silently zero out `testCount` in `computeSpecDifficulty`, changing difficulty values for legitimately large spec test directories. This is a behavior-changing speculative hardening, not a quality improvement.

### [x] 2. Enforce the declared depth contract in the exported step walker
**File:** `src/flow/definition.js`  
**Issue:** `findInProgressLeaf()` is now exported, but unlike the other traversal helpers in this module it does not call `assertDepth()`. That makes it the one tree-walk path that bypasses the module’s own `MAX_DEPTH` contract, and malformed state can trigger unbounded recursion.  
**Suggestion:** Add a `depth` parameter and call `assertDepth(depth)` on each recursive descent, or rewrite the walk iteratively while rejecting nodes deeper than `MAX_DEPTH`.

**Verdict:** APPROVED
**Reason:** The other traversal helpers in `definition.js` (`collectLeafIds`, `derivePhaseMap`, `resolveNodeFor`, `collectGatePhaseEntries`) all call `assertDepth()`. `findInProgressLeaf` walks the same shape and is now exported across module boundaries, so adding `assertDepth` aligns it with the module's existing contract and matches the `bounded-resource-usage` guardrail with no behavior change for well-formed input.

### [ ] 3. Reuse the task-aware active-step resolver instead of a lower-level leaf walker
**File:** `src/lib/flow-manager.js`  
**Issue:** `resolveCurrentContext()` now imports `findInProgressLeaf()` directly and derives the current phase from `state.steps` only, even though `src/flow/definition.js` already exposes `findActiveNode()` with task-first resolution semantics. This duplicates active-step selection logic and risks drift or wrong metric attribution when a task step is active.  
**Suggestion:** Use `findActiveNode(state.steps, state.tasks, state.currentTaskId)` in `resolveCurrentContext()` and derive `sddPhase`/`taskId` from that result. If no other external caller needs it, keep `findInProgressLeaf()` private again.

**Verdict:** REJECTED
**Reason:** This is a semantic change beyond the spec's scope. The original code (pre-diff) used a top-level `state.steps.find(...)` and never considered task scope; the diff only widens that to walk nested children of flow-level steps to fix N/A rows. Switching to `findActiveNode(state.steps, state.tasks, state.currentTaskId)` would additionally make `sddPhase` reflect the in-progress *task* leaf when a task is active, changing how metrics are attributed. That's a separate design decision that should be made deliberately, not folded in as a refactor.

### [x] 4. Extract the duplicated phase-to-row accumulation logic
**File:** `src/metrics/commands/token.js`  
**Issue:** `buildRowsFromMetrics()` and `buildRows()` both repeat the same block that maps `phaseData.tokens`, `callCount`, `cost`, and `durationMs` into a row. Any future metric-field change now requires two edits in lockstep.  
**Suggestion:** Extract a shared helper such as `applyPhaseMetricsToRow(row, phaseData, specDifficulty)` and call it from both functions. That will remove duplication and centralize the `cacheCreation` -> `cacheCreate` mapping.

**Verdict:** APPROVED
**Reason:** `buildRowsFromMetrics` (lines 247-259) and `buildRows` (lines 425-438) repeat the exact same `addMetric` sequence plus the `_difficultySum`/`_difficultyCount` accumulation. The project's CLAUDE.md explicitly mandates extraction at the second occurrence ("2箇所以上で繰り返される場合、共通ヘルパーに抽出すること"). The shared helper centralizes the `cacheCreation → cacheCreate` mapping that future field changes would otherwise have to touch in two places.
