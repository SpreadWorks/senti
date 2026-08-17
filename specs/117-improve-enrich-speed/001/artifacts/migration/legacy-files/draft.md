# Draft: 117-improve-enrich-speed

## Issue
#58 Improve enrich speed

## 決定事項

### R1: concurrency 並列化
- mapWithConcurrency + config.concurrency を enrich バッチループに適用
- 基盤は揃っている（text/translate/forge は対応済み、enrich だけ未対応）

### R2: detail 指示短縮
- buildEnrichPrompt のルールを「省略するな」→「3-5 sentences」に変更
- 出力 30-50% 削減

### R3: Essential 埋め込み
- minify(code, filePath, { mode: "essential" }) で Essential 抽出
- import/export/return/throw/主要 API 呼び出しを残す
- プロンプトにソースを埋め込み、Tool use ラウンドトリップを廃止
- minify.js に mode オプション追加。デフォルトは現行動作（コメント削除）

### R4: トークンベースのバッチ分割
- splitIntoBatches をファイル数固定からトークン上限ベースに変更
- agent.batchTokenLimit で設定可能、デフォルト 10,000
- Essential 方式は入力が軽いのでバッチサイズを大きくでき、固定オーバーヘッド削減

### R5: keywords 英語統一
- buildEnrichPrompt の言語指示を変更、keywords は英語のみ

### ベンチマーク根拠
- 方式 D（シグネチャ + detail なし）: 現在比 50% 速い（5ファイルで 40s → 20s）
- バッチサイズ 10（1バッチ）vs 2（5バッチ）: 2.8 倍速い（22s vs 61s）
- Essential 圧縮率: 元の 18%（10ファイル合計 34,281 → 6,124 トークン）
- 品質: summary ほぼ同等、chapter 完全一致、keywords 検索用途に十分

- [x] User approved this draft (2026-04-01)
