   <!-- include("/flow/prompts/partials/worker-artifact-handoff.md") -->
   - Classify the blocking findings from `spec-review` before any spec repair work.
   - Read `spec.json` and `spec-review.json` only from their handoff `inputs[].document` snapshots. Treat only review `blockingFindings[]` as triage input. `nonBlockingImprovements[]` are advisory memory only.
   - Do not edit `spec.json`, `spec.md`, task files, or tests in this step. This step decides what should be repaired; the next `spec-repair` step performs the edits.
   - Write `spec-triage.json` only to its exact handoff `payloadPath`.
   - If an immutable input is missing or invalid, stop without writing or sealing. If `spec-review.json` contains no blocking findings, write `spec-triage.json` with an empty `items[]` and a concise `summary`.
   - For every `blockingFindings[]` entry, add one `spec-triage.json.items[]` entry with:
     - `title`: copied from the finding.
     - `target`: copied from the finding.
     - `decision`: one of `apply`, `invalid`, `already_resolved`, or `downgraded_to_non_blocking`.
     - `rationale`: why that decision was made.
     - `evidence`: concrete evidence for the decision, such as a `spec.json` field path, draft/request fact, source/code context, or the reason the finding is non-blocking.
   - Use `apply` only when the finding is still blocking and can be fixed by a small, directly supported spec change.
   - Use `invalid` when the finding belongs to gate-owned mechanical checks, contradicts verified context, asks for broader scope, or is not grounded in the review's blocking criteria.
   - Use `already_resolved` when the current `spec.json` already covers the finding.
   - Use `downgraded_to_non_blocking` when the finding is useful context but does not block implementation, testing, safety, or compatibility.
   - Do not defer review findings to gate. If the finding is really about schema/required fields, unresolved markers, tasks structure, or guardrail compliance, mark it `invalid` because `spec-review` reported a gate-owned issue outside its responsibility.
   - `spec-triage.json` shape:
     ```json
     {
       "version": 1,
       "phase": "spec-triage",
       "sourceReview": "spec-review.json",
       "summary": "short summary of triage decisions",
       "items": [
         {
           "title": "copied finding title",
           "target": "copied finding target",
           "decision": "apply",
           "rationale": "why this decision was made",
           "evidence": "spec.json requirements[0].desc lacks the helper named by the finding"
         }
       ]
     }
     ```
   - Do not run another `spec-review` loop from this step. The downstream `spec-repair` step applies `decision=apply` items, and `spec-gate` remains the blocking validation step.
   - **On complete**: run the exact handoff `sealCommand` once.
