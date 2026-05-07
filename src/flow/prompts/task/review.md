Use this guidance for the per-task code review step. Mirrors the flow-level review step but scoped to the current task's diff.

- Read the context provided by `flow get next-action`: `task_spec`, `diff` (task-scoped), and `testlog`.
- Step status is automatically managed by `sdd-forge flow run review` hooks (pre sets in_progress, post sets done).
- Run `sdd-forge flow run review` to perform AI-powered code review scoped to this task's surface.
- **If proposals exist** (proposals in review.md):
  1. Read review.md and evaluate each proposal against the task spec and design intent.
  2. For each proposal, determine whether it improves quality, risks breakage, and is within scope.
  3. Display review summary listing proposals you will apply (problem + fix) and proposals you will skip (with reasoning).
  4. Apply the proposals you judged to be valid.
  5. **Do NOT re-run tests here.** Test execution belongs to the spec-level `test-execute` step (TASK_DEFINITION does not run tests).
- **If no proposals** (NO_PROPOSALS): Display "レビューの結果、修正の必要はありませんでした。"
- **Retry limit:** If review keeps producing new proposals beyond the resolved numeric maxAttempts from next-action, STOP and return control to the user.
- On complete, the next-action CLI advances to `gate-impl`.
