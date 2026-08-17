# Tests for 182-container-infra

## Scope

本 spec で導入するコンポーネントの単体テストは `tests/` 配下（formal tests）に配置されており、
`npm test` で実行される。

## 配置

| ファイル | 検証対象 | 対応要件 |
|---|---|---|
| `tests/unit/lib/container.test.js` | `Container` クラスの契約（`register/get/has/reset`）、未登録 throw、paths の絶対パス | R2, R3, R4, R10, R12 |
| `tests/unit/lib/docs-context.test.js` | `resolveDocsContext(container, cli)` の戻り値構造と cli override 動作 | R7, R10 |
| `tests/unit/lib/flow-context.test.js` | `resolveFlowContext(container)` の戻り値構造と specId 解決 | R7, R10 |

## 配置判断

これらは「将来壊れたら常にバグ」である性質（Container / Context helper は全コマンドの基盤）のため、
spec-local (`specs/<spec>/tests/`) ではなく formal tests (`tests/`) に置く。

## 実行

```bash
npm test           # unit + e2e
npm run test:unit  # unit のみ
```

## 既存テストの回帰検証

本 spec の変更は既存 CLI の外部挙動を変えない（R6）。以下のコマンドで既存テストが全 PASS することを検証する:

```bash
node tests/run.js > <workDir>/logs/test-output.log 2>&1
node tests/acceptance/run.js > <workDir>/logs/acceptance-output.log 2>&1
```

## 期待結果

- 新設テスト: 実装完了時点で全 PASS
- 既存テスト: 変更前と同じく全 PASS（廃止対象関数を直接参照するテストは削除/置換のみ）
