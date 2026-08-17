# Draft: Fix docs.exclude not applied to data DataSource

## Issue

GitHub Issue #53: `docs.exclude` パターンが data DataSource（StructureSource 等）の出力に適用されていない。

## Root Cause

- `scan` が全エントリを `analysis.json` に書き込む
- `enrich` は `docs.exclude` でフィルタして AI 処理するが、除外エントリも analysis.json に残る（enriched されないだけ）
- `data` コマンドは analysis.json を そのまま DataSource に渡すため、除外パターンに一致するエントリも出力される

## Fix Strategy

data コマンドで analysis を DataSource に渡す前に `docs.exclude` パターンでエントリをフィルタする。

- `filterByDocsExclude` を `enrich.js` からユーティリティに抽出して共有化
- `data.js` の `processTemplate` に渡す前に analysis の各カテゴリの entries を絞り込む
- 全 DataSource が自動的に恩恵を受ける（個別修正不要）

## Requirements

1. data コマンドが analysis を DataSource に渡す前に `docs.exclude` パターンでエントリをフィルタすること
2. `filterByDocsExclude` を enrich.js と data.js で共有すること（ロジック重複なし）
3. `docs.exclude` 未設定の場合は既存動作が維持されること

## Impact

- 全 DataSource の出力から docs.exclude パターンに一致するエントリが除外される（期待動作）
- docs.exclude 未設定のプロジェクトには影響なし
- CLI インターフェースの変更なし

## Approval

- [x] User approved this draft (autoApprove)
