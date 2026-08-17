# Tests for spec 176: refactor runCmd git logging

## What is tested

`runGit` のロギング動作と worktree 内での再帰解消を検証する。

| Requirement | Test |
|---|---|
| R1 (業務 git 操作のロギング) | `tests/unit/lib/git-helpers.test.js` › "returns runCmd-compatible result on success and writes a git log record" |
| R2 (worktree 内で再帰なくログ記録) | `tests/unit/lib/git-helpers.test.js` › "does not recurse when called inside a worktree" |
| R3 (runCmd は git ロギングしない) | `tests/unit/lib/git-helpers.test.js` › "runCmd('git', ...) does NOT emit a git log record" |
| R4, R5 (失敗時のログと exit code) | `tests/unit/lib/git-helpers.test.js` › "failure produces ok:false with non-zero status and is logged with stderr" |

## Where

すべて永続テスト領域 `tests/unit/lib/git-helpers.test.js` に配置。本 spec 個別領域には新規テストを置かない。

## How to run

```bash
npm test -- --filter git-helpers
# または全体
npm test
```

## Expected results

実装完了時、上記 4 テストすべてがパスする。

実装着手前の現時点では:
- `runGit` 未実装のため import エラーで全テスト失敗（期待される TDD 状態）。
