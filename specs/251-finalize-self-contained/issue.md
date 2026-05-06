## Purpose
Eliminate the need for steps to get stuck during finalize or for users to manually run `flow set step`.

## Scope
- CLI marks steps as done upon successful completion of finalize-commit / finalize-merge / finalize-sync / finalize-cleanup
- Clarify state authority before and after merge
- Align results of `flow get next-action` with `flow run finalize-*`
- Make the report display path after cleanup easier to handle in the CLI
- Add e2e regression tests for worktree finalize

<details>
<summary>ja</summary>

[BUG] Worktree finalize の自己完結化

## 目的
finalize 中に step が詰まったり、手動で flow set step を実行する必要をなくす。

## 含める内容
- finalize-commit / finalize-merge / finalize-sync / finalize-cleanup 成功時に CLI が step を done にする
- merge 前後で state authority を明確化する
- flow get next-action と flow run finalize-* の結果を一致させる
- cleanup 後の report 表示導線を CLI で扱いやすくする
- worktree finalize の e2e 回帰テストを追加する

</details>