   - Classify findings from `draft-questions-review` before any draft repair work.
   - Read `draft-review-questions.json` only from the guarded next action's `context.draftReview.artifacts[]` entry whose `name` is `draft-review-questions.json`. This is the immutable snapshot supplied from canonical base-side authority; do not read or trust a same-named worktree file. Treat only its `document.blockingFindings[]` and `document.repairTargets[]` as triage input. `document.advisoryFindings[]` are advisory memory only.
   - Do not edit `draft.json`, spec files, task files, or tests in this step. This step decides what should be repaired; the next `draft-questions-repair` step performs the edits.
   - Write `draft-questions-triage.json` only to the exact absolute path in `context.draftReview.outputArtifact.filePath` before completing this step. That path is the canonical base-side authority. A same-named file under the execution worktree is rejected and is never promoted.
   - If the guarded canonical input is missing, invalid, or does not match the current phase, stop without writing an artifact or completing the step. If it is valid and contains no blocking findings or repair targets, write `draft-questions-triage.json` with an empty `items[]`, a concise `summary`, and run `senti flow set step draft-questions-triage done`.
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
   - Do not run another draft review loop from this step. The downstream `draft-questions-repair` step applies `decision=apply` items, and draft-gate remains the blocking validation step.
   - **On complete**: `senti flow set step draft-questions-triage done`
