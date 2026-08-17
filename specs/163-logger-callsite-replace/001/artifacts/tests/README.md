# Tests — spec 163-logger-callsite-replace

## What is tested

`runCmd` / `runCmdAsync` が git コマンドを検出して `Logger.git` を呼び出すことを検証する。

対応する spec 要件:
- R1: `runCmd` で `cmd === "git"` を検出し Logger.git を fire-and-forget で呼ぶ
- R2: `runCmdAsync` でも同様に Logger.git を呼ぶ
- R3: git 以外のコマンドは Logger.git を呼ばない / disabled 時は no-op

## Test location

`specs/163-logger-callsite-replace/tests/logger-callsite.test.js`

このテストは spec 要件の検証テストであり、`npm test` では実行されない。

## How to run

```bash
# worktree ルート or プロジェクトルートから
node specs/163-logger-callsite-replace/tests/logger-callsite.test.js
```

## Expected results

実装前: R1/R2 のテストが FAIL（Logger.git が呼ばれないため）
実装後: すべてのテストが PASS
