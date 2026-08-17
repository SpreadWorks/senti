# Feature Specification: 107-category-level-rescan-control-using-datasource-f

**Feature Branch**: `feature/107-category-level-rescan-control-using-datasource-f`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #39

## Goal
DataSource の parse ロジックが修正された場合に、該当カテゴリのエントリを自動的に再パースする。DataSource の .js ファイル自体の hash を analysis.json に記録し、次回 scan 時に不一致を検出して再パースをトリガーする。これにより手動の `--reset` 実行が不要になる。

## Scope
- scan 時に DataSource .js ファイルの hash を計算し analysis.json に保存
- 次回 scan 時に hash 比較で不一致を検出し、該当カテゴリのエントリ hash をクリア
- `data-source-loader.js` でロード時にファイルパスを保持

## Out of Scope
- 手動リセット（`--reset`）— 既に実装済み。変更なし
- enrich の再実行ロジック — summary 有無による判定は既存のまま
- analysis.json のスキーマバージョニング

## Clarifications (Q&A)
- Q: dataSourceHash の保存場所は？
  - A: analysis.json のカテゴリレベル。例: `analysis.controllers.dataSourceHash = "a1b2c3d4"`
- Q: DataSource が複数ファイルから構成される場合は？
  - A: `loadDataSources` の仕組み上、同じ名前の DataSource は子プリセットが親を上書きする。最終的に 1 カテゴリ = 1 DataSource ファイルなので、1 ファイル = 1 hash で十分。
- Q: hash 不一致時に enrich 結果も消すか？
  - A: エントリの hash のみクリア。enrich 結果（summary/detail/chapter）は保持する。再パース後に構造が変わったエントリは enrich が summary 有無で再実行を判定する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: ドラフト Q&A 後、ユーザー承認済み

## Requirements

優先順位の根拠: R1 は DataSource ファイルパスの取得（R2/R3 の前提）。R2 は hash 計算と保存。R3 は不一致検出とエントリ hash クリア。

### R1: data-source-loader.js でファイルパスを保持（優先度: 1）
- `loadDataSources()` が DataSource インスタンスをロードする際、そのインスタンスに元の .js ファイルの絶対パスを保持する
- インスタンスに `_sourceFilePath` プロパティ（または同等の手段）を設定する
- scan.js が後でこのパスを参照して hash を計算できるようにする

### R2: scan 時に dataSourceHash を計算・保存（優先度: 2）
- scan.js のファイルループ完了後、各カテゴリの結果を analysis.json に書き出す際、そのカテゴリを担当する DataSource の .js ファイルの MD5 hash を `dataSourceHash` フィールドとして含める
- hash は `crypto.createHash("md5").update(fs.readFileSync(path)).digest("hex")` で計算する
- DataSource のファイルパスが取得できない場合（プロジェクト固有 DataSource 等）、`dataSourceHash` は省略する

### R3: scan 時に dataSourceHash 不一致を検出しエントリ hash をクリア（優先度: 3）
- scan.js のファイルループに入る前に、既存の analysis.json の各カテゴリの `dataSourceHash` と現在の DataSource .js ファイルの hash を比較する
- 不一致の場合、そのカテゴリの全エントリの `hash` フィールドを `null` に設定する（既存の `resetCategories` と同じ処理）
- 不一致が検出されたカテゴリ名と件数をログに出力する（例: `[scan] DataSource changed: controllers (15 entries will be re-parsed)`）
- 一致の場合は何もしない（通常のファイル単位 hash スキップが動作）

## Acceptance Criteria
1. DataSource .js ファイルを変更した後に scan を実行すると、該当カテゴリの全エントリが再パースされること
2. DataSource .js ファイルが変更されていなければ、通常のファイル単位 hash スキップが動作すること
3. analysis.json の各カテゴリに `dataSourceHash` フィールドが記録されること
4. 既存の `--reset` オプションが引き続き動作すること
5. 既存テストがパスすること

## Migration
- 新規フィールド（`dataSourceHash`）の追加のみ。既存の analysis.json に `dataSourceHash` がないカテゴリは初回 scan 時に自動的に付与される。破壊的変更なし。

## Open Questions
- [x] `_sourceFilePath` を DataSource インスタンスに直接設定するか、別の Map で管理するか → インスタンスのプロパティとして設定するのが最もシンプル
