# Draft: 105-agent-retry-config-scope

## Q&A

1. Q: Issue #36 の機能は既に enrich に実装済み。残作業の範囲は？
   A: enrich と text でリトライロジックを共通化する

2. Q: 共通化の方法は？
   A: `callAgentAsync` に `options.retryCount` / `options.retryDelayMs` を追加

3. Q: `getRetryCount` ヘルパーの配置は？
   A: ヘルパー不要。各コマンドが `config.agent?.retryCount || 0` を直接渡す

## Decisions

- `callAgentAsync` にリトライオプションを追加（デフォルト retryCount:0 で後方互換）
- enrich の `enrichBatchWithRetry` を削除し `callAgentAsync` のリトライを使用
- text のハードコード1回リトライを削除し同じく `callAgentAsync` のリトライを使用
- forge, translate, agents, init は変更なし

- [x] User approved this draft
- Confirmed at: 2026-03-31
