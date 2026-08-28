   <!-- include("/flow/prompts/partials/worker-artifact-handoff.md") -->
   - Classify findings from `draft-coverage-review` before any draft coverage repair work.
   - Read `draft-review-coverage.json` only from the handoff `inputs[].document` snapshot whose `name` is `draft-review-coverage.json`. Treat only its `blockingFindings[]` and `repairTargets[]` as triage input. `advisoryFindings[]` are advisory memory only.
   - Do not edit `draft.json`, spec files, task files, or tests in this step. This step decides what should be repaired; the next `draft-coverage-repair` step performs the edits.
   - Write `draft-coverage-triage.json` only to its exact handoff `payloadPath`.
   - If the immutable input is missing, invalid, or does not match the current phase, stop without writing or sealing. If it is valid and contains no blocking findings or repair targets, write `draft-coverage-triage.json` with an empty `items[]` and a concise `summary`.
   - For every blocking finding or repair target, add one `draft-coverage-triage.json.items[]` entry with:
     - `title`: copied from the finding or target.
     - `target`: copied from the finding or target.
     - `decision`: one of `apply`, `invalid`, `already_resolved`, `downgraded_to_non_blocking`, or `requires_user_decision`.
     - `rationale`: why that decision was made.
     - `evidence`: concrete evidence for the decision, such as a `draft.json` field path, request fact, source/code context, or the reason the finding is non-blocking.
     - For `apply` only, `allowedFieldPaths`: the exact existing draft field paths the repair worker may replace, and `requiredFieldPaths`: the subset needed to resolve this finding. Do not grant a whole object, unrelated fields, or any approval path: approval is owned exclusively by `draft-gate`.
   - Use `apply` only when the item is still valid and can be fixed by a small, directly supported draft change.
   - Use `invalid` when the item concerns approval or another gate-owned mechanical check, contradicts verified context, asks for broader scope, or is not grounded in the draft coverage review criteria. Triage must never use `apply` to set approval automatically.
   - Use `already_resolved` when the current `draft.json` already covers the item.
   - Use `downgraded_to_non_blocking` when the item is useful context but does not block spec writing.
   - Use `requires_user_decision` only when resolving the item would require new user input. This decision blocks draft-gate until draft QA is reopened or answered.
   - `draft-coverage-triage.json` shape:
     ```json
     {
       "version": 1,
       "phase": "draft-coverage-triage",
       "sourceReview": "draft-review-coverage.json",
       "summary": "short summary of triage decisions",
       "items": [
         {
           "title": "copied finding title",
           "target": "copied finding target",
           "decision": "apply",
           "rationale": "why this decision was made",
           "evidence": "draft.json analysis.validation does not name the required verification",
           "allowedFieldPaths": ["analysis.validation"],
           "requiredFieldPaths": ["analysis.validation"]
         }
       ]
     }
     ```
   - Do not run another draft review loop from this step. The downstream `draft-coverage-repair` step applies `decision=apply` items, and draft-gate remains the blocking validation step.
   - **On complete**: run the exact handoff `sealCommand` once.
