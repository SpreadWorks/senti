# Tests — spec 190 (fix-pipeline-os-import)

## 検証方針

本 spec の修正は `tests/acceptance/lib/pipeline.js` の import 追加のみで、production code への変更は無い。
検証は**既存の受け入れテスト 2 件**の復旧をもって行う。新規テストは追加しない。

理由:
- 本 spec の目的は "既存 2 テストの baseline 失敗を解消する" こと。既存テストそのものが修正の検証条件になっている。
- 追加ユニットテストを書いても、実質は「既存 2 テストと同じ経路で `os` 参照が成立すること」を再確認するだけで冗長。

## 対象テスト

既存の以下 2 件:

- `acceptance report: pipeline traceability`
- `acceptance report: JSON output`

いずれも `tests/acceptance/` 配下にあり、`node tests/run.js` で実行される。

## 実行方法

ワークツリー (`.sdd-forge/worktree/feature-190-fix-pipeline-os-import`) のルートで:

```bash
node tests/run.js > .tmp/logs/test-output.log 2>&1
```

ログを確認:

```bash
grep -E "acceptance report:" .tmp/logs/test-output.log
```

## 期待結果

- 両テストとも PASS
- `ReferenceError: os is not defined` が再現しない
- 他テストに副作用が生じない
