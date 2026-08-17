# Feature Specification: 115-fix-docs-exclude-not-applied-to-data-datasource

**Feature Branch**: `feature/115-fix-docs-exclude-not-applied-to-data-datasource`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #53

## Goal

`docs.exclude` パターンが data DataSource の出力にも適用されるようにし、除外対象のファイル・ディレクトリが `{{data}}` ディレクティブの出力に含まれないようにする。

## Scope

- `src/docs/commands/data.js` — analysis オブジェクトを DataSource に渡す前に `docs.exclude` でエントリをフィルタする
- `src/docs/commands/enrich.js` — `filterByDocsExclude` 関数を共有ユーティリティに移動
- `src/docs/lib/` — 共有フィルタ関数の配置先（新規または既存ファイル）

## Out of Scope

- 個別 DataSource の修正（data.js での一括フィルタで対応）
- `scan` フェーズの除外処理（scan は全エントリを収集するのが正しい動作）
- `docs.exclude` パターンの検証・UI 改善

## Clarifications (Q&A)

- Q: なぜ DataSource 個別ではなく data コマンドで一括フィルタするのか？
  - A: 39 個以上の DataSource が存在し、個別修正は非効率。analysis を渡す前にフィルタすれば全 DataSource が恩恵を受ける。
- Q: enrich.js は除外エントリを analysis.json から削除しないのか？
  - A: enrich は AI enrichment のフィルタとして使い、analysis.json 自体は完全なスキャン結果を保持する設計。data フェーズで出力時にフィルタするのが正しいレイヤー。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: autoApprove — gate PASS 後に自動承認

## Requirements

優先順位: R1 > R2 > R3

1. **R1** (P1): data コマンドが analysis オブジェクトを DataSource の resolve 関数に渡す際、`config.docs.exclude` パターンに一致するエントリ（`relPath` または `file` フィールドで判定）を各カテゴリの `entries` 配列から除外すること
2. **R2** (P1): `filterByDocsExclude` ロジックを `enrich.js` と `data.js` で共有し、重複実装を避けること。共有関数は `src/docs/lib/` に配置すること
3. **R3** (P2): `docs.exclude` が未設定（`undefined` または空配列）の場合、フィルタ処理をスキップし既存の動作が維持されること

## Acceptance Criteria

1. `docs.exclude` に `src/presets/**` を設定した状態で `sdd-forge data` を実行すると、`StructureSource` の出力に `src/presets/` 配下のディレクトリが含まれない
2. `enrich.js` 内に `filterByDocsExclude` の実装がなく、共有ユーティリティからの import に置き換えられている
3. `docs.exclude` 未設定の場合、`sdd-forge data` の出力が変更前と同一

## Open Questions

（なし）
