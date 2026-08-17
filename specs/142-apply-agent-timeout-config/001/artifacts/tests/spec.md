# Test Design

### Test Design

#### Requirement 1: `resolveAgent` に `timeoutMs` フィールドを追加

- **TC-1: resolveAgent returns timeoutMs from cfg.agent.timeout**
  - Type: unit
  - Input: `cfg = { agent: { timeout: 60, default: "claude", providers: { claude: {...} } } }`, any commandId
  - Expected: 返り値オブジェクトに `timeoutMs: 60000` が含まれる

- **TC-2: resolveAgent falls back to DEFAULT_AGENT_TIMEOUT_MS when agent.timeout is undefined**
  - Type: unit
  - Input: `cfg = { agent: { default: "claude", providers: { claude: {...} } } }` (`timeout` キーなし)
  - Expected: 返り値オブジェクトに `timeoutMs: 300000` が含まれる

- **TC-3: resolveAgent handles agent.timeout = 0**
  - Type: unit
  - Input: `cfg = { agent: { timeout: 0, default: "claude", providers: { claude: {...} } } }`
  - Expected: `0 * 1000 = 0` は falsy だが設定値として有効。仕様上 `cfg.agent.timeout` が未定義の場合にフォールバックするため、`0` は未定義ではない → `timeoutMs: 0` を返すか、あるいは `DEFAULT_AGENT_TIMEOUT_MS` にフォールバックするかの仕様確認が必要。現仕様（`cfg.agent.timeout * 1000`）に従えば `timeoutMs: 0`

- **TC-4: resolveAgent handles agent.timeout = null**
  - Type: unit
  - Input: `cfg = { agent: { timeout: null, default: "claude", providers: { claude: {...} } } }`
  - Expected: `null` は未定義相当 → `timeoutMs: 300000`（DEFAULT_AGENT_TIMEOUT_MS）

- **TC-5: resolveAgent handles agent.timeout as string number**
  - Type: unit
  - Input: `cfg = { agent: { timeout: "120", ... } }`
  - Expected: `"120" * 1000 = 120000` → `timeoutMs: 120000`（JS の暗黙型変換で動作する）

- **TC-6: resolveAgent preserves existing return fields alongside timeoutMs**
  - Type: unit
  - Input: 正常な cfg と commandId
  - Expected: 既存フィールド（provider, model 等）がそのまま存在し、`timeoutMs` が追加されている

---

#### Requirement 2: `callAgent` / `callAgentAsync` のフォールバックチェーン

- **TC-7: callAgent uses explicit timeoutMs argument when provided**
  - Type: unit
  - Input: `timeoutMs = 60000`, `agent.timeoutMs = 120000`
  - Expected: タイムアウトに `60000` が使用される

- **TC-8: callAgent falls back to agent.timeoutMs when timeoutMs argument is falsy**
  - Type: unit
  - Input: `timeoutMs = undefined`, `agent.timeoutMs = 120000`
  - Expected: タイムアウトに `120000` が使用される

- **TC-9: callAgent falls back to DEFAULT_AGENT_TIMEOUT_MS when both are missing**
  - Type: unit
  - Input: `timeoutMs = undefined`, `agent.timeoutMs = undefined`
  - Expected: タイムアウトに `300000` が使用される

- **TC-10: callAgent treats timeoutMs = 0 as falsy, falls back**
  - Type: unit
  - Input: `timeoutMs = 0`, `agent.timeoutMs = 120000`
  - Expected: `0` は falsy → `agent.timeoutMs` (120000) にフォールバック

- **TC-11: callAgent treats timeoutMs = null as falsy, falls back**
  - Type: unit
  - Input: `timeoutMs = null`, `agent.timeoutMs = 90000`
  - Expected: `agent.timeoutMs` (90000) にフォールバック

- **TC-12: callAgentAsync uses explicit timeoutMs argument when provided**
  - Type: unit
  - Input: `timeoutMs = 60000`, `agent.timeoutMs = 120000`
  - Expected: タイムアウトに `60000` が使用される

- **TC-13: callAgentAsync falls back to agent.timeoutMs when timeoutMs argument is falsy**
  - Type: unit
  - Input: `timeoutMs = undefined`, `agent.timeoutMs = 120000`
  - Expected: タイムアウトに `120000` が使用される

- **TC-14: callAgentAsync falls back to DEFAULT_AGENT_TIMEOUT_MS when both are missing**
  - Type: unit
  - Input: `timeoutMs = undefined`, `agent.timeoutMs = undefined`
  - Expected: タイムアウトに `300000` が使用される

---

#### Requirements 3–9: 各コマンドの直接参照削除（統合テスト）

- **TC-15: text.js uses agent.timeoutMs instead of cfg.agent.timeout**
  - Type: integration
  - Input: `resolveAgent` が `timeoutMs: 60000` を返す config で `text` コマンドを実行
  - Expected: エージェント呼び出しに `60000` が渡される。`cfg.agent.timeout` を直接参照していない

- **TC-16: forge.js uses agent.timeoutMs, no config.agent.timeout reference**
  - Type: integration
  - Input: `resolveAgent` が `timeoutMs: 90000` を返す config で `forge` コマンドを実行
  - Expected: `invokeAgent` のタイムアウトに `90000` が使用される

- **TC-17: forge.js invokeAgent falls back correctly when timeoutMs argument is omitted**
  - Type: unit
  - Input: `invokeAgent` に `timeoutMs` 引数なし、`agent.timeoutMs = 90000`
  - Expected: 既存フォールバック `timeoutMs || Number(agent?.timeoutMs) || DEFAULT_TIMEOUT_MS` で `90000` が使用される

- **TC-18: enrich.js uses agent.timeoutMs instead of config.agent.timeout**
  - Type: integration
  - Input: `resolveAgent` が `timeoutMs: 60000` を返す config で `enrich` コマンドを実行
  - Expected: エージェント呼び出しに `60000` が渡される

- **TC-19: readme.js uses agent.timeoutMs instead of DEFAULT_AGENT_TIMEOUT_MS**
  - Type: integration
  - Input: `resolveAgent` が `timeoutMs: 45000` を返す config で `readme` コマンドを実行
  - Expected: エージェント呼び出しに `45000` が渡される（ハードコード 300000 ではない）

- **TC-20: run-review.js uses config-derived timeout instead of hardcoded 300000**
  - Type: integration
  - Input: `agent.timeout: 120` を持つ config で review フローを実行
  - Expected: タイムアウトに `120000` が使用される（ハードコード `300000` ではない）

- **TC-21: run-review.js defaults to 300000 when no timeout configured**
  - Type: integration
  - Input: `agent.timeout` が未定義の config で review フローを実行
  - Expected: タイムアウトに `300000`（DEFAULT_AGENT_TIMEOUT_MS）が使用される

- **TC-22: translate.js uses agent.timeoutMs instead of DEFAULT_AGENT_TIMEOUT_MS**
  - Type: integration
  - Input: `resolveAgent` が `timeoutMs: 180000` を返す config で `translate` コマンドを実行
  - Expected: エージェント呼び出しに `180000` が渡される

- **TC-23: agents.js uses agent.timeoutMs instead of passing DEFAULT_AGENT_TIMEOUT_MS directly**
  - Type: integration
  - Input: `resolveAgent` が `timeoutMs: 60000` を返す config で `agents` コマンドを実行
  - Expected: `callAgent` の第3引数に直接定数を渡さず、`agent.timeoutMs` が使用される

---

#### エンドツーエンド / 受け入れテスト

- **TC-24: User-configured timeout propagates through full docs build pipeline**
  - Type: acceptance
  - Input: `.sdd-forge/config.json` に `agent: { timeout: 60 }` を設定し、`sdd-forge docs text` を実行
  - Expected: エージェント呼び出しが 60秒タイムアウトで動作する。設定値がパイプライン全体で一貫して使用される

- **TC-25: Default timeout applies when no agent.timeout in config**
  - Type: acceptance
  - Input: `agent.timeout` を含まない config で任意の docs コマンドを実行
  - Expected: 全コマンドで 300秒（300000ms）がタイムアウトとして使用される。既存動作と同一

- **TC-26: Flow review respects configured timeout end-to-end**
  - Type: acceptance
  - Input: `agent: { timeout: 180 }` を設定し、`sdd-forge flow run review` を実行
  - Expected: review のエージェント呼び出しが 180秒タイムアウトで動作する

---

#### 回帰・防御テスト

- **TC-27: No source file directly references cfg.agent.timeout or config.agent.timeout for timeout conversion**
  - Type: unit (static analysis / grep test)
  - Input: `src/docs/commands/*.js` および `src/flow/lib/*.js` を検索
  - Expected: `config.agent?.timeout` / `cfg.agent?.timeout` による秒→ミリ秒変換が存在しない（`resolveAgent` 内を除く）

- **TC-28: No source file passes DEFAULT_AGENT_TIMEOUT_MS directly to callAgent/callAgentAsync**
  - Type: unit (static analysis / grep test)
  - Input: 対象ファイル群（agents.js, readme.js, translate.js 等）を検索
  - Expected: `callAgent(..., DEFAULT_AGENT_TIMEOUT_MS)` や `callAgentAsync(..., DEFAULT_AGENT_TIMEOUT_MS)` のパターンが存在しない

---

### Summary

| Type | Count | Coverage |
|------|-------|----------|
| Unit | 16 | resolveAgent 変換ロジック、callAgent/callAgentAsync フォールバックチェーン、境界値、静的検査 |
| Integration | 9 | 各コマンドファイルが agent.timeoutMs を正しく使用することの検証 |
| Acceptance | 3 | config → resolveAgent → コマンド → エージェント呼び出しの E2E パス |
| **Total** | **28** | |
