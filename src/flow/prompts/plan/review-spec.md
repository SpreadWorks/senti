   - Step status is automatically managed by `sdd-forge flow run review --phase spec` hooks (pre sets in_progress, post sets done).
   - Present review policy:
     ```
     ──────────────────────────────────────────────────────────
       スペック完全性レビューの方針を選択してください。
     ──────────────────────────────────────────────────────────

       [1] スペックレビューを行う（propose→validate）
       [2] しない

     ```
     - 2 → `sdd-forge flow set step review-spec skipped` → next step

   **Option 1 (propose→validate):**
   - Run `sdd-forge flow run review --phase spec` to perform AI-powered spec review.
   - The review uses a 2-step propose→validate pipeline:
     1. **Propose:** AI identifies oversights in the spec (files not mentioned, contradictions, missing external references)
     2. **Validate:** A separate AI agent judges each proposal as APPROVED or REJECTED
   - Results are saved to spec-review.md with APPROVED proposals listed with title, target section, and suggested change.
   - The review does NOT modify spec.md or spec.json directly.
   - **If APPROVED proposals exist**: read spec-review.md and reflect the approved changes into the spec. The skill-side AI performs the actual edits.
   - **If no proposals or all rejected**: display "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit:** bounded by the definition's maxAttempts. If exceeded, STOP and return control to the user.
