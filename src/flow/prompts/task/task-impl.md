Use this guidance for the per-task implementation step.

- Read the provided task specification, related summary, and overview. Implement only this task's scope, reusing established project patterns.
- Do not run tests in this step. Spec-local execution is centralized in `test-execute` and project regression in `final-regression`.
- Do not call `sennel flow set files`, `set issue-log`, `set step`, or `run update-overview`; workers have no canonical Flow write authority.
- Make source edits only. If a test is wrong or an out-of-scope bug is found, record a typed issue effect instead of changing Flow state.
- Put changed repository-relative paths mapped to their requirement ids, issues, and the required overview additions in the exact `effects.json` schema supplied by the source handoff contract. Set `triage` and `repair` to null. Include every overview category; empty collections are valid.
- Run the exact handoff `sealCommand` once. The parent independently validates the source diff, records canonical effects under the materialized task identity, and completes the step.
