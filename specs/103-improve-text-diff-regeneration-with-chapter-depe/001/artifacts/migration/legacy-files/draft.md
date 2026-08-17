# Draft: Improve text diff regeneration with chapter dependencies and entry-level detection

## Issue

GitHub Issue #31: text 差分再生成の仕組み改善（章依存と entry 単位の判定）

## 決定事項

### 1. entry_id

- 永続 ID 方式を採用
- analysis.json の各 entry に `id` フィールドとして保存
- scan 時に `category + file + subkey` で前回 entry と照合し、既存 ID を引き継ぐ
- マッチしない entry → 新規採番
- 前回にあって今回ない entry → 削除扱い
- ID は人間可読である必要はない

### 2. subkey が必要な category

- 1ファイル1entry の category（package, structure 等）: `category + file` で照合
- 1ファイルから複数 entry が出る category: category 固有の識別フィールドを subkey に使う
  - controllers, models, entities, commands → `className`
  - routes → `name` or `path`
  - tables → `name`（テーブル名）
  - config → category 固有の key

### 3. 章依存データ

- 別ファイルに保存しない
- text 実行時に analysis.json の各 entry の `chapter` フィールドから都度算出
- enrich 時に付与される `chapter` フィールドをそのまま利用

### 4. 変更検知

- text 実行時に analysis.json 内の entry の `hash`（ファイル内容 hash）と現在のソースファイルの hash を比較
- hash 一致 → 変更なし
- hash 不一致 or 新規 entry → 変更あり → その entry の `chapter` から再生成対象の章を特定
- 差分制御用 state ファイルは不要（analysis.json とソースファイルだけで完結）

### 5. 影響を受ける既存機能

- `scan`: entry に永続 `id` の採番・引き継ぎロジック追加
- `text`: 変更 entry → 章の特定 → 差分再生成ロジック追加
- `analysis.json`: 各 entry に `id` フィールド追加（既存フォーマットへの追加のみ）

## 承認

- [x] User approved this draft (2026-03-30)
