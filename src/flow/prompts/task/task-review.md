Use this guidance for the per-task code review step. It is scoped to the current task's canonical source surface.

- Read the context provided by `flow get next-action`: `task_spec`, mapped requirements, and the selected current source files. Do not use a repository-wide diff or a task-local test log.
- Step status is automatically managed by `sennel flow run review` hooks (pre sets in_progress, post sets done).
- Run `sennel flow run review` to perform AI-powered code review scoped to this task's surface.
- The task-scoped review uses the same typed disposition contract as flow-level impl review: every finding has a stable lowercase `findingKey`, `must-fix`, `informational`, or `deferred`, a non-empty rationale, and a stable fingerprint recorded by the implementation.
- The disposition is governed by requirement and guardrail evidence, not a fixed category allowlist. Maintainability, naming, refactor, DRY, project-rule, comment, or docs findings are `must-fix` when tied to a mandatory requirement or blocking guardrail; otherwise they are `informational`.
- Informational findings never enter the repair loop. During each invocation, Review repairs only its own reported `must-fix` findings; the next invocation re-reviews the current Task source.
- Reuse the previous `findingKey` for the same problem even when wording changes; use a distinct key for a different problem tied to the same requirement or guardrail.
- Findings should name a touched file when file-specific and provide a replacement action that names the affected function, branch, assertion, prompt sentence, or artifact field.
- If a proposal concerns an intentional guardrail exception and the applicable guardrail article permits acknowledged exceptions, remediate by recording the guardrail id in `spec.json.constraints[]`, `clarifications[].q` / `.a`, or `alternatives_considered[].option` / `.reason`. Do not use task text, overview entries, approval notes, or review notes as exception acknowledgments.
- **If `impl-review.json.verdict` is `REJECTED`**:
  1. Read `impl-review.json` and `review.md`.
  2. Address only findings whose typed disposition is `must-fix` against the task spec and design intent.
  3. Do not treat `informational` or `deferred` findings as mandatory repair work.
  4. **Do NOT re-run tests here.** Spec-local execution belongs to the spec-level `test-execute` step and full project regression belongs to `final-regression` (TASK_DEFINITION does not run tests).
  5. Record repair evidence with `sennel flow set issue-log --step task-review --normalized-finding-id <findingId> --repair-ref-file <path> --task-id <taskId> --reason <text>`. A requirement/guardrail must-fix finding cannot pass `task-gate` without an exact finding id, task scope, and repair reference.
- **If verdict is `PASS` or `ADVISORY`**: Display "レビューの結果、修正の必要はありませんでした。"
- **Retry limit:** Each `sennel flow run review` invocation = 1 attempt (CLI invocation level). The CLI enforces the task-scope `maxAttempts` from `TASK_DEFINITION`.
- **Fourth Review behavior:** Correct the fourth Review's `must-fix` findings in that invocation, persist the finding and source-mutation fingerprints, and continue to `task-gate` without a fifth Review. Review findings are never passed to Gate repair and are not deferred to Acceptance.
- **Recovery:** Use `review` for review recovery and `gate` for gate recovery: `sennel flow set retry reset <gate|review> <phase> --reason <text> --yes`. The reason is required and audited, one re-evaluation is granted, and unchanged evidence is rejected.
- On complete, the next-action CLI advances to `task-gate`.
   - Use the resolved numeric maxAttempts from the next-action envelope as this stage's semantic review limit.
