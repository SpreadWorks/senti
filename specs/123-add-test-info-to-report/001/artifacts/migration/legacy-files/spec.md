# Feature Specification: 123-add-test-info-to-report

**Feature Branch**: `feature/123-add-test-info-to-report`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #66

## Goal
finalize レポート（#64 で実装済み）にテスト情報を追加する。flow.json の `metrics.test.summary` に記録されたテスト種別ごとのカウントをレポートの `data.tests` と `text` の Tests セクションに含める。

## Scope
- `src/flow/commands/report.js` の `generateReport()` にテスト情報の収集ロジックを追加
- `formatText()` に Tests セクションを追加
- spec 検証テストの追加

## Out of Scope
- テスト情報を flow.json に記録する仕組み（別途実装済み or 進行中）
- テスト結果の pass/fail 詳細

## Clarifications (Q&A)
- Q: テスト情報はどこに保存されるか？
  - A: flow.json の `metrics.test.summary` に `{ unit: N, integration: N, acceptance: N }` 形式
- Q: テスト情報がない場合はどうするか？
  - A: `data.tests` を null にし、テキストに "(not available)" と表示する

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: autoApprove mode

## Requirements

優先順位: P1（必須）> P2（重要）

R1 [P1]: `generateReport()` の戻り値 `data` に `tests` フィールドを追加する。`state.metrics.test.summary` が存在する場合は `{ unit: N, integration: N, acceptance: N, total: N }` を設定する。存在しない場合は null を設定する。

R2 [P1]: `formatText()` に Tests セクションを追加する。テスト情報がある場合はテスト種別ごとの件数と合計を表示し、ない場合は "(not available)" と表示する。Tests セクションは Metrics セクションの後、Sync セクションの前に配置する。

R3 [P2]: `total` は `unit + integration + acceptance` の合計値として算出する。各キーが存在しない場合は 0 として扱う。

## Acceptance Criteria

AC1: `metrics.test.summary` が `{ unit: 5, integration: 2, acceptance: 1 }` の場合、`data.tests` が `{ unit: 5, integration: 2, acceptance: 1, total: 8 }` になる。

AC2: `metrics.test` が存在しない場合、`data.tests` が null になる。

AC3: `text` に "Tests" セクション見出しが含まれ、テスト情報がある場合は件数が表示される。

AC4: `text` の Tests セクションは Metrics と Sync の間に配置される。

## Open Questions
(none)
