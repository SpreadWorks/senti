# Draft: fix-test-summary-path

**開発種別:** バグ修正
**目的:** `flow set test-summary` で保存したデータが finalize 後の report に反映されないバグを修正する

## 背景

`flow set test-summary` は `state.test.summary` にデータを保存するが、report 生成時の参照パスが `state.metrics?.test?.summary` になっており、パスの不一致により test summary が常に表示されない。

## Q&A

### Q1: 修正方針
- 方針: `state.test.summary` に統一する（report 側の参照パスを修正）
- 理由: 保存側 `setTestSummary` が既にこのパスで書き込んでいる。`metrics` は `flow set metric` 用の自動カウンタ系データであり、ユーザーが明示的に設定する test-summary とは性質が異なる

### Q2: 影響範囲
- コード修正: `src/flow/commands/report.js:126` の1箇所のみ
- docs 修正: 不要（自動再生成で対応）

### Q3: 修正スコープ
- `state.metrics?.test?.summary` → `state.test?.summary` に変更するのみ
- `metrics` 構造のリファクタリングはスコープ外

### Q4: テスト戦略
- `specs/169-fix-test-summary-path/tests/` にスペック検証テストを配置
- set → report 表示の一貫性を検証する回帰テスト

## スコープ外

- docs の手動修正（自動再生成で対応）
- `metrics` 構造のリファクタリング

## User Confirmation

- [x] User approved this draft (2026-04-13)
