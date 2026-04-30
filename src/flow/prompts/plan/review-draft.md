   - Step status is automatically managed by `sdd-forge flow run review --phase draft` hooks (pre sets in_progress, post sets done).
   - Present review policy:
     ```
     ──────────────────────────────────────────────────────────
       ドラフト QA レビューの方針を選択してください。
     ──────────────────────────────────────────────────────────

       [1] QA レビューを行い不足を検出する
       [2] しない

     ```
     - 2 → `sdd-forge flow set step review-draft skipped` → next step

   **Option 1 (detection-only):**
   - Run `sdd-forge flow run review --phase draft` to perform AI-powered QA review.
   - The review checks draft.json QA entries against the request/issue for:
     - Shallow or generic questions
     - Missing coverage areas
     - Ambiguous or unsupported answers
   - The review outputs a detection report to draft-review.md. It does NOT modify draft.json.
   - **If issues exist**: read draft-review.md and ask the user additional questions based on the detected gaps. Update draft.json with user-provided answers.
   - **If no issues** (NO_PROPOSALS): display "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit:** bounded by the definition's maxAttempts. If exceeded, STOP and return control to the user.
