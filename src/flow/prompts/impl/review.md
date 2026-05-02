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
     5. Re-run tests to confirm no regressions.
   - **If no proposals** (NO_PROPOSALS):
     - Display: "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit:** If review keeps producing new proposals beyond the resolved numeric maxAttempts from next-action, STOP and return control to the user.
