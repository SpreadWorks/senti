# Feature Specification: 228-fix-gate-retry-counter-drift

**Feature Branch**: `feature/228-fix-gate-retry-counter-drift`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #250

## Goal
gate retry counter の内訳表示を追加し、auto モード中にユーザーがカウンタの消費状況を正確に把握できるようにする

## Background
spec 221 の gate-impl で retry counter が 3/3 に到達した際、ユーザーは AI 評価 FAIL が 2 回のみと認識した。実際には 3 回の AI FAIL が記録されており counter は正常だったが、表示の透明性不足により誤認が発生した。

## Scope
- gate 実行時のカウンタ内訳表示の追加
- 事前拒否時の予算未消費メッセージ追加
- 枯渇メッセージへの内訳追加
- gateRetry 不変条件のテスト追加

## Out of Scope
- retry max の意味変更
- retry 戦略の変更
- retry history 表示の改善（spec 224 で対応済み）

## Constraints
- 既存のカウンタ増分ロジックを変更しない
- stderr 出力の拡張のみ。CLI の exit code やコマンドインターフェースは変更しない

## Design Principles
- 表示の追加のみで判定ロジックには触れない

## Overview
### Modules
- run-gate.js: warnGateRetryBudget に内訳カテゴリ表示を追加
- run-gate.js: checkRetryBelowMax の枯渇メッセージに内訳行を追加
- run-gate.js: checkNoProgressSinceLastFail / checkMissingHeadTestEvidence に予算未消費メッセージを追加

### Data Flow
- countGateRetry が metrics 配列から AI-FAIL カウントを算出 -> warnGateRetryBudget が内訳付きで stderr に出力

### Decisions
- カテゴリは AI-FAIL のみ。gateRetry を増分するのは AI 評価 FAIL 後の post hook のみのため、単一カテゴリで十分

## Clarifications (Q&A)
- Q: カウンタ自体にバグはあるか
  - A: ない。spec 221 の issue-log 解析で 3 回の AI FAIL を確認済み。表示の透明性のみが問題。
- Q: 既存機能への影響は
  - A: 影響あり: flow run gate の stderr 出力にカウンタ内訳が追加される、枯渇メッセージに内訳行が追加される、事前拒否時に予算未消費メッセージが追加される。影響なし: gate の判定ロジック、カウンタ増分ロジック、エスカレーション判定、CLI exit code。

## Alternatives Considered
- カウンタカテゴリを複数に分割 — 現状 gateRetry を増分するのは AI 評価 FAIL の post hook のみのため、複数カテゴリは過剰設計。将来カテゴリが増えた場合に拡張可能な形にするだけで十分。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-25T05:41:50.011Z
- Notes: autoApprove

## Requirements
- REQ-1 [must]: When flow run gate が retry-tracked phase (task-impl / integration) で実行されるとき、stderr のカウンタメッセージに内訳カテゴリ (AI-FAIL=N) を含めて表示する
- REQ-2 [must]: When retry 予算が枯渇したとき、checkRetryBelowMax の Envelope.fail メッセージに内訳行 (Counter breakdown: AI-FAIL=N) を含める
- REQ-3 [must]: When 事前拒否 (NO_PROGRESS_SINCE_LAST_FAIL / NO_HEAD_TEST_EVIDENCE) により gate がスキップされたとき、stderr にリトライ予算が消費されなかった旨を表示する
- REQ-4 [should]: When テストスイートを実行したとき、issue-log 記録が gateRetry カウンタを増分しないことが検証される
- REQ-5 [should]: When テストスイートを実行したとき、事前拒否が gateRetry カウンタを増分しないことが検証される

## Acceptance Criteria
- gate を retry-tracked phase で実行すると、stderr に [AI-FAIL=N] を含むカウンタメッセージが表示される
- retry 枯渇時の Envelope メッセージに Counter breakdown 行が含まれる
- NO_PROGRESS_SINCE_LAST_FAIL / NO_HEAD_TEST_EVIDENCE 拒否時に stderr に (retry budget not consumed) メッセージが表示される
- テストが issue-log 記録後の gateRetry 不変性を検証する
- テストが事前拒否後の gateRetry 不変性を検証する
- 既存テストが全て通る（回帰なし）

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-pending-spec** [done]: Define spec requirements and task decomposition
  - spec.json の requirements と tasks を定義し、gate-spec を通過させる
  - see `tasks/T-pending-spec.md` for full spec

### Round 1
- **T-1** [pending]: Add counter breakdown to gate retry messages
  - warnGateRetryBudget と checkRetryBelowMax の出力にカウンタ内訳を追加する
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add budget-not-consumed message to pre-rejection checks
  - 事前拒否時に stderr にリトライ予算が消費されなかった旨を表示する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Add gateRetry invariant tests
  - issue-log 記録と事前拒否が gateRetry カウンタを増分しないことをテストで保証する
  - see `tasks/T-3.md` for full spec
