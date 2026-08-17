# Draft: 116-auto-integrate-context-search-into-flow

## Issue
#57 Auto-integrate context search into flow-plan

## 決定事項

### --search の仕様変更（A案）
- 自然文を受け取り、コマンド内部で AI がキーワード選定 → 静的マッチ
- analysis.json から全 keywords を収集してユニークリスト化
- AI に「このキーワードリストから、クエリに関連するものを選べ」と指示
- 選ばれたキーワードで既存の静的マッチを実行

### agent 設定
- AI agent は `resolveAgent(config, 'context.search')` で解決
- config.json の commands で指定可能

### スキル統合
- flow-plan: draft/spec フェーズで `--search` を呼ぶ。リクエスト文 or Issue タイトルをそのまま渡す
- flow-impl: 実装開始時に `--search` を呼ぶ。spec の Goal をそのまま渡す

### --raw はそのまま残す
- 全体像把握用。--search は補助的な深掘り

### シミュレーション結果
- keywords がある 100 エントリでテスト実施
- 日本語キーワード（テンプレート等）でもヒットする
- 汎用語（preset, flow）は結果が多い
- exclude のように keywords 漏れがある場合、AI キーワード選定で補完できる

- [x] User approved this draft (2026-04-01)
