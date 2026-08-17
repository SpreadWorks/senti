# Draft: AI context optimization with flow get context command

## Issue

GitHub Issue #34: AIコンテキスト最適化 - flow get contextコマンドで必要最小限の情報だけをAIに渡す

## 決定事項

### 1. スコープ
- fc44（キーワード検索）連動は除外。基本機能のみ
- 5513（構造情報の機械的抽出）は別 spec

### 2. flow get context コマンド
- 一覧モード（引数なし）: analysis.json から file + summary + methods を返す。未 enrich の entry は summary なしでソース参照を示す
- 個別読み取りモード（パス指定）: フィルタ済み内容を返す + docsRead/srcRead を自動カウント
- 出力形式: JSON envelope（flow get 統一）+ `--raw` オプションで生コンテンツ

### 3. scan タイミング
- `flow get context` 内部では scan を呼ばない（軽量・高速を維持）
- draft/spec 開始前にスキルで `sdd-forge flow run scan` を明示実行し analysis.json を最新化

### 4. スキルテンプレートの変更
- 既存の docsRead/srcRead の metric 指示を削除
- draft/spec 前に scan 実行指示を追加
- 「flow get context --raw でプロジェクト全体像を把握」を追加
- 「ファイルを読むときは flow get context <path> --raw を使え」を追加

### 5. analysis.json のフォーマット変更
- `JSON.stringify(data, null, 2)` で整形出力（diff/merge 改善）
- scan.js と enrich.js の出力箇所を変更

### 6. analysis.json の git 管理化
- `.gitignore` から `.sdd-forge/output/analysis.json` を除外
- `.gitattributes` で `analysis.json merge=ours` を設定（コンフリクト時は自分側を採用→scan 再実行）
- setup 時の `.gitignore` 設定を見直し

### 7. 既存 metric コマンドの整理
- docsRead/srcRead は flow get context 内部で自動インクリメント
- VALID_PHASES への impl 追加（未コミット分）
- スキルから metric 指示を削除

## 承認

- [x] User approved this draft (2026-03-31)
