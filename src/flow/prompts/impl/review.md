   - Step status is automatically managed by `sdd-forge flow run review` hooks (pre sets in_progress, post sets done).
   - Run `sdd-forge flow run review` to perform AI-powered code review.
   - The review generates proposals for code quality improvements. Results are saved to review.md.
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
   - **Retry limit:** Each `sdd-forge flow run review` invocation = 1 attempt (CLI invocation level). The CLI enforces this limit (spec 253). When count >= max, `sdd-forge flow run review` returns `Envelope.fail` with `errors[0].code === 'REVIEW_MAX_ATTEMPTS_EXCEEDED'` and `data === { phase, attempts, max }`.
   - **REVIEW_MAX_ATTEMPTS_EXCEEDED received:** STOP and return control to the user. To recover, the user can run `sdd-forge flow set retry reset review impl --yes` and then resume the review.
