## Problem

There are two bugs in the worktree squash route of merge.js.

### Bug 1: Missing baseBranch checkout
The worktree squash route (L196-210) performs a squash merge onto the current branch of the main repo, but does not checkout baseBranch. Branch mode (L213-216) explicitly performs a checkout, yet the worktree mode alone is missing it. Since `flow prepare --worktree` does not change the main repo's branch, there is no guarantee that the main repo is on baseBranch.

Reproduction condition: baseBranch ≠ current branch of the main repo (can occur even without concurrent flows).

### Bug 2: False dirty-worktree error in rebaseOnto
When rebaseOnto fails `git rebase` due to a dirty worktree, it runs `git diff --diff-filter=U` to collect conflicted files; but because there are no actual conflicts, an empty array is returned. This results in the cryptic error message `conflicts in .`.

## Fix Strategy

Bug 1: In the worktree squash route, checkout baseBranch before merging → if that fails (branch is checked out in another worktree), fall back to a temporary detached worktree.
Bug 2: In rebaseOnto, inspect stderr for "unstaged changes" or similar indicators and branch the error message accordingly.

<details>
<summary>ja</summary>

[ENHANCE] finalize-merge: worktree squash の baseBranch checkout 欠落 + rebaseOnto 誤報

## 問題

merge.js の worktree squash ルートに2つのバグがある。

### Bug 1: baseBranch checkout の欠落
worktree squash ルート (L196-210) は main repo の現在ブランチに squash merge するが、baseBranch への checkout を行わない。branch モード (L213-216) は明示的に checkout するのに、worktree モードだけ欠落。flow prepare --worktree は main repo のブランチを変更しないため、main repo が baseBranch 上にある保証はない。

再現条件: baseBranch ≠ main repo の現在ブランチ（並行フローでなくても発生しうる）。

### Bug 2: rebaseOnto の dirty worktree 誤報
rebaseOnto が dirty worktree で git rebase に失敗した場合、git diff --diff-filter=U で conflict ファイルを取得するが、実際はコンフリクトではないので空配列が返る。結果 conflicts in . という意味不明なエラーメッセージになる。

## 修正方針

Bug 1: worktree squash ルートで baseBranch を checkout → 失敗時（別 worktree で使用中）は一時 detached worktree にフォールバック。
Bug 2: rebaseOnto で stderr に unstaged changes 等が含まれるか判定し、エラーメッセージを分岐。

</details>