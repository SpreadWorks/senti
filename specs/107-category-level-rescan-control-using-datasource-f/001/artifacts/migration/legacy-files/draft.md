# Draft: DataSource ファイル hash によるカテゴリ単位の再スキャン制御

## Issue
#39: Category-Level Rescan Control Using DataSource File Hashes

## 要件

### スコープ
- 解決策1（DataSource hash 自動検知）のみ
- 解決策2（手動リセット）は `--reset` として既に実装済み

### 仕組み
- scan 時に各 Scannable DataSource の .js ファイルの MD5 hash を計算
- analysis.json のカテゴリレベルに dataSourceHash を保存
- 次回 scan 時に hash を比較し、不一致ならそのカテゴリの全エントリの hash をクリア
- hash クリア → ファイルループで再パース → enrich 結果は保持
- hash 一致なら通常のファイル単位 hash スキップ
- 1 DataSource ファイル = 1 hash（子プリセットが親を上書き）

### 変更範囲
- scan.js: DataSource ロード時に hash 計算、カテゴリ書き出し時に dataSourceHash 保存、不一致検出 + hash クリア
- data-source-loader.js: ロード時にファイルパスを保持

### 変更しないもの
- enrich.js: summary 有無による再実行判定は既存のまま
- --reset オプション: 既存のまま

- [x] User approved this draft (2026-03-31)
