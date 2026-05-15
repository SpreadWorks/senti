   - Repair the existing spec after `review-spec` reports blocking findings.
   - Read `specs/<spec-id>/spec-review.json` first. Treat `blockingFindings[]` as the repair input. `nonBlockingImprovements[]` are advisory memory only and must not drive rewrites.
   - Always write `specs/<spec-id>/spec-repair.json` before completing this step. This file is the audit log for the AI's apply/drop decisions on review findings.
   - If `spec-review.json` is missing, invalid, or contains no blocking findings, do not rewrite the spec. Write `spec-repair.json` with an empty `items[]`, a concise `summary`, and run `sdd-forge flow set step spec-repair done`.
   - Apply the blocking findings once. Update `spec.json` so each valid blocking finding is resolved in the smallest appropriate field: `requirements`, `acceptance_criteria`, `scope`, `constraints`, `clarifications`, `alternatives_considered`, `overview.decisions`, or `tasks`.
   - Do not broaden scope just to satisfy a review comment. If a finding is invalid, already resolved, only non-blocking after inspection, or actually belongs to gate-owned mechanical checks, record that rationale in `spec-repair.json` instead of expanding the spec.
   - Preserve existing user-approved decisions and draft-derived policy. If a blocking fix would reverse a user decision, reject a draft requirement, or add a new requirement not supported by the draft/request/source, ask the user via Choice Format before writing it.
   - For every `blockingFindings[]` entry, add one `spec-repair.json.items[]` entry with:
     - `title`: copied from the finding.
     - `target`: copied from the finding.
     - `decision`: one of `applied`, `invalid`, `already_resolved`, or `downgraded_to_non_blocking`.
     - `rationale`: why that decision was made.
     - `evidence`: concrete evidence for the decision, such as the `spec.json` field path now covering it, the source/code context that disproves it, or the reason it is non-blocking.
     - `changedFields`: array of `spec.json` field paths changed for this finding; empty when no spec field changed.
   - Do not defer review findings to gate. If the finding is really about schema/required fields, unresolved markers, tasks structure, or guardrail compliance, mark it `invalid` because `review-spec` reported a gate-owned issue outside its responsibility.
   - `spec-repair.json` shape:
     ```json
     {
       "version": 1,
       "phase": "spec-repair",
       "sourceReview": "spec-review.json",
       "summary": "short summary of repair decisions",
       "items": [
         {
           "title": "copied finding title",
           "target": "copied finding target",
           "decision": "applied",
           "rationale": "why this decision was made",
           "evidence": "spec.json requirements[0].desc now names the required helper",
           "changedFields": ["requirements[0].desc"]
         }
       ]
     }
     ```
   - Do not run another `review-spec` loop from this step. The downstream `gate` step remains the blocking validation step.
   - Do not render or edit `spec.md` in this step. The approval prompt renders the human-readable `spec.md` view from the repaired `spec.json`.
   - **On complete**: `sdd-forge flow set step spec-repair done`
