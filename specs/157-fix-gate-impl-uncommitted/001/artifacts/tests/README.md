# Tests for spec #157: fix-gate-impl-uncommitted

## What was tested and why

`gate impl` が未コミットの変更（staged/unstaged）を検出できない問題（Issue #111）の修正を検証するテスト。

`src/flow/lib/run-gate.js` の `executeImpl()` が `git diff baseBranch...HEAD` のみを使用していたため、コミット前の変更がある場合でも "no changes found" で FAIL していた。

## Test location

`specs/157-fix-gate-impl-uncommitted/tests/gate-impl-uncommitted.test.js`

**配置理由**: このテストは spec #157 の要件充足を確認する spec 検証テストであり、`npm test` には組み込まない。

## How to run

```bash
# プロジェクトルート（worktree root）で実行
node --test specs/157-fix-gate-impl-uncommitted/tests/gate-impl-uncommitted.test.js
```

## Expected results (post-fix)

| Test | Expected |
|---|---|
| unstaged 変更あり → gate impl | "no changes found" エラーが出ないこと |
| staged 変更あり → gate impl | "no changes found" エラーが出ないこと |
| 変更なし → gate impl | "uncommitted" を含むメッセージで FAIL |

## Pre-fix behavior (what fails before the fix)

すべてのテストが FAIL する:
- Tests 1, 2: `["no changes found against base branch"]` エラーが返される（unstaged/staged 変更があるのに検出されない）
- Test 3: メッセージに "uncommitted" が含まれない
