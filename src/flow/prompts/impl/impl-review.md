   - Step status is automatically managed by `senti flow run review` hooks (pre sets in_progress, post sets done).
   - Run `senti flow run review` to perform AI-powered code review.
   - Responsibility boundary: this step records detection output only. It does not make triage disposition, perform repair mutation/audit, or perform gate validation.
   - Downstream ownership: triage steps accept/reject findings, repair steps mutate/audit accepted findings, and gate steps mechanically validate readiness.
   - The review writes `review.md` and `impl-review.json`.
   - Blocking findings are limited to exactly these failure modes:
     - `missing_acceptance_requirement`
     - `spec_behavior_contradiction`
     - `security_or_data_integrity_bug`
   - Non-blocking improvements are optional and do not block progress. They should exist only when they name a touched file, describe an observable issue in that file, and provide a replacement action that names the affected function, branch, assertion, prompt sentence, or artifact field.
   - Regression failures, test false positives, scope creep, project-rule violations, naming proposals, refactor proposals, DRY proposals, comment proposals, and docs proposals are non-blocking or out of scope for impl review blocking findings.
   - If a proposal concerns an intentional guardrail exception and the applicable guardrail article permits acknowledged exceptions, remediate by recording the guardrail id in `spec.json.constraints[]`, `clarifications[].q` / `.a`, or `alternatives_considered[].option` / `.reason`. Do not use `design_principles`, approval notes, overview entries, task text, or review notes as exception acknowledgments.
   - **If `impl-review.json.verdict` is `FAIL`**:
     1. Read `impl-review.json` and `review.md`.
     2. Address only `blockingFindings[]`.
     3. Do not treat `nonBlockingImprovements[]` as mandatory repair work.
     4. **Do NOT re-run tests here.** When code changes are applied during review, the dispatcher resets downstream execution and reruns it through the single execution point.
   - **If verdict is `PASS` or `ADVISORY`**:
     - Display: "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit:** Each `senti flow run review` invocation = 1 attempt (CLI invocation level). The CLI enforces this flow-scope limit (spec 253). When count >= max, `senti flow run review` returns `Envelope.fail` with `errors[0].code === 'REVIEW_MAX_ATTEMPTS_EXCEEDED'` and `data` containing `{ phase, attempts, max, recoveryCommand }`.
   - **REVIEW_MAX_ATTEMPTS_EXCEEDED received:** STOP and return control to the user. To recover after changed evidence, use `senti flow set retry reset <gate|review> <phase> --reason <text> --yes`; for this impl review phase, run `senti flow set retry reset review impl --reason <text> --yes` and then run one re-review attempt.
   - Recovery reason is required, records an audit entry, grants one re-evaluation, and rejects unchanged evidence.
   - **Provider/input-size recovery:** provider quota, rate limit, API error, and input size failures do not consume `reviewRetry`. Use the structured recovery command from `next-action` or `status` instead of parsing raw stderr.
   - **issue-log policy:** Do not add issue-log entries solely for ordinary provider or input size failures. Record issue-log only when a workaround is applied, a specification decision changes, or manual recovery remains unresolved.
