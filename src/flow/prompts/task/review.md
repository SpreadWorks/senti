Use this guidance for the per-task code review step. Mirrors the flow-level review step but scoped to the current task's diff.

- Read the context provided by `flow get next-action`: `task_spec`, `diff` (task-scoped), and `testlog`.
- Step status is automatically managed by `sdd-forge flow run review` hooks (pre sets in_progress, post sets done).
- Run `sdd-forge flow run review --phase task` to perform AI-powered code review scoped to this task's surface.
- **If proposals exist** (APPROVED items in review.md):
  1. Display review summary listing approved proposals (problem + fix) and not-needed proposals (with reasoning).
  2. Apply approved fixes automatically.
  3. Re-run the task tests to confirm no regressions.
- **If no proposals** (NO_PROPOSALS): Display "レビューの結果、修正の必要はありませんでした。"
- **Retry limit: 3 rounds.** If review keeps producing new proposals after 3 review-fix-review cycles, STOP and return control to the user.
- On complete, the next-action CLI advances to `task.update-overview`.
