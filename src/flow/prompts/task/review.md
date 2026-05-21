Use this guidance for the per-task code review step. Mirrors the flow-level review step but scoped to the current task's diff.

- Read the context provided by `flow get next-action`: `task_spec`, `diff` (task-scoped), and `testlog`.
- Step status is automatically managed by `sdd-forge flow run review` hooks (pre sets in_progress, post sets done).
- Run `sdd-forge flow run review` to perform AI-powered code review scoped to this task's surface.
- The task-scoped review uses the same structured contract as flow-level impl review: `blockingFindings[]` and `nonBlockingImprovements[]`.
- Blocking findings are limited to exactly:
  - `missing_acceptance_requirement`
  - `spec_behavior_contradiction`
  - `security_or_data_integrity_bug`
- Non-blocking improvements are optional and do not block progress. They should exist only when they name a touched file, describe an observable issue in that file, and provide a replacement action that names the affected function, branch, assertion, prompt sentence, or artifact field.
- Regression failures, test false positives, scope creep, project-rule violations, naming proposals, refactor proposals, DRY proposals, comment proposals, and docs proposals are non-blocking or out of scope for task review blocking findings.
- If a proposal concerns an intentional guardrail exception and the applicable guardrail article permits acknowledged exceptions, remediate by recording the guardrail id in `spec.json.constraints[]`, `clarifications[].q` / `.a`, or `alternatives_considered[].option` / `.reason`. Do not use task text, overview entries, approval notes, or review notes as exception acknowledgments.
- **If `impl-review.json.verdict` is `FAIL`**:
  1. Read `impl-review.json` and `review.md`.
  2. Address only `blockingFindings[]` against the task spec and design intent.
  3. Do not treat `nonBlockingImprovements[]` as mandatory repair work.
  4. **Do NOT re-run tests here.** Spec-local execution belongs to the spec-level `test-execute` step and full project regression belongs to `final-regression` (TASK_DEFINITION does not run tests).
- **If verdict is `PASS` or `ADVISORY`**: Display "レビューの結果、修正の必要はありませんでした。"
- **Retry limit:** Each `sdd-forge flow run review` invocation = 1 attempt (CLI invocation level). The CLI enforces this limit (spec 253) for flow-scope reviews; task-scope reviews are not currently CLI-enforced, but the AI must still respect the task-scope soft limit from next-action maxAttempts. The current TASK_DEFINITION default is 1.
- **Exceeded behavior:** If `Envelope.fail` with `errors[0].code === 'REVIEW_MAX_ATTEMPTS_EXCEEDED'` is returned, STOP and return control to the user.
- **Recovery:** Use `review` for review recovery and `gate` for gate recovery: `sdd-forge flow set retry reset <gate|review> <phase> --reason <text> --yes`. The reason is required and audited, one re-evaluation is granted, and unchanged evidence is rejected.
- On complete, the next-action CLI advances to `gate-impl`.
