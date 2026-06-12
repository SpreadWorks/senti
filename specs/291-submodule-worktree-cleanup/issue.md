## Target
The worktree removal process in finalize-cleanup for Spec-Driven Development worktree mode.

## Problem
In a worktree that contains initialized submodules, a normal `git worktree remove <path>` fails by Git design with `fatal: working trees containing submodules cannot be moved or removed`. The current implementation does not treat this case as submodule-related, so the worktree and feature branch may remain after cleanup.

## Cause
finalize-cleanup directly runs `git worktree remove <path>` and does not detect rejection caused by initialized submodules, perform a dirty-state preflight check, or retry with a limited `--force`. Since `--force` can also delete dirty and untracked changes, using it unconditionally risks losing unsaved changes.

## Improvement Direction
First try a normal remove. If the failure reason is submodule-related, inspect the dirty state of both the worktree itself and the submodules. Run `git worktree remove --force <path>` only when the worktree can be confirmed clean. If there are dirty changes or the worktree is locked, do not delete it; instead, return an error and recovery guidance appropriate to the cause.

## Reason for Putting This on the Board
For projects that use submodules, finalize reproducibly gets stuck at cleanup every time. However, simply always using `--force` carries a risk of data loss. The safety conditions and test considerations need to be organized before implementation.

<details>
<summary>ja</summary>

[BUG] worktree cleanup で submodule 初期化済み worktree を安全に削除する

## 対象
Spec-Driven Development の worktree mode における finalize-cleanup の worktree 削除処理。

## 問題
初期化済み submodule を含む worktree では、通常の `git worktree remove <path>` が Git 仕様により `fatal: working trees containing submodules cannot be moved or removed` で失敗する。現行実装はこのケースを submodule 起因として扱わず、cleanup 後に worktree と feature branch が残る可能性がある。

## 原因
finalize-cleanup は `git worktree remove <path>` を直接実行しており、submodule 初期化済み worktree の拒否に対する検出、dirty preflight、限定的な `--force` retry がない。`--force` は dirty や untracked も削除できるため、無条件で使うと未保存変更を消すリスクがある。

## 改善方向
まず通常の remove を試し、失敗理由が submodule 起因の場合だけ worktree 本体と submodule 内の dirty 状態を検査する。clean であることを確認できた場合のみ `git worktree remove --force <path>` を実行する。dirty がある場合や locked worktree の場合は削除せず、原因に応じたエラーと復旧案内を返す。

## ボードに置く理由
submodule を使うプロジェクトでは finalize が毎回 cleanup で止まる再現性のある不具合であり、単純な `--force` 常用ではデータ消失リスクがある。実装前に安全条件とテスト観点を整理して扱う必要がある。

</details>