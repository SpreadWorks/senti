   - Step status is automatically managed by `senti flow run review` hooks (pre sets in_progress, post sets done).
   - Run `senti flow run review` to perform AI-powered code review.
   - Responsibility boundary: this step records detection output and applies the typed finding-disposition policy. It does not perform repair mutation/audit or gate validation.
   - Downstream ownership: repair steps mutate/audit must-fix findings, and gate steps mechanically validate readiness and matching repair evidence.
   - The review writes `review.md` and `impl-review.json`.
   - Every finding must have a stable lowercase `findingKey`, a typed disposition (`must-fix`, `informational`, or `deferred`), a non-empty rationale, and a stable fingerprint recorded by the implementation.
   - The disposition is governed by requirement and guardrail evidence, not by a fixed category allowlist. A maintainability, naming, refactor, DRY, project-rule, comment, or docs finding is `must-fix` when it is tied to a mandatory requirement or blocking guardrail; otherwise it is `informational`.
   - Informational and deferred findings never enter the repair loop. Must-fix findings are the only repair targets.
   - Repeated reports with the same fingerprint are one finding. At the retry bound the policy records an explicit deferred outcome instead of starting another repair cycle.
   - Reuse the previous `findingKey` for the same problem even when wording changes; use a distinct key for a different problem tied to the same requirement or guardrail.
   - Findings should name a touched file when file-specific and provide a replacement action that names the affected function, branch, assertion, prompt sentence, or artifact field.
   - If a proposal concerns an intentional guardrail exception and the applicable guardrail article permits acknowledged exceptions, remediate by recording the guardrail id in `spec.json.constraints[]`, `clarifications[].q` / `.a`, or `alternatives_considered[].option` / `.reason`. Do not use `design_principles`, approval notes, overview entries, task text, or review notes as exception acknowledgments.
   - **If `impl-review.json.verdict` is `REJECTED`**:
     1. Read `impl-review.json` and `review.md`.
     2. Continue to `impl-triage`; do not repair directly from the review step.
     3. Apply only findings whose typed disposition is `must-fix` through the triage artifact.
     4. Reject `informational` and `deferred` findings from mandatory repair work.
     5. **Do NOT re-run tests here.** Completed `impl-repair` returns to the single `test-execute` execution point.
   - **If verdict is `PASS` or `ADVISORY`**:
     - `impl-triage` and `impl-repair` are marked complete without an interactive repair.
     - Display: "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit:** Each `senti flow run review` invocation = 1 attempt (CLI invocation level). The CLI enforces this flow-scope limit (spec 253).
   - At semantic retry exhaustion, unresolved findings are grouped by fingerprint, recorded in `flow-findings.json` with an explicit deferred disposition, and the review step completes without another repair cycle. `acceptance-review` owns final disposition before final-regression.
   - Non-semantic failures such as tooling, parser, malformed artifact, or schema failures are not deferred. Recover them with changed evidence and a retry reset before re-review.
   - Recovery reason is required, records an audit entry, grants one re-evaluation, and rejects unchanged evidence.
   - **Provider/input-size recovery:** provider quota, rate limit, API error, and input size failures do not consume `reviewRetry`. Use the structured recovery command from `next-action` or `status` instead of parsing raw stderr.
   - **issue-log policy:** Do not add issue-log entries solely for ordinary provider or input size failures. Record issue-log only when a workaround is applied, a specification decision changes, or manual recovery remains unresolved.
   - Use the resolved numeric maxAttempts from the next-action envelope as this stage's semantic review limit.
