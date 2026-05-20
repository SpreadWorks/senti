## Background
The commit message on squash merge tends to become a slug derived from the spec directory name, which carries less information than the worktree's implementation commit messages or the spec title. This reduces the readability of the history.

## Goals
- Build the default squash commit message from the spec title or a summary of implementation commits
- Clarify the footer policy when an issue is linked
- Make the main branch history readable at a meaningful granularity

## Acceptance Criteria
After finalize-merge, the squash commit is a human-readable change summary rather than a slug.

<details>
<summary>ja</summary>

[ENHANCE] finalize merge: squash commit message を spec title ベースにする

## 背景
squash merge 時の commit message が spec ディレクトリ名由来の slug になりやすく、worktree 側の実装 commit message や spec title より情報量が落ちる。履歴の可読性が低い。

## やりたいこと
- squash commit message の既定値を spec title または実装 commit 要約から組み立てる
- issue 連携がある場合の footer 方針も整理する
- main 側履歴で読める粒度にする

## 完了条件
finalize-merge 後の squash commit が、slug ではなく人が読める変更要約になる。

</details>