Use this guidance for the first task-level approval point. The task spec must be reviewed by the user before per-task implementation begins.

- Read the context provided by `flow get next-action`: `task_spec`.
- Present the task spec to the user (full text — the gate has already passed at this point).
- Ask using the Choice Format:
  ```
  ──────────────────────────────────────────────────────────
    タスク仕様を承認してください。
  ──────────────────────────────────────────────────────────

    [1] 承認する
    [2] 修正する
    [3] その他
  ```
- Update the task spec's `## User Confirmation` section with `- [x] User approved this task spec` and the confirmation date on approval.
- **autoApprove transition:** If `autoApprove: true`, treat [1] as selected automatically and proceed.
- Do not advance to the next task step until approval is recorded.
