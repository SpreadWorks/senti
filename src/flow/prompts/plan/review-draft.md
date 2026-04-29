   - Step status is automatically managed by `sdd-forge flow run review --phase draft` hooks (pre sets in_progress, post sets done).
   - Present review policy:
     ```
     ──────────────────────────────────────────────────────────
       ドラフト QA レビューの方針を選択してください。
     ──────────────────────────────────────────────────────────

       [1] QA レビューを行い改善を自動で行う
       [2] しない

     ```
     - 2 → `sdd-forge flow set step review-draft skipped` → next step

   **Option 1 (auto-fix):**
   - Run `sdd-forge flow run review --phase draft` to perform AI-powered QA review.
   - The review checks draft.json QA entries against the request/issue for:
     - Shallow or generic questions
     - Missing coverage areas
     - Ambiguous or unsupported answers
   - **If issues exist**: display review summary and auto-fix QA entries in draft.json.
   - **If no issues** (NO_PROPOSALS): display "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit:** bounded by the definition's maxAttempts. If exceeded, STOP and return control to the user.
