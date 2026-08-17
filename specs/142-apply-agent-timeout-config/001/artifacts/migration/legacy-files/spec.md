# Feature Specification: 142-apply-agent-timeout-config

**Feature Branch**: `feature/142-apply-agent-timeout-config`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #88
**開発種別:** Enhancement

## Goal

`config.json` の `agent.timeout`（秒）を `resolveAgent` の返り値に含め、全 AI 呼び出し（`callAgent` / `callAgentAsync`）のデフォルトタイムアウトとして一元的に適用する。現在各コマンドでバラバラに行われている timeout 解決を統一する。

## Scope

- `src/lib/agent.js` の `resolveAgent` が `timeoutMs` フィールドを返すようにする
- `callAgent` / `callAgentAsync` が `agent.timeoutMs` をデフォルトとして使用する
- 各コマンドで個別に `cfg.agent?.timeout` を読んでいる箇所を `agent.timeoutMs` 参照に統一する
- 各コマンドで `DEFAULT_AGENT_TIMEOUT_MS` を直接使用している箇所を `agent.timeoutMs` 参照に統一する
- `src/flow/lib/run-review.js` のハードコード `timeout: 300000` を config 経由に置き換える

## Out of Scope

- `agent.timeout` の config バリデーション変更（`src/lib/types.js` のバリデーションは既存のまま）
- CLI `--timeout` オプションの仕様変更（既存の優先順位を維持）
- `src/lib/process.js` の `runCmd` のタイムアウト（agent 呼び出しではない）
- `src/docs/commands/init.js` の AI フィルタリング呼び出し（`callAgent` に 60000ms を渡している短時間の補助呼び出しであり、意図的な固定値）
- `src/docs/lib/template-merger.js` の `translateTemplate` 呼び出し（`callAgent` に 60000ms を渡している短時間の補助呼び出しであり、意図的な固定値）
- `src/flow/lib/get-context.js` の AI キーワード検索呼び出し（`callAgent` に 30000ms を渡している意図的な短縮値であり変更しない）

## Clarifications (Q&A)

- Q: タイムアウトの優先順位は？
  - A: CLI `--timeout` > `config.json` の `agent.timeout` > `DEFAULT_AGENT_TIMEOUT_MS` (300000ms)。この優先順位は変更しない。

- Q: `agent.timeout` の単位は？
  - A: config.json では秒（config.example.json 参照: `"timeout": 300`）。内部では ms。変換は `resolveAgent` で一度だけ行う。

- Q: `run-review.js` のハードコードはなぜ config 経由にするか？
  - A: review コマンドは agent を呼ぶ前に外部スクリプトを実行するが、そのタイムアウトも agent timeout に連動すべき。config の agent.timeout が参照されないのは不整合。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-04
- Notes: auto mode

## Requirements

Requirements are listed in priority order (highest first).

1. `resolveAgent(cfg, commandId)` の返り値オブジェクトに `timeoutMs` フィールドを追加する。値は `cfg.agent.timeout * 1000`。`agent.timeout` が未定義の場合は `DEFAULT_AGENT_TIMEOUT_MS` (300000) を使用する。
2. `callAgent` と `callAgentAsync` において、`timeoutMs` 引数が falsy の場合に `agent.timeoutMs`（resolveAgent の返り値）をデフォルトとして使用する。`agent.timeoutMs` も存在しない場合は `DEFAULT_AGENT_TIMEOUT_MS` にフォールバックする。
3. `src/docs/commands/text.js` の `cfg.agent?.timeout` 直接参照を削除し、`agent.timeoutMs` を使用する。
4. `src/docs/commands/forge.js` の `config.agent?.timeout` 直接参照を削除し、`agent.timeoutMs` を使用する。`forge.js` の `invokeAgent` は既に `agent.timeoutMs` フォールバックを持つ（`const timeout = timeoutMs || Number(agent?.timeoutMs) || DEFAULT_TIMEOUT_MS`）。L209 の `config.agent?.timeout` 変換を削除し、`resolveAgent` が返す `timeoutMs` に委譲するだけで足りる。
5. `src/docs/commands/enrich.js` の `config.agent?.timeout` 直接参照を削除し、`agent.timeoutMs` を使用する。
6. `src/docs/commands/readme.js` で `DEFAULT_AGENT_TIMEOUT_MS` を直接使用している箇所を `agent.timeoutMs` に置き換える。
7. `src/flow/lib/run-review.js` のハードコード `timeout: 300000` を config から取得した値に置き換える。
8. `src/docs/commands/translate.js` で `DEFAULT_AGENT_TIMEOUT_MS` を `DEFAULT_TIMEOUT_MS` として直接使用している箇所を `agent.timeoutMs` に置き換える。
9. `src/docs/commands/agents.js` で `DEFAULT_AGENT_TIMEOUT_MS` を `callAgent` の第3引数に直接渡している箇所を `agent.timeoutMs` に置き換える。

## Acceptance Criteria

1. `resolveAgent` が `agent.timeout` 設定値を ms 変換した `timeoutMs` を含むオブジェクトを返すこと
2. `agent.timeout` が未設定の場合、`timeoutMs` が `DEFAULT_AGENT_TIMEOUT_MS` (300000) であること
3. 各コマンド（text, forge, enrich, readme, translate, agents）で `cfg.agent?.timeout` の直接参照が存在しないこと
4. `run-review.js` にハードコードされた `300000` が存在しないこと
5. 既存テストが全て PASS すること

## Test Strategy

- `resolveAgent` に `agent.timeout` を含む config を渡した場合に `timeoutMs` が正しく ms 変換されて返ることを検証するユニットテスト
- `agent.timeout` が未定義の config を渡した場合に `DEFAULT_AGENT_TIMEOUT_MS` がデフォルトとして返ることを検証するユニットテスト
- テスト配置: `tests/unit/` — `resolveAgent` は公開 API であり、将来の変更で壊れた場合は常にバグ

## Existing Feature Impact

- **text.js, forge.js, enrich.js**: `cfg.agent?.timeout` の直接読み取りが不要になる。動作は同一（config の値が使われる）
- **readme.js**: config の agent.timeout が反映されるようになる（現在は常にデフォルト値）
- **translate.js**: config の agent.timeout が反映されるようになる（現在は常にデフォルト値）
- **agents.js**: config の agent.timeout が反映されるようになる（現在は常にデフォルト値）
- **run-review.js**: config の agent.timeout が反映されるようになる（現在はハードコード 300000ms）
- **flow/commands/review.js**: timeout 未指定の `callAgent` 呼び出しが `agent.timeoutMs` を自動適用するようになる（Requirement 2 による暗黙の動作改善）
- **run-gate.js, run-retro.js**: timeout 未指定の `callAgent` 呼び出しが config 値を自動適用するようになる（Requirement 2 による動作改善）
- **CLI `--timeout` オプション**: 変更なし。引き続き config よりも優先される

## Open Questions
- (none)
