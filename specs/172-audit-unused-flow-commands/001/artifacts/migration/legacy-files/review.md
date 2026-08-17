# Code Review Results

### [x] 1. Metric Counter Strings Are Duplicated
**File:** `src/flow/registry.js`  
**Issue:** Counter names (`question, docsRead, srcRead`) are hardcoded in multiple places (help text, JSDoc in `set-metric.js`, and `VALID_METRIC_COUNTERS`), which can drift again.  
**Suggestion:** Generate help/JSDoc-facing strings from `VALID_METRIC_COUNTERS` (single source of truth), e.g. `VALID_METRIC_COUNTERS.join(", ")`, and avoid manual counter lists in command help text.

**Verdict:** APPROVED
**Reason:** `VALID_METRIC_COUNTERS` を単一の真実源にして help/JSDoc 表記を生成するのは保守性改善で、実行時挙動は変えずにドリフトを防げます。

### [x] 2. Potential Dead Field Left Behind After `redo` Removal
**File:** `src/lib/flow-state.js`  
**Issue:** This change removes `redo` from counters and difficulty scoring, but `flow-state.js` only updates comments. If persisted state still carries `redoCount`, that becomes dead data and creates ambiguity.  
**Suggestion:** Remove `redoCount` from flow-state schema/read-write paths entirely (not just docs/comments), and clean up any remaining references so alpha policy stays strict (no legacy baggage).

**Verdict:** APPROVED
**Reason:** `redo` を廃止したなら `redoCount` も schema/read-write から除去すべきです。死んだデータを残すと意味が曖昧になり、alpha 方針にも反します。

### [ ] 3. Boolean Flag Handling Can Be Simplified
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `const skipGuardrail = ctx.skipGuardrail || false;` is verbose and mixes truthy semantics.  
**Suggestion:** Use explicit coercion (`const skipGuardrail = Boolean(ctx.skipGuardrail);`) or default at argument parsing layer so command code stays consistent with other flag handling.

**Verdict:** REJECTED
**Reason:** `ctx.skipGuardrail || false` → `Boolean(ctx.skipGuardrail)` は実質的にほぼ同義で、品質改善が小さいコスメ寄りです。今のコードでも挙動上の問題は見えません。

### [x] 4. Test Setup Duplication Is Still High
**File:** `tests/unit/specs/commands/guardrail.test.js`  
**Issue:** The test repeatedly does repo init, flow setup, config writing, guardrail JSON writing, and command invocation boilerplate.  
**Suggestion:** Extract a fixture helper (`createGuardrailGateFixture`, `runGate`) to reduce duplication, improve naming clarity, and make future option/flag tests easier to add without copy-paste.

**Verdict:** APPROVED
**Reason:** テスト fixture 化は重複削減と可読性向上に直結し、プロダクト挙動は不変です。将来のケース追加も安全にしやすくなります。

### [ ] 5. Skill Template Command Lists May Drift
**File:** `src/templates/skills/sdd-forge.flow-finalize/SKILL.md`  
**Issue:** Command examples are manually maintained text; they can diverge from actual CLI registry (same drift pattern that happened with removed flags/counters).  
**Suggestion:** Centralize command snippet generation (or at least reference shared constants/templates) so skill docs stay consistent with `FLOW_COMMANDS` changes automatically.

**Verdict:** REJECTED
**Reason:** 方向性は妥当ですが、「CLI registry から自動生成」まで踏み込むとテンプレート系の結合が増え、生成経路の破壊リスクが上がります。まずは手動更新箇所の最小共通化に留めるべきです。
