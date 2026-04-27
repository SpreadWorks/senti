Use this guidance for the per-task implementation step. Mirrors the flow-level implement step but scoped to the current task.

- Read the context provided by `flow get next-action`: `task_spec`, `related_summary`, and `overview`.
- Implement only what the task spec requires. Do not expand scope to neighboring tasks — those have their own task specs.
- **Test-first reminder:** the test set was already written in the previous task step. Implement code that makes those tests pass. If a test seems wrong, do NOT modify it — surface the issue and adjust the task spec or record an issue-log entry.
- Reuse existing modules and patterns where the task spec or related summary identify them. Avoid premature abstraction.
- Update task-level requirement status as you complete each requirement: `sdd-forge flow set req <index> done`.
- Run the task's tests after implementation to verify:
  ```
  node tests/run.js --filter <task-test-pattern> > <workDir>/logs/task-test.log 2>&1
  ```
- **MUST: If test failures are caused by pre-existing bugs (not the current task's changes)**, record them in issue-log (`sdd-forge flow set issue-log --step task.impl --reason "..."`) before applying a workaround or adjusting the test.
- **Retry limit for test fixes:** If tests do not pass within a reasonable number of fix-and-rerun cycles, STOP and return control to the user.
- **Spec 226: overview contribution is recorded in this step** (the standalone `update-overview` step has been removed). After implementation, invoke `persistOverviewUpdate` from `run-update-overview.js` (spec 207 helper, `applyOverviewAdditions` internally) to append this task's contribution to the parent `spec.json.overview` (modules / data_flow / decisions). The parent `spec.md` is re-rendered deterministically.
- On complete, the next-action CLI advances to `task.run-tests` for the per-task verification run.
