# Feature Specification: 232-draft-retry-guardrail

**Feature Branch**: `feature/232-draft-retry-guardrail`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #272

## Goal
draft gate の retry exhaustion 率を低減する。DEFAULT_GATE_RETRY_MAX の引き上げと draft-scope-boundary guardrail body の修正により、draft phase での gate 収束性を改善する。

## Background
spec 229 で draft が RETRY_TRACKED_PHASES に追加され 3 回の retry 制限が適用された。その結果 retry exhaustion が 0% → 60% に急増。draft guardrail は 8 個あり、修正が別の guardrail と衝突するパターン（scope-boundary を直すと recommend-with-reasoning が FAIL する等）が 3 回以内に収束しない。また draft-scope-boundary が draft.json の QA evidence/why/considered フィールド内のコード参照を実装詳細と誤判定する問題がある。

## Scope
- DEFAULT_GATE_RETRY_MAX の値変更（3 → 5）
- draft-scope-boundary guardrail body への evidence 除外ルール追記

## Out of Scope
- per-phase retry 上限の導入
- draft-recommend-with-reasoning の変更・削除
- RETRY_TRACKED_PHASES からの draft 除外

## Constraints
- 暫定措置として最小変更に留める
- 既存テストで retry max=3 をハードコードしている箇所は 5 に更新する

## Design Principles
- 既存の config.flow.retry.max による上書き機構はそのまま維持する

## Overview
### Modules
- `src/flow/lib/run-gate.js` — DEFAULT_GATE_RETRY_MAX 定数の定義元
- `src/presets/base/guardrail.json` — draft-scope-boundary guardrail body の定義元

### Data Flow
N/A

### Decisions
- D-1: 全 phase 共通の DEFAULT_GATE_RETRY_MAX を 3 → 5 に引き上げ。per-phase 設定は config スキーマ変更が大きいため今回は見送り。
- D-2: draft-scope-boundary の body に evidence/why/considered フィールドの除外ルールを追記。

## Clarifications (Q&A)
- Q: retry 上限を全体で引き上げると task-impl 等にも影響するが問題ないか？
  - A: 暫定措置として許容。task-impl は 5-6 guardrail なので 5 回でも十分な余裕がある。

## Alternatives Considered
- per-phase retry 上限の導入 — config スキーマ変更が大きく、暫定措置のスコープを超える
- draft を RETRY_TRACKED_PHASES から除外 — 無限ループの歯止めがなくなるリスクがある
- draft-recommend-with-reasoning の draft phase からの除外 — 機械チェックと AI チェックはレイヤーが異なり、削除判断にデータが不足

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-26
- Notes:

## Requirements
- R-1 (must): src/flow/lib/run-gate.js の DEFAULT_GATE_RETRY_MAX を 3 から 5 に変更する。
- R-2 (must): src/presets/base/guardrail.json の draft-scope-boundary エントリの body に「QA の evidence/why/considered フィールド内のコード参照は根拠提示であり、実装詳細には該当しない」旨を追記する。
- R-3 (must): retry max=3 をハードコードしている既存テストを 5 に更新する。

## Acceptance Criteria
- DEFAULT_GATE_RETRY_MAX が 5 である
- draft-scope-boundary の body に evidence/why/considered の除外ルールが含まれている
- npm test が全件パスする

## Implementation Targets
- src/flow/lib/run-gate.js
- src/presets/base/guardrail.json

## Tasks
- T-1: Raise DEFAULT_GATE_RETRY_MAX from 3 to 5
- T-2: Update draft-scope-boundary guardrail body

## Open Questions
(none)
