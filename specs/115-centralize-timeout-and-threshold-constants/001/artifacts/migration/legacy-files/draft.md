# Draft: 115-centralize-timeout-and-threshold-constants (autoApprove self-Q&A)

## 1. Goal & Scope
- `DEFAULT_AGENT_TIMEOUT * 1000` の変換が6箇所で重複。`DEFAULT_AGENT_TIMEOUT_MS` を agent.js から export して統一する
- enrich の DEFAULT_BATCH_SIZE/DEFAULT_BATCH_LINES、text の SHRINKAGE 閾値は各コマンド固有のため移動不要。Issue の「lib/constants.js に集約」は過剰
- スコープ: タイムアウト ms 変換の統一のみ

## 2. Impact on existing
- 対象ファイル: agent.js, text.js, forge.js, enrich.js, translate.js, readme.js, agents.js
- agent.js に `DEFAULT_AGENT_TIMEOUT_MS` を追加し export
- 各コマンドファイルで `DEFAULT_AGENT_TIMEOUT * 1000` を `DEFAULT_AGENT_TIMEOUT_MS` に置換
- 外部動作は変わらない（値は同じ 300000ms）

## 3. Constraints
- alpha 版ポリシー（後方互換不要）
- 外部依存なし
- constants.js 新規ファイルは作らない（過剰な抽象化）

## 4. Edge cases
- config.agent.timeout が設定されている場合: enrich.js の `config.agent.timeout * 1000` は config 由来なので DEFAULT_AGENT_TIMEOUT_MS とは別。変更不要
- DEFAULT_AGENT_TIMEOUT（秒単位）も引き続き export される（callAgent/callAgentAsync の JSDoc で使用）

## 5. Test strategy
- tests/unit/lib/agent.test.js に DEFAULT_AGENT_TIMEOUT_MS の export 確認テストを追加
- specs/<spec>/tests/ に各ファイルが DEFAULT_AGENT_TIMEOUT_MS を使っているか確認するテスト

- [x] User approved this draft (autoApprove)
