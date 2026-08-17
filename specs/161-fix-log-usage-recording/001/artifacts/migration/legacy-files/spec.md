# Feature Specification: 161-fix-log-usage-recording

**Feature Branch**: `feature/161-fix-log-usage-recording`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User request

## Goal

`log.js` の `#agentImpl` が `entry.usage` を無視しているため、usage（token 数・cache hit 数・cost）がログに記録されない実装漏れを修正する。spec 155（`agent-json-output-usage`）の受入基準を満たす。

## Scope

- `src/lib/log.js` の `#agentImpl`（phase === "end" 処理）に `entry.usage` の記録を追加する
  - per-request JSON (`prompts/YYYY-MM-DD/<requestId>.json`) にトップレベルの `usage` フィールドを追加
  - JSONL end-event (`sdd-forge-YYYY-MM-DD.jsonl`) にフラットな usage フィールド群を追加

## Out of Scope

- `src/lib/agent.js` の変更（usage のパース・構築は実装済み）
- `Logger.agent()` の公開インターフェース変更
- usage データの可視化・集計ツール（`scripts/cache-stats.js` 等）
- 既存ログファイルのマイグレーション

## Clarifications (Q&A)

- Q: JSONL の usage フィールドはフラットかネストか？
  - A: フラット。既存の `promptChars`, `responseChars` 等と同列に追加する。

- Q: prompt JSON の usage 配置は？
  - A: トップレベルに `usage` セクションを追加（`execution` と並列）。フィールド名は snake_case（agent.js の正規化構造と揃える）。

## Alternatives Considered

- **`execution` セクション内に usage を追加する**: `execution.durationSec` と異なる関心事（実行メタ vs. LLM 使用量）を同一セクションに混在させるため不採用。トップレベルに独立させる方が `prompt` / `response` / `execution` / `usage` の対称性を保てる。

## Why This Approach

`agent.js` は既に usage を正しくパース・構築して `logger.agent({ ..., usage })` に渡している。修正箇所は `log.js` のみであり、呼び出し側への影響はゼロ。変更の局所性が最大になるため、この方針を採用する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08
- Notes: autoApprove

## Requirements

優先度順（高→低）:

1. **[必須] per-request JSON への usage 記録**: `#agentImpl` の phase === "end" 処理において、`promptPayload` にトップレベルで `usage` フィールドを追加すること。値は `entry.usage ?? null`（`entry.usage` が null の場合は `"usage": null`）。

2. **[必須] JSONL end-event への usage 記録**: JSONL の end-event line に、以下のフラットフィールドを追加すること。`entry.usage` が null の場合は各フィールドを追加しない（省略）。
   - `cacheReadTokens`: `entry.usage.cache_read_tokens`
   - `cacheCreationTokens`: `entry.usage.cache_creation_tokens`
   - `inputTokens`: `entry.usage.input_tokens`
   - `outputTokens`: `entry.usage.output_tokens`
   - `costUsd`: `entry.usage.cost_usd`

## Acceptance Criteria

- `entry.usage` が null でない場合、per-request JSON ファイルのトップレベルに `usage` オブジェクト（`input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `cost_usd` を含む）が記録されること
- `entry.usage` が null でない場合、JSONL end-event に `cacheReadTokens`, `cacheCreationTokens`, `inputTokens`, `outputTokens`, `costUsd` のフラットフィールドが記録されること
- `entry.usage` が null の場合、per-request JSON は `"usage": null`、JSONL は usage フィールドを含まないこと
- `src/lib/agent.js` および既存の呼び出し側は変更不要であること

## Test Strategy

`specs/161-fix-log-usage-recording/tests/` に配置するスペック検証テスト（`npm test` 対象外）：

- **usage あり（per-request JSON）**: `entry.usage` を含む end-event を記録し、生成された JSON ファイルのトップレベルに `usage` オブジェクトが存在することを確認
- **usage あり（JSONL）**: 同じ end-event の JSONL line にフラットな usage フィールドが存在することを確認
- **usage なし（null）**: `entry.usage = null` の end-event で、JSON が `"usage": null`、JSONL に usage フィールドが含まれないことを確認

テスト方法: `Logger` を直接インスタンス化し、仮の `entry` オブジェクトを渡して出力ファイルを検証する単体テストとして実装する。

## Open Questions

なし
