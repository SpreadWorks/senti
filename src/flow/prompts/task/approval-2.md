Use this guidance for the second task-level approval point (post-test, pre-impl). The user confirms the test set is acceptable before implementation begins.

- Read the context provided by `flow get next-action`: `task_spec`.
- Summarize the test files written in the previous step: file paths, count by category (unit / integration / acceptance), and a brief one-line description per test.
- Ask using the Choice Format:
  ```
  ──────────────────────────────────────────────────────────
    テストの内容を確認してください。実装に進みますか？
  ──────────────────────────────────────────────────────────

    [1] 実装に進む
    [2] テストを修正する
    [3] その他
  ```
- **autoApprove transition:** If `autoApprove: true`, treat [1] as selected automatically and proceed.
- Do not advance to the impl step until approval is recorded.
