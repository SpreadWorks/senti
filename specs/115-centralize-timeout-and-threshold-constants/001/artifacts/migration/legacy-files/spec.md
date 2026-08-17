# Feature Specification: 115-centralize-timeout-and-threshold-constants

**Feature Branch**: `feature/115-centralize-timeout-and-threshold-constants`
**Created**: 2026-03-31
**Status**: Draft
**Input**: Issue #55

## Goal

`DEFAULT_AGENT_TIMEOUT * 1000` のミリ秒変換が6箇所で重複している。`DEFAULT_AGENT_TIMEOUT_MS` を `lib/agent.js` から export し、各コマンドファイルの重複を解消する。

## Scope

- `src/lib/agent.js` — `DEFAULT_AGENT_TIMEOUT_MS` を追加し export
- `src/docs/commands/text.js` — `DEFAULT_TIMEOUT_MS` の定義を `DEFAULT_AGENT_TIMEOUT_MS` の import に置換
- `src/docs/commands/forge.js` — 同上
- `src/docs/commands/translate.js` — 同上
- `src/docs/commands/enrich.js` — `DEFAULT_AGENT_TIMEOUT * 1000` を `DEFAULT_AGENT_TIMEOUT_MS` に置換
- `src/docs/commands/readme.js` — 同上
- `src/docs/commands/agents.js` — 同上

## Out of Scope

- `lib/constants.js` の新規作成（過剰な抽象化。alpha 版ポリシーに反する）
- enrich の `DEFAULT_BATCH_SIZE` / `DEFAULT_BATCH_LINES` の移動（コマンド固有の閾値）
- text の `SHRINKAGE_*` 閾値の移動（コマンド固有の閾値）
- `config.json` による閾値の上書き機能
- `ARGV_SIZE_THRESHOLD` の移動（agent.js 内部で完結）

## Clarifications (Q&A)

- Q: `DEFAULT_AGENT_TIMEOUT`（秒単位）は残すか？
  - A: 残す。`callAgent` / `callAgentAsync` の内部で `timeoutMs || DEFAULT_AGENT_TIMEOUT * 1000` として使われており、JSDoc にも記載されている。両方 export する。

- Q: enrich.js の `config.agent.timeout * 1000` も置換するか？
  - A: しない。これは config 由来の値であり DEFAULT 定数とは別。

## User Confirmation

- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-03-31
- Notes: autoApprove mode

## Requirements

1. (P1) `src/lib/agent.js` に `export const DEFAULT_AGENT_TIMEOUT_MS = DEFAULT_AGENT_TIMEOUT * 1000` を追加する
2. (P1) `text.js`, `forge.js`, `translate.js` のローカル `const DEFAULT_TIMEOUT_MS = DEFAULT_AGENT_TIMEOUT * 1000` を削除し、`DEFAULT_AGENT_TIMEOUT_MS` を agent.js から import する
3. (P1) `enrich.js`, `readme.js`, `agents.js` の `DEFAULT_AGENT_TIMEOUT * 1000` を `DEFAULT_AGENT_TIMEOUT_MS` に置換する
4. (P2) `timeoutMs` 引数が未指定の場合、`src/lib/agent.js` の `callAgent` と `callAgentAsync` は `DEFAULT_AGENT_TIMEOUT * 1000` をフォールバック値として使う。この式を `DEFAULT_AGENT_TIMEOUT_MS` に置換する
5. (P2) 変更完了後に `npm test` を実行した場合、全テストが 0 件の failure でパスすること

## Acceptance Criteria

- `DEFAULT_AGENT_TIMEOUT_MS` が `src/lib/agent.js` から export されている
- `text.js`, `forge.js`, `translate.js` にローカルの `DEFAULT_TIMEOUT_MS` 定義がない
- ソースコード内に `DEFAULT_AGENT_TIMEOUT * 1000` のパターンが JSDoc コメント以外に存在しない
- 全テストがパスする

## Open Questions

- なし
