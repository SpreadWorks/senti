# Tests for spec 183-agent-service-refactor

## Placement

このリファクタの単体テストは `tests/unit/lib/` に追加しました（公開的な API 契約テストとして長期維持される性質のため）。

- `tests/unit/lib/provider.test.js` — `Provider` 抽象基底、`ClaudeProvider` / `CodexProvider` 具象、`ProviderRegistry` の契約テスト
- `tests/unit/lib/agent-service.test.js` — `Agent` サービスクラスの契約テスト（resolve, call signature, workDir 自動付与, argv 閾値, リトライ既定値とクランプ）

本 spec 固有の移行確認テストは現時点では不要（既存 `tests/unit/lib/agent.test.js` の新 API 移植で回帰検証が成立する）。

## What is tested

| テストファイル | 検証要件 |
|---|---|
| provider.test.js | R6（provider 別ドメイン知識の集約）、R4（workDir フラグ宣言）|
| agent-service.test.js | R1（サービス経由）、R2（timeoutMs/cwd 引数廃止）、R4（workDir 自動付与）、R5（argv 閾値の設定化）、R8（非同期 API）、R9（リトライ既定値とクランプ）|

R3, R7（同期経路廃止／旧 export 削除）は impl フェーズで agent.test.js を新 API に移植する際に直接検証される（旧 export を import している現テストが落ちることで担保）。

## How to run

```bash
node tests/run.js --scope unit > .tmp/logs/test-output.log 2>&1
grep -E "ok|not ok|fail" .tmp/logs/test-output.log
```

## Expected results (initial — implementation not yet done)

`provider.test.js` および `agent-service.test.js` は impl フェーズ前は **失敗** する（新モジュール `src/lib/provider.js` および新クラス `Agent` が存在しない）。impl フェーズで新サービスを実装すると緑になる。
