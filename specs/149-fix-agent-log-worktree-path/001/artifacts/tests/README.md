# Tests: 149-fix-agent-log-worktree-path

## What was tested and why

`resolveLogDir(cwd, cfg)` が worktree モード中にメインリポジトリのパスへ正しくリダイレクトするかを検証する。

spec 149 の要件 req0〜req3 をすべてカバーする。

## Test location

`specs/149-fix-agent-log-worktree-path/tests/resolve-log-dir.test.js`

spec 検証テスト（`npm test` には含まれない）。

## How to run

```bash
node --test specs/149-fix-agent-log-worktree-path/tests/resolve-log-dir.test.js
```

## Expected results

- req0: `cfg.logs.dir` が設定されていれば worktree 検出なしでその値を返す
- req1: worktree パスを渡すと main repo ベースのパスを返す（`isInsideWorktree` + `getMainRepoPath` を使用）
- req2: 通常リポジトリでは `cwd` ベースのパスを返す（既存動作不変）
- req3: `.git` ファイルは存在するが git-common-dir の解決に失敗する場合、エラーが伝播する

全 6 テスト PASS。
