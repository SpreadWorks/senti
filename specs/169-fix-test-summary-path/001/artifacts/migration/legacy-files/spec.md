# Feature Specification: 169-fix-test-summary-path

**Feature Branch**: `feature/169-fix-test-summary-path`
**Created**: 2026-04-13
**Status**: Draft
**Input**: GitHub Issue #133

## Goal

`flow set test-summary` で保存したテスト件数が、finalize 後の report に正しく反映されるようにする。

## Scope

- `src/flow/commands/report.js` の test summary 参照パスを修正する

## Out of Scope

- docs の手動修正（自動再生成で対応）
- `metrics` データ構造のリファクタリング
- `setTestSummary` の保存先変更

## Clarifications (Q&A)

- Q: 保存パスと参照パスのどちらに統一するか？
  - A: `state.test.summary`（保存側）に統一する。`metrics` は `flow set metric` 用の自動カウンタ系データであり、ユーザーが明示的に設定する test-summary とは性質が異なるため。

## Alternatives Considered

- **参照パス (`state.metrics.test.summary`) に統一する案**: 保存側を変更する必要があり、既存の flow.json との互換性に影響する。`metrics` は自動カウンタであり test-summary を格納する場所として不適切。却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: approved as-is

## Requirements

1. [P1] When `report.js` generates the report, it shall read test summary from `state.test?.summary` instead of `state.metrics?.test?.summary`.
2. [P2] When `flow set test-summary --unit 3 --integration 2 --acceptance 1` is executed followed by report generation, the report shall display `unit: 3`, `integration: 2`, `acceptance: 1`, `total: 6`.

## Acceptance Criteria

- `flow set test-summary --unit N --integration N --acceptance N` で保存した値が report の Tests セクションに正しく表示される
- 既存の `flow set metric` による metrics データに影響しない

## Test Strategy

- spec 検証テスト (`specs/169-fix-test-summary-path/tests/`) で set → report 表示の一貫性を検証する
- `setTestSummary` で flow.json に書き込み、`buildReport` で正しく読み取れることを確認する

## Impact on Existing Features

- `flow set test-summary` コマンド: 影響なし（保存側は変更しない）
- `flow set metric`: 影響なし（別のデータパスを使用）
- report 生成: test summary が正しく表示されるようになる（これまでは常に空だった）

## Open Questions

(なし)
