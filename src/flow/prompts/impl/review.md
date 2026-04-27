   - Step status is automatically managed by `sdd-forge flow run review` hooks (pre sets in_progress, post sets done).
   - Present review policy:
     ```
     ──────────────────────────────────────────────────────────
       コードレビューの方針を選択してください。
     ──────────────────────────────────────────────────────────

       [1] コードレビューを行い改善を自動で行う
       [2] コードレビューのみ
       [3] しない

     ```
     - 3 → `sdd-forge flow set step review skipped` → Step 3

   **Option 1 (auto-fix):**
   - Run `sdd-forge flow run review` to perform AI-powered code review.
   - **If proposals exist** (APPROVED items in review.md):
     1. Display review summary:
        ```
        コードレビューの結果、N 件の修正案が見つかりました。
        うち N 件を適用すべきと判断しました。

        適用する修正案:
          #2: <title>
              問題: <なぜこれが問題なのか>
              修正: <どう修正するか>

        対応不要と判断:
          #1: <title>
              理由: <対応不要な理由>
        ```
     2. Apply approved fixes automatically.
     3. Re-run tests to confirm no regressions.
   - **If no proposals** (NO_PROPOSALS):
     - Display: "レビューの結果、修正の必要はありませんでした。"
   - **Retry limit:** If review keeps producing new proposals beyond the definition's maxAttempts limit, STOP and return control to the user.
   - Proceed to Step 3.

   **Option 2 (review-only):**
   - Run `sdd-forge flow run review` to get all proposals.
   - Present each proposal **one at a time** with `(n/N)` progress display.
   - For each proposal, show concisely:
     - Problem
     - Proposed fix
     - Whether it is needed for this spec
   - End each proposal with a question:
     ```
     ──────────────────────────────────────────────────────────
       (n/N) この指摘に対する対応を選択してください。
     ──────────────────────────────────────────────────────────

       [1] 適用する
       [2] 適用しない
       [3] 修正方針を変える

     ```
   - **Do NOT apply fixes yet** — collect all user responses first.
   - After all proposals are reviewed, apply only the approved ones in bulk.
   - Re-run tests to confirm no regressions.
   - Proceed to Step 3.
