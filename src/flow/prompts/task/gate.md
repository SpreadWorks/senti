Use this guidance when the task workflow requires a gate check. Mirrors the flow-level gate but scoped to the current task.

- Run `sdd-forge flow run gate --phase task-impl` (step status is automatically managed by hooks: pre sets task gate to in_progress, post sets done on PASS).
- Checks the task spec's requirements against `git diff baseBranch...HEAD` filtered to this task's surface, plus guardrail compliance via AI.
- If FAIL (`data.result === "fail"`): show ALL failures from `data.artifacts.reasons`. Fix using only the failure reasons and the diff — do NOT re-read the full task spec, context, or guardrail. Re-run gate.
- **Retry limit: 5 attempts.** If gate does not PASS after 5 fix-and-rerun cycles, STOP and return control to the user.
- Do not proceed until PASS (`data.result === "pass"`).
