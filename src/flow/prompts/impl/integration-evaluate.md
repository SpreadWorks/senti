Use this guidance when the integration phase requires an explicit evaluation of whether the integrated change set is ready for finalize. This step requires user approval.

- Read the context provided by `flow get next-action`: `all_task_summary`, `parent_req` (parent spec requirements), and `full_diff`.
- Compare each parent requirement against the actual diff and per-task summaries. For each requirement:
  - State whether it is fully satisfied by the integrated change set.
  - List the specific files / changes that satisfy it.
  - Flag any requirement that is partially satisfied or not satisfied.
- Summarize unresolved issues from issue-log and decide whether each is a blocker for this integration or deferred.
- Present a concise evaluation to the user using the Choice Format:
  ```
  ──────────────────────────────────────────────────────────
    統合結果を評価しました。次の操作を選択してください。
  ──────────────────────────────────────────────────────────

    [1] 承認する（finalize へ進む）
    [2] 統合に問題があるため修正する
    [3] 評価内容を詳細に確認する
  ```
- **Wait for user approval before advancing.** This step has `requires_approval: true` per the registry.
- **autoApprove transition:** If `autoApprove: true`, treat [1] as selected automatically once the evaluation summary shows all parent requirements are satisfied. If any requirement is unsatisfied, do NOT auto-approve — STOP and return control to the user.
