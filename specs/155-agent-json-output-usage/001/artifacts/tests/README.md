# Spec Tests: 155-agent-json-output-usage

## What is tested and why

`src/lib/agent.js` に追加する JSON 出力解析機能と usage 計測の spec 要件を検証する。

対象要件:
- **Req 1**: `jsonOutputFlag` が args に注入されること（重複なし）
- **Req 2**: `resolveAgent` の `providerKey` 付与（`agent.command` 部分一致）
- **Req 3**: claude / codex 形式の JSON パース。パース失敗時の plain text fallback
- **Req 5**: 戻り値が常に trimmed string であること
- **Req 6**: `jsonOutputFlag` 未設定時に動作が変わらないこと

## Test location

```
specs/155-agent-json-output-usage/tests/
└── agent-json-output.test.js   ← このファイル
```

**このテストは `npm test` の対象外**（`tests/` ではなく `specs/` 配下のため）。

## How to run

```bash
# worktree 内から
node --test specs/155-agent-json-output-usage/tests/agent-json-output.test.js

# プロジェクトルートから
cd .sdd-forge/worktree/feature-155-agent-json-output-usage
node --test specs/155-agent-json-output-usage/tests/agent-json-output.test.js
```

## Expected results

実装前: 11 fail / 7 pass（`providerKey` と JSON パース関連が失敗）

実装後（全テストパス時の期待値）:
- `resolveAgent: providerKey detection` — 5 tests PASS
- `callAgent: jsonOutputFlag args injection` — 3 tests PASS
- `callAgent: claude JSON parsing` — 2 tests PASS
- `callAgent: plain text fallback on JSON parse failure` — 2 tests PASS
- `callAgent: return value is always trimmed string` — 2 tests PASS
- `callAgent: no behavior change without jsonOutputFlag` — 1 test PASS
- `callAgentAsync: return value is string (async path)` — 2 tests PASS
