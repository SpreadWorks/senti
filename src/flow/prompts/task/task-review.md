Use this guidance for the per-task code review step. Mirrors the flow-level review step but scoped to the current task's diff.

- Read the context provided by `flow get next-action`: `task_spec`, `diff` (task-scoped), and `testlog`.
- Step status is automatically managed by `senti flow run review` hooks (pre sets in_progress, post sets done).
- Run `senti flow run review` to perform AI-powered code review scoped to this task's surface.
- The task-scoped review uses the same typed disposition contract as flow-level impl review: every finding has a stable lowercase `findingKey`, `must-fix`, `informational`, or `deferred`, a non-empty rationale, and a stable fingerprint recorded by the implementation.
- The disposition is governed by requirement and guardrail evidence, not a fixed category allowlist. Maintainability, naming, refactor, DRY, project-rule, comment, or docs findings are `must-fix` when tied to a mandatory requirement or blocking guardrail; otherwise they are `informational`.
- Informational and deferred findings never enter the repair loop. Repeated reports with the same fingerprint are aggregated, and the retry bound produces an explicit deferred outcome.
- Reuse the previous `findingKey` for the same problem even when wording changes; use a distinct key for a different problem tied to the same requirement or guardrail.
- Findings should name a touched file when file-specific and provide a replacement action that names the affected function, branch, assertion, prompt sentence, or artifact field.
- If a proposal concerns an intentional guardrail exception and the applicable guardrail article permits acknowledged exceptions, remediate by recording the guardrail id in `spec.json.constraints[]`, `clarifications[].q` / `.a`, or `alternatives_considered[].option` / `.reason`. Do not use task text, overview entries, approval notes, or review notes as exception acknowledgments.
- **If `impl-review.json.verdict` is `FAIL`**:
  1. Read `impl-review.json` and `review.md`.
  2. Address only findings whose typed disposition is `must-fix` against the task spec and design intent.
  3. Do not treat `informational` or `deferred` findings as mandatory repair work.
  4. **Do NOT re-run tests here.** Spec-local execution belongs to the spec-level `test-execute` step and full project regression belongs to `final-regression` (TASK_DEFINITION does not run tests).
  5. Record repair evidence with `senti flow set issue-log --step task-review --normalized-finding-id <findingId> --repair-ref-file <path> --task-id <taskId> --reason <text>`. A requirement/guardrail must-fix finding cannot pass `task-gate` without an exact finding id, task scope, and repair reference.
- **If verdict is `PASS` or `ADVISORY`**: Display "レビューの結果、修正の必要はありませんでした。"
- **Retry limit:** Each `senti flow run review` invocation = 1 attempt (CLI invocation level). The CLI enforces the task-scope `maxAttempts` from `TASK_DEFINITION`.
- **Exceeded behavior:** At the task retry bound, repeated findings are grouped by their task-scoped fingerprint, written to `flow-findings.json` with an explicit deferred disposition, and handed to `acceptance-review` without another repair cycle.
- **Recovery:** Use `review` for review recovery and `gate` for gate recovery: `senti flow set retry reset <gate|review> <phase> --reason <text> --yes`. The reason is required and audited, one re-evaluation is granted, and unchanged evidence is rejected.
- On complete, the next-action CLI advances to `task-gate`.
   - Use the resolved numeric maxAttempts from the next-action envelope as this stage's semantic review limit.
