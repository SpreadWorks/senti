   - Step status is automatically managed by `sdd-forge flow run review --phase test` hooks (pre sets in_progress, post sets done).
   - Present review policy:
     ```
     ──────────────────────────────────────────────────────────
       テスト網羅性レビューの方針を選択してください。
     ──────────────────────────────────────────────────────────

       [1] テストレビューを行い改善を自動で行う
       [2] しない

     ```
     - 2 → `sdd-forge flow set step review-test skipped` → next step

   **Option 1 (auto-fix):**
   - Run `sdd-forge flow run review --phase test` to perform AI-powered test review.
   - The review generates a test design from spec requirements, compares against actual test code, and identifies gaps.
   - **If gaps exist**: display review summary and auto-fix test files.
   - **If no gaps** (NO_GAPS): display "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit:** bounded by the definition's maxAttempts. If exceeded, STOP and return control to the user.
