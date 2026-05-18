   - Step status is automatically managed by `sdd-forge flow run review` hooks (pre sets in_progress, post sets done).
   - Run `sdd-forge flow run review` to perform AI-powered code review.
   - Responsibility boundary: this step records detection output only. It does not make triage disposition, perform repair mutation/audit, or perform gate validation.
   - Downstream ownership: triage steps accept/reject findings, repair steps mutate/audit accepted findings, and gate steps mechanically validate readiness.
   - The review generates proposals for code quality improvements. Results are saved to review.md.
   - If a proposal concerns an intentional guardrail exception and the applicable guardrail article permits acknowledged exceptions, remediate by recording the guardrail id in `spec.json.constraints[]`, `clarifications[].q` / `.a`, or `alternatives_considered[].option` / `.reason`. Do not use `design_principles`, approval notes, overview entries, task text, or review notes as exception acknowledgments.
   - **If proposals exist** (proposals in review.md):
     1. Read review.md and evaluate each proposal against the spec requirements and design intent.
     2. For each proposal, determine:
        - Does it improve code quality?
        - Does it risk breaking existing behavior?
        - Is it within the spec's scope?
     3. Display review summary:
        ```
        コードレビューの結果、N 件の修正案が見つかりました。

        適用する修正案:
          #2: <title>
              問題: <なぜこれが問題なのか>
              修正: <どう修正するか>

        対応不要と判断:
          #1: <title>
              理由: <対応不要な理由>
        ```
     4. Apply the proposals you judged to be valid.
     5. **Do NOT re-run tests here.** When code changes are applied during review, the dispatcher resets the downstream `test-execute` / `test-result-review` / `gate-impl` / `retro` steps and reruns them through the single execution point.
   - **If no proposals** (NO_PROPOSALS):
     - Display: "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit:** Each `sdd-forge flow run review` invocation = 1 attempt (CLI invocation level). The CLI enforces this flow-scope limit (spec 253). When count >= max, `sdd-forge flow run review` returns `Envelope.fail` with `errors[0].code === 'REVIEW_MAX_ATTEMPTS_EXCEEDED'` and `data` containing `{ phase, attempts, max, recoveryCommand }`.
   - **REVIEW_MAX_ATTEMPTS_EXCEEDED received:** STOP and return control to the user. To recover, the general form is `sdd-forge flow set retry reset review <phase> --yes`; for this impl review phase, run `sdd-forge flow set retry reset review impl --yes` and then resume the review.
   - **Provider/input-size recovery:** provider quota, rate limit, API error, and input size failures do not consume `reviewRetry`. Use the structured recovery command from `next-action` or `status` instead of parsing raw stderr.
   - **issue-log policy:** Do not add issue-log entries solely for ordinary provider or input size failures. Record issue-log only when a workaround is applied, a specification decision changes, or manual recovery remains unresolved.
