# Tests for spec 112: fix-finalize-worktree-cwd

## What was tested
- 旧指示（メインリポジトリから実行）が削除されていること
- worktree 内実行 + cd 復帰の手順が記述されていること
- フォアグラウンド実行の指示が記述されていること

## Where tests are located
- `specs/112-fix-finalize-worktree-cwd/tests/verify-finalize-skill.test.js`

## How to run
```bash
node --test specs/112-fix-finalize-worktree-cwd/tests/verify-finalize-skill.test.js
```

## Expected results
- 実装前: 3テスト中2-3が FAIL
- 実装後: 全テスト PASS
