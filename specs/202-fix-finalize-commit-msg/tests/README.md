# Tests for 202-fix-finalize-commit-msg

## 目的

issue #197 の回帰を防ぐテスト。`sdd-forge flow run finalize` の retro/report 後処理コミットが spec ディレクトリ外の変更を巻き込まないことを保証する。

## 配置

- **Formal test (npm test 対象)**: `tests/unit/flow/run-finalize-retro-commit-scope.test.js`

本 spec のみの検証ではなく、finalize の commit 範囲契約（将来のリファクタで壊れたら常にバグ）を守るためのテストなので `tests/` 配下に置く。

## 検証内容

1. `executeCommitPost` の関数本体に `git add -A` が含まれていないこと
2. `executeCommitPost` の関数本体に spec ディレクトリ由来のパス（`specDir` / `state.spec` / `specPath` などの識別子）を引数に取る `git add` が含まれていること

テストはソース検査型。AST ではなく関数本体を抽出して regex で検証する（既存 `run-finalize-retro-invocation.test.js` と同方式）。

## 実行方法

```bash
node tests/unit/flow/run-finalize-retro-commit-scope.test.js
# または
npm test
```

## 期待結果

- 修正前: 2/2 FAIL（`git add -A` が検出される / spec パスが検出されない）
- 修正後: 2/2 PASS
