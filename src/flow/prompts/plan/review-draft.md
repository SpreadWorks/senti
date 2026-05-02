   - Run `sdd-forge flow run review --phase draft` to perform AI-powered QA review.
   - The review checks draft.json QA entries against the request/issue for:
     - Shallow or generic questions
     - Missing coverage areas
     - Ambiguous or unsupported answers
   - The review outputs a detection report to draft-review.md. It does NOT modify draft.json.
   - **If verdict=PASS** (NO_PROPOSALS): proceed to approval below.
   - **If verdict=FAIL** (issues detected): read draft-review.md and ask the user additional questions based on the detected gaps. Update draft.json with user-provided answers. Then re-run `sdd-forge flow run review --phase draft`.
   - **Review loop:** repeat detect → fix → re-review until verdict=PASS or the resolved numeric maxAttempts from next-action is reached.
   - **maxAttempts reached:** STOP and return control to the user. Do not set step done and must not present approval or confirmation choices.
   - **Approval (after verdict=PASS):**
     - Present approval choice:
       ```
       ──────────────────────────────────────────────────────────
         ドラフトの承認
       ──────────────────────────────────────────────────────────

         [1] 承認する
         [2] 修正する

       ```
     - If `autoApprove: true`: auto-select [1].
     - On approval: read draft.json, set `approval.approved = true` and `approval.confirmedAt` to the current ISO timestamp, write back to draft.json.
     - On [2]: incorporate user feedback into draft.json, then re-run review from the top.
   - **On complete (approval done):** `sdd-forge flow set step review-draft done`
