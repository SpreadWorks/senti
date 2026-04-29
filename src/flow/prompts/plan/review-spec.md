   - Step status is automatically managed by `sdd-forge flow run review --phase spec` hooks (pre sets in_progress, post sets done).
   - Present review policy:
     ```
     ──────────────────────────────────────────────────────────
       スペック完全性レビューの方針を選択してください。
     ──────────────────────────────────────────────────────────

       [1] スペックレビューを行い改善を自動で行う
       [2] しない

     ```
     - 2 → `sdd-forge flow set step review-spec skipped` → next step

   **Option 1 (auto-fix):**
   - Run `sdd-forge flow run review --phase spec` to perform AI-powered spec review.
   - The review checks spec.md against the codebase context for:
     - Files or features the spec does not mention
     - Contradictions or gaps between requirements
     - External references that depend on files to be modified
   - **If issues exist**: display review summary and auto-fix spec.md.
   - **If no issues** (NO_PROPOSALS): display "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit:** bounded by the definition's maxAttempts. If exceeded, STOP and return control to the user.
