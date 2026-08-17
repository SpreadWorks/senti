# Tests for spec 154-subprocess-crash-details

## What was tested and why

### Formal tests (`tests/unit/lib/process.test.js`)

既存の `process.test.js` に以下のテストを追加した。これらは `runCmd`・`runCmdAsync`・`formatError` の公開インターフェース契約テストであるため、将来の変更で壊れたら常にバグとみなせる。

- `runCmd` 成功時に `signal: null, killed: false` が返る
- `runCmd` 非シグナル失敗時に `signal: null, killed: false` が返る
- `runCmd` タイムアウト時に `signal` が non-null、`killed: true` が返る
- `runCmdAsync` 成功時に `signal: null, killed: false` が返る
- `runCmdAsync` 非シグナル失敗時に `signal: null, killed: false` が返る
- `runCmdAsync` ENOENT 時に `status` が数値 `1` になる
- `formatError` の全フォーマットパターン（signal あり/なし、killed あり/なし、stderr あり/なし）

### Spec verification tests（このディレクトリ）

`runCmdWithRetry` のシグナル判定が正規表現からフィールド参照に変わったことを検証する。将来の変更に対して維持すべき保証かは判断が分かれるため、spec 検証テストとして配置した。

## Test locations

| テスト | パス |
|--------|------|
| `runCmd`/`runCmdAsync`/`formatError` formal tests | `tests/unit/lib/process.test.js` |
| `runCmdWithRetry` signal detection | `specs/154-subprocess-crash-details/tests/run-cmd-with-retry-signal.test.js` |

## How to run

```bash
# formal tests（npm test に含まれる）
node --test tests/unit/lib/process.test.js

# spec verification tests（個別実行）
node --test specs/154-subprocess-crash-details/tests/run-cmd-with-retry-signal.test.js
```

## Expected results

実装完了後:

- `process.test.js`: 全テスト PASS
- `run-cmd-with-retry-signal.test.js`: 全テスト PASS（特に "retries when stderr contains 'killed' text" が PASS することで、旧 regex 動作からフィールド参照への切り替えを確認）
