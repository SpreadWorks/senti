# Draft: Spec Retrospective

## Summary

実装完了後に spec の精度を自動評価し、retro.json に保存する機能。

## Decisions

### Q1: 実行タイミング
- finalize の最初（commit の前）に自動実行
- retro.json を実装コミットに含められる

### Q2: 出力形式
- JSON (`retro.json`)
- 集計・比較が容易。表示は別コマンドで整形

### Q3: 記録項目
- `requirements`: 各要件の達成状況（spec の Requirements と対応）
- `unplanned`: spec に書かれていなかった追加変更の一覧
- `summary`: 全体の達成率・所見（AI が生成）
- metrics は flow.json に既存のため含めない

### Q4: 評価方法
- AI が spec.md と git diff を比較して自動評価
- ユーザー承認なし（finalize フローを軽く保つ）

### Q5: 実装構成
- flow registry に `run retro` コマンドを追加
- `src/flow/run/retro.js` を新規作成
- finalize パイプラインから呼び出し + 手動実行可

### Q6: 影響範囲
- `src/flow/registry.js` — エントリ追加
- `src/flow/run/retro.js` — 新規ファイル
- finalize パイプライン — retro 呼び出し追加
- flow-finalize スキル — retro ステップ記述追加
- 既存 CLI コマンド・オプションの変更なし

## Approval

- [x] User approved this draft
- Date: 2026-03-30
