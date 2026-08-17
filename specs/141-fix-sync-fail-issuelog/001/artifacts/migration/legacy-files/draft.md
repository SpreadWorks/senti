# Draft: Fix sync failure issue-log recording (#87)

**開発種別:** バグ修正

**目的:** finalize の sync ステップ失敗時に issue-log が正しく記録されるようにする。

## Q&A

### Q1: commitOrSkip の修正内容は？
A: When `commitOrSkip` が `git commit` の出力に "no changes added to commit" を含むメッセージを受け取った場合、`{ status: "skipped" }` を返す（throw しない）。現在の regex `/nothing to commit/i` を `/nothing to commit|no changes added to commit/i` に拡張する。

### Q2: finalizeOnError の修正内容は？
A: When worktree モードで `finalizeOnError` が呼ばれた場合、`ctx.root`（worktree パス）ではなく `ctx.mainRoot`（メインリポジトリパス）の issue-log に書き込む。これにより post-merge ステップの issue-log エントリが cleanup 後も永続化される。

### Q3: 既存機能への影響は？
A: `commitOrSkip` は finalize の commit ステップと sync ステップで使用される。commit ステップでは "no changes added to commit" は発生しない（必ず変更がある）。sync ステップでのみ影響がある。影響は「不要な throw が skipped に変わる」方向のみ。

- [x] User approved this draft (autoApprove)
