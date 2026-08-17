# Code Review Results

### [x] 1. Unify Gate Phase/Step Mapping to One Source
**File:** `src/flow/lib/gate-step.js`  
**Issue:** `resolveGateStepId()` and `STEP_TO_PHASE` encode the same mapping in two places, which risks drift (especially around the `task-impl`/`integration` collapse).  
**Suggestion:** Define a single canonical `PHASE_TO_STEP` map and derive `resolveGateStepId()` and inverse mapping from it (or validate inverse consistency at module init).

**Verdict:** APPROVED
**Reason:** `resolveGateStepId()` と `STEP_TO_PHASE` の二重定義は実際にドリフト源です。単一マップから順逆を導出（または初期化時整合チェック）すれば品質向上になり、`task-impl`/`integration` の現行折りたたみ規則を維持すれば挙動も保てます。

### [ ] 2. Remove Duplicate Step-Status Update Logic
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `updateStepStatusDuringInference()` duplicates behavior already handled elsewhere (notably in registry-side update helpers), creating maintenance and behavior-divergence risk.  
**Suggestion:** Extract a shared step-status update helper and reuse it from both `run-gate.js` and registry hooks so error handling and logging policy stay consistent.

**Verdict:** REJECTED
**Reason:** 似た処理でも `run-gate.js` 側は推論時の文脈・ログ方針を持っており、単純共通化はエラーハンドリングや出力差分を生みやすいです。現状提案だと挙動不変の保証が弱いです。

### [ ] 3. Clean Up Unused Imports
**File:** `src/flow/registry.js`  
**Issue:** `VALID_GATE_PHASES` and `resolveGatePhaseFromState` are imported but unused in the shown diff.  
**Suggestion:** Remove unused imports to reduce noise and keep module dependencies clear.

**Verdict:** REJECTED
**Reason:** これは主にノイズ削減の整理で、実質的な品質改善は限定的です（動作改善なし）。保守性向上としては小さく、優先度は低いです。

### [ ] 4. Reduce Test Fixture Duplication
**File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Issue:** Large flow-state objects and repeated assertion patterns are duplicated across many tests, increasing maintenance cost.  
**Suggestion:** Add small fixture builders (for flow/task step states) and assertion helpers (`expectPhase`, `expectStaleSteps`) to keep tests shorter and easier to evolve.

**Verdict:** REJECTED
**Reason:** テストの抽象化は可読性を上げる場合もありますが、過度なヘルパー化で意図が隠れ、失敗時の診断性を落とすリスクがあります。現時点では「明確な改善」より「書き換えコスト/リスク」が上回ります。

### [x] 5. Make `runGate` Test Helper More Composable
**File:** `tests/unit/specs/commands/guardrail.test.js`  
**Issue:** `runGate()` now hardcodes `--phase spec`; callers adding their own phase in `extraArgs` can accidentally pass conflicting flags.  
**Suggestion:** Change helper signature to accept `phase` explicitly (default `"spec"`), and add exactly one phase flag in one place.

**Verdict:** APPROVED
**Reason:** これは単なる見た目ではなく、重複 `--phase` 指定によるテストの誤動作・曖昧さを防ぐ実利があります。`phase` を明示引数化して1箇所でフラグ生成するのは、挙動を壊さずにテスト信頼性を上げる変更です。
