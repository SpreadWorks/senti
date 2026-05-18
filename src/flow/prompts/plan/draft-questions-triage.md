   - Classify findings from `review-draft-questions` before any draft repair work.
   - Read `specs/<spec-id>/draft-review-questions.json` first. Treat only `blockingFindings[]` and `repairTargets[]` as triage input. `advisoryFindings[]` are advisory memory only.
   - Do not edit `draft.json`, spec files, task files, or tests in this step. This step decides what should be repaired; the next `draft-questions-repair` step performs the edits.
   - Always write `specs/<spec-id>/draft-questions-triage.json` before completing this step.
   - If `draft-review-questions.json` is missing, invalid, or contains no blocking findings or repair targets, write `draft-questions-triage.json` with an empty `items[]`, a concise `summary`, and run `sdd-forge flow set step draft-questions-triage done`.
   - For every blocking finding or repair target, add one `draft-questions-triage.json.items[]` entry with:
     - `title`: copied from the finding or target.
     - `target`: copied from the finding or target.
     - `decision`: one of `apply`, `invalid`, `already_resolved`, `downgraded_to_non_blocking`, or `requires_user_decision`.
     - `rationale`: why that decision was made.
     - `evidence`: concrete evidence for the decision, such as a `draft.json` field path, request fact, source/code context, or the reason the finding is non-blocking.
   - Use `apply` only when the item is still valid and can be fixed by a small, directly supported draft change.
   - Use `invalid` when the item belongs to gate-owned mechanical checks, contradicts verified context, asks for broader scope, or is not grounded in the draft question review criteria.
   - Use `already_resolved` when the current `draft.json` already covers the item.
   - Use `downgraded_to_non_blocking` when the item is useful context but does not block draft refinement.
   - Use `requires_user_decision` only when resolving the item would require new user input. Do not invent the answer.
   - `draft-questions-triage.json` shape:
     ```json
     {
       "version": 1,
       "phase": "draft-questions-triage",
       "sourceReview": "draft-review-questions.json",
       "summary": "short summary of triage decisions",
       "items": [
         {
           "title": "copied finding title",
           "target": "copied finding target",
           "decision": "apply",
           "rationale": "why this decision was made",
           "evidence": "draft.json qa[0].question is duplicated"
         }
       ]
     }
     ```
   - Do not run another draft review loop from this step. The downstream `draft-questions-repair` step applies `decision=apply` items, and gate-draft remains the blocking validation step.
   - **On complete**: `sdd-forge flow set step draft-questions-triage done`
