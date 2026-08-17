# Tests for 133-restore-issue-comment

## What was tested

- R1: `executeCommitPost` に issue コメント投稿ロジックが存在すること（skip 条件3つ + commentOnIssue 呼び出し）
- R2: `run-finalize.js` が `commentOnIssue` と `isGhAvailable` を `git-state.js` から import していること

## Test location

- `specs/133-restore-issue-comment/tests/issue-comment.test.js` — ソースコードの内容検証

## How to run

```bash
node --test specs/133-restore-issue-comment/tests/issue-comment.test.js
```

## Expected results

- 実装前: 全テスト FAIL（import も issueComment ロジックも存在しない）
- 実装後: 全テスト PASS
