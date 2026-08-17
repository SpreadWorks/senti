# Spec 114 Tests

## What was tested

`src/flow/run/review.js` の worktree モード修正を検証する。
Issue #43 のバグ修正（`SDD_WORK_ROOT` override 削除）が正しく適用されていることを確認する。

## Test location

- `specs/114-fix-flow-run-review-worktree-mode/tests/review-worktree.test.js`

Spec 検証テスト（`npm test` には含まれない）。

## How to run

```bash
node --test specs/114-fix-flow-run-review-worktree-mode/tests/review-worktree.test.js
```

## Expected results

修正後: 4/4 テストが PASS。

- `SDD_WORK_ROOT` への参照がないこと
- `isInsideWorktree` の import がないこと
- `getMainRepoPath` の import がないこと
- `env` 変数は引き続き `runSync` に渡されること
