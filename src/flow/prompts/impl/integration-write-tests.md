Use this guidance when the integration phase calls for writing cross-task integration tests after multiple tasks have completed their per-task implementation.

- Read the context provided by `flow get next-action`: `all_task_summary` (each task's spec + summary) and `parent_req` (the parent spec's requirements).
- Identify integration scenarios: behavior that emerges only when multiple completed tasks are exercised together (data flow across module boundaries, end-to-end flows, contract verification between cooperating modules).
- Write integration tests that exercise these cross-task scenarios. Tests should fail if any participating task regresses the integration contract.
- Place integration tests under `tests/integration/` (or the project's integration test directory) — these are long-lived contract tests, not spec-local.
- **MUST: Do not reference per-task implementation details while writing integration tests.** Derive scenarios from the parent spec's requirements and each task's spec, not from inspecting task code.
- **Tests should fail initially** if the integration was not yet exercised; passing requires real cross-task wiring to be in place.
- Run the integration tests after writing to confirm they execute (failures expected if integration wiring is incomplete — proceed to integration-run-tests next).
- On complete, the next-action CLI advances to `integration-run-tests`.
