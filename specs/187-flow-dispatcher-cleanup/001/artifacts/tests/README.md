# Tests for spec 187 (flow-dispatcher-cleanup)

## What was tested

Spec 187 はリファクタリング（振る舞い不変）のため、検証は以下の 2 軸:

1. **既存テストの回帰検出** — `npm test` の緑維持で R1 (FlowCommand container 接続), R2 (registry hook 整理), R3 (非定型エラー再 throw), R4 (post hook 実行タイミング), R6 (未使用 finally 削除) の振る舞い不変を確認。flow dispatcher / hook / gate / registry を扱う既存ユニット・E2E テストが回帰検出する。
2. **新規 unit test** — `Envelope` クラス (R5) は新規 OOP 型のため invariant テストを追加。

## Where tests are located

- 新規: `tests/unit/lib/envelope.test.js`（formal test, `npm test` 対象）。
- 既存: `tests/unit/flow.test.js`, `tests/unit/flow/*.test.js`, `tests/unit/lib/log.test.js` 等が flow dispatcher と関連層を回帰カバーする。

spec ディレクトリ配下にはテストを置かない（spec verification ではなく、Envelope は今後永続的に維持される公開型のため）。

## How to run

```bash
node tests/run.js --scope unit > .tmp/logs/test-output.log 2>&1
```

特定のテストのみ実行する場合:

```bash
node --test tests/unit/lib/envelope.test.js
```

## Expected results

- `tests/unit/lib/envelope.test.js`: `Envelope.ok/fail/warn` の invariant、`addWarning()` の追加挙動、`output()` の stdout 書き込みと `process.exitCode` 設定が全 PASS。
- 既存 `npm test` 全体が緑（リファクタリング前後で同一の振る舞い）。
