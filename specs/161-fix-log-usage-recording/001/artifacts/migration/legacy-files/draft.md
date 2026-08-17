# Draft: fix-log-usage-recording

**開発種別:** バグ修正（実装漏れ）
**目的:** `log.js` の `#agentImpl` が `entry.usage` を無視しているため、usage（token数・cache hit数・cost）がログに記録されない問題を修正する。

## 背景

spec 155（`agent-json-output-usage`）の受入基準：

> `.tmp/logs/prompts.jsonl` の end-event に `usage` フィールドが記録される

`agent.js` は usage を正しくパース・構築して `logger.agent({ ..., usage })` に渡しているが、`log.js` の `#agentImpl` が `entry.usage` を受け取りながら promptPayload にも JSONL line にも書き出していない。

## 変更内容

変更対象は `src/lib/log.js` の `#agentImpl`（phase === "end" 処理）のみ。

### per-request JSON (`prompts/YYYY-MM-DD/<requestId>.json`)

`promptPayload` にトップレベルで `usage` フィールドを追加する：

```json
{
  "execution": { "durationSec": ... },
  "usage": {
    "input_tokens": 123,
    "output_tokens": 45,
    "cache_read_tokens": 200,
    "cache_creation_tokens": 0,
    "cost_usd": 0.0012
  }
}
```

`entry.usage` が `null` の場合は `"usage": null`。

### JSONL end-event (`sdd-forge-YYYY-MM-DD.jsonl`)

既存のフラットフィールドと同列に追加する：

```json
{
  "cacheReadTokens": 200,
  "cacheCreationTokens": 0,
  "inputTokens": 123,
  "outputTokens": 45,
  "costUsd": 0.0012
}
```

`entry.usage` が `null` の場合は各フィールドを省略（追加しない）。

## Q&A

- Q: JSONL の usage フィールドはフラットかネストか？
  - A: フラット（既存の `promptChars`, `responseChars` 等と同列）。

- Q: prompt JSON の usage 配置は？
  - A: トップレベルに `usage` セクションを追加（`execution` と並列）。フィールド名は snake_case で agent.js の正規化構造と揃える。

## 影響範囲

- `src/lib/log.js` のみ変更
- 既存の呼び出し側（agent.js）は変更不要
- `entry.usage` が `null` の場合の動作は変わらない（`jsonOutputFlag` 未設定時は今まで通り）

- [x] User approved this draft
- Confirmed at: 2026-04-08
