Use this guidance for the per-task implementation step. Mirrors the flow-level implement step but scoped to the current task.

- Read the context provided by `flow get next-action`: `task_spec`, `related_summary`, and `overview`.
- If guardrail articles have NOT been loaded in this session: `sennel flow get guardrail task-impl`. If output is non-empty, follow these principles. Skip if already present in context.
- Implement only what the task spec requires. Do not expand scope to neighboring tasks — those have their own task specs.
- **Test-first reminder:** the test set was already written in the previous task step. Implement code that makes those tests pass. If a test seems wrong, do NOT modify it — surface the issue and adjust the task spec or record an issue-log entry.
- Reuse existing modules and patterns where the task spec or related summary identify them. Avoid premature abstraction.
- If guardrail articles have not been loaded for this task implementation, use `sennel flow get guardrail task-impl`. The alias `impl` resolves to `task-impl`, but task prompts should use the canonical phase name.
- Update task-level requirement status as you complete each requirement: `sennel flow set req <reqId> done` (for example `R1`). Numeric values are still accepted as 0-based indexes when needed.
- **Do NOT run tests in this step.** Spec-local execution is centralized in the spec-level `test-execute` step, and full project regression runs in `final-regression`. Per-task test execution has been removed (spec 251 single-execution-point rule).
- **MUST: If implementation reveals a pre-existing bug outside the task's scope**, record it in issue-log (`sennel flow set issue-log --step task.impl --reason "..."`) before adjusting the task spec or applying a workaround.
- **Overview contribution is recorded in this step** (there is no standalone task step). After implementation, read the current payload schema with `sennel flow run update-overview --help`, then run `sennel flow run update-overview --json '<additions>'` with the exact target guards from `next-action`. Supply every required category and use an empty collection when this task has no contribution for one. The command publishes the contribution through the canonical Version Store and stamps the current task id.
- On complete, the dispatcher returns to the spec-level implementation flow. Spec-local execution remains centralized in `test-execute`.
