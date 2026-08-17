# Draft: Apply agent.timeout from config.json to all AI calls

**目的:** `config.json` の `agent.timeout`（秒）を `resolveAgent` / `loadAgentConfig` の返り値に含め、`callAgent` / `callAgentAsync` がそれをデフォルトタイムアウトとして使用するようにする。現在バラバラに行われている timeout 解決を一元化する。

**開発種別:** Enhancement（既存機能の改善）

## Q&A

### 1. Goal & Scope

**Q: ゴールは明確か？スコープは限定されているか？**

A: ゴールは明確。`agent.timeout` を config から読み、全 AI 呼び出しのデフォルトタイムアウトとして適用する。スコープは `src/lib/agent.js` の `resolveAgent` / `loadAgentConfig` と、それを呼び出す全コマンド。

### 2. Impact on existing

**Q: 既存機能への影響は？**

A: 現在の状況:
- `src/lib/agent.js`: `DEFAULT_AGENT_TIMEOUT_MS` (300000ms) がハードコードされたデフォルト
- `src/docs/commands/text.js:690`: `cfg.agent?.timeout` を直接読んでいる
- `src/docs/commands/forge.js:209`: 同上
- `src/docs/commands/enrich.js:444`: 同上
- `src/docs/commands/readme.js:151`: `DEFAULT_AGENT_TIMEOUT_MS` を直接使用（config 未参照）
- `src/flow/lib/run-review.js:104`: `timeout: 300000` がハードコード

変更後: `resolveAgent` が `timeout` (ms) を返すようになり、呼び出し側は `agent.timeout` を参照するだけで済む。各コマンドで個別に `cfg.agent?.timeout` を読む必要がなくなる。

### 3. Constraints

**Q: 制約・ガードレールは？**

A:
- CLI の `--timeout` オプション（text.js 等）は引き続き config よりも優先される（明示指定 > config > デフォルト）
- `agent.timeout` は秒単位（config.example.json 参照）、内部は ms 単位。変換は `resolveAgent` で一度だけ行う
- 外部依存禁止ルール: Node.js 組み込みのみ
- 後方互換不要（alpha ポリシー）

### 4. Edge cases

**Q: 境界条件・エラーケースは？**

A:
- `agent.timeout` が未定義の場合: `DEFAULT_AGENT_TIMEOUT_MS` (300000) を使用
- `agent.timeout` が 0 以下の場合: types.js のバリデーションで弾かれる（既存）
- CLI の `--timeout` と config の timeout が両方ある場合: CLI が優先

### 5. Test strategy

**Q: テスト戦略は？**

A:
- `resolveAgent` が config の timeout を ms 変換して返すことの単体テスト
- timeout 未定義時にデフォルト値が使われることのテスト
- 既存テストの回帰確認

## Decisions

1. `resolveAgent` の返り値に `timeoutMs` フィールドを追加する
2. `loadAgentConfig` は `resolveAgent` を呼ぶだけなので自動的に含まれる
3. 各コマンドの `cfg.agent?.timeout` 直接参照を `agent.timeoutMs` 参照に置き換える
4. `run-review.js` のハードコード 300000 も `agent.timeoutMs` 経由に置き換える

- [x] User approved this draft (autoApprove)
