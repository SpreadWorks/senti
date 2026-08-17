# Draft: flow review

## 概要

SDD フローの実装完了後に、コード品質レビューを行う `sdd-forge flow review` コマンドを追加する。
異なるエージェント（または異なる視点を持つ同一エージェント）による2段階レビューで品質を担保する。

## フロー

```
確認（レビューするか？）→ draft（提案生成）→ final（提案検証）→ ユーザー承認 → apply（実装）→ gate
```

## 決定事項

- **コマンド名**: `sdd-forge flow review`
- **フェーズ名**: `flow.review.draft` / `flow.review.final`（config.json の commands キー）
- **SDD フローでの位置**: implement → **flow review** → finalize/close
- **独立コマンド**: `sdd-forge flow review` として単独実行可能
- **レビュー対象**: spec scope から対象ファイルを特定。特定できなければ base ブランチとの diff にフォールバック
- **出力**: `specs/NNN-xxx/review.md` に提案リストを保存
- **却下された提案**: review.md 上で却下理由を付けてマーク（draft の全提案 + 判定結果が残る）
- **ユーザー承認**: 全承認 / 全却下（一括判断）
- **レビュー実施確認**: draft の前に「レビューを実施しますか？」を確認。不要ならスキップ
- **エージェント設定**: config.json の `agent.commands` で `flow.review.draft` と `flow.review.final` を個別に設定可能

## レビューの視点

draft / final それぞれに system prompt でレビュー観点を与える：
- 重複コード排除
- 命名改善
- 不要コード除去
- 設計パターンの一貫性
- etc.

- [x] User approved this draft
- Confirmed at: 2026-03-14
