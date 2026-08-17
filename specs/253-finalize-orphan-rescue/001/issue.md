## Background

Discovered during the post-squash phase of spec 251 (#308): after squash merge completes, additional commits were made on the feature branch (in this case, 2 specId bug fixes in the post hook), but those commits are permanently lost by the cleanup step's `git branch -D <featureBranch>`. This time the user manually rescued them via `git cherry-pick`, but the process is not automated.

Scenario where the problem occurs:
1. `flow run finalize-merge` completes the squash merge successfully
2. The post hook immediately after triggers a new bug
3. AI / user creates a fix commit on the feature branch
4. `flow run finalize-cleanup` deletes the feature branch → the fix is lost

## Proposal

Implement one of the following:

### (a) Orphan commit detection + rescue at cleanup
Add `git log <baseBranch>..<featureBranch>` to the preflight of the finalize-cleanup body. If non-empty:
- Include the commit list in the envelope's `data.orphanCommits`
- Present the user with options: `cherry-pick / abort / force-continue`
- Provide an automatic cherry-pick option via CLI flag (`--auto-rescue`)

### (b) Prohibit additional commits after post-squash
Mark the feature branch as "frozen" in the post hook of `flow run finalize-merge`, and reject subsequent commits via a pre-commit hook. If a fix is needed, enforce the convention of implementing it as a separate commit on the main repo side.

Whether to adopt (a), (b), or both will be decided at the spec stage.

## Out of Scope
- PR merge routes other than squash are out of scope, as the concept of post-squash does not apply to them

<details>
<summary>ja</summary>

[ENHANCE] finalize squash 後の feature branch fix の喪失防止 (orphan commit 検出 / 凍結)

## 背景
spec 251 (#308) の post-squash 段階で発覚: squash merge が完了した後に feature branch 上で追加 commit (今回は post hook の specId bug fix 2 件) が発生したが、cleanup の `git branch -D <featureBranch>` でその commit が永久に消失する構造。今回は user 手動 `git cherry-pick` で救済したが、自動化されていない。

問題発生のシナリオ:
1. `flow run finalize-merge` が squash merge を成功
2. その直後の post hook が新たな bug を踏む
3. AI / user が feature branch で fix commit を作成
4. `flow run finalize-cleanup` が feature branch を削除 → fix が消失

## 提案
以下のいずれかを実装:

### (a) cleanup 時の orphan commit 検出 + 救済
finalize-cleanup body の preflight に `git log <baseBranch>..<featureBranch>` を追加。空でなければ:
- envelope の data.orphanCommits に commit list を含める
- user に `cherry-pick / 中断 / 強制続行` の選択肢を提示
- 自動 cherry-pick option を CLI flag (`--auto-rescue`) で提供

### (b) post-squash の追加コミット禁止
`flow run finalize-merge` の post hook で feature branch を「frozen」マークし、以降の commit を pre-commit hook で reject する。fix が必要なら main repo 側で別 commit として実装させる運用に統一。

(a) と (b) どちらを採るか / 併用するかは spec 段階で確定。

## スコープ外
- PR merge route (squash 以外) はもともと post-squash の概念がないため対象外

</details>