   <!-- include("/flow/prompts/partials/worker-artifact-handoff.md") -->
   - Repair the existing spec after `spec-triage` classifies blocking review findings.
   - Read `spec.json`, `spec-review.json`, and `spec-triage.json` only from their handoff `inputs[].document` snapshots. Treat only triage `items[]` entries with `decision: "apply"` as the repair input.
   - Do not re-triage review findings in this step. Do not decide that an `apply` item is invalid, already resolved, or non-blocking; if the triage artifact is wrong or missing, stop and surface that artifact problem instead of silently changing the decision.
   - Write `spec-repair.json` and the complete resulting `spec.json` only to their exact handoff `payloadPath` values. The repair artifact is the audit log for actual spec mutations applied from triage decisions.
   - If an immutable input is missing or invalid, stop without writing or sealing. If `spec-triage.json` contains no `decision: "apply"` items, preserve the spec snapshot unchanged in the declared `spec.json` payload and write `spec-repair.json` with an empty `items[]` and a concise `summary`.
   - Apply the triaged findings once. Update `spec.json` so each `decision: "apply"` item is resolved in the smallest appropriate field: `requirements`, `acceptance_criteria`, `scope`, `constraints`, `clarifications`, `alternatives_considered`, `overview.decisions`, or `tasks`.
   - Keep repair strictly limited to resolving triage `apply` items. Do not add a new requirement, scope item, task, integration path, or design decision unless it is the smallest direct correction required by that triage item and supported by the repair `evidence`.
   - Preserve existing user-approved decisions and draft-derived policy. If a blocking fix would reverse a user decision, reject a draft requirement, or add a new requirement not supported by the draft/request/source, ask the user via Choice Format before writing it.
   - For every triage item with `decision: "apply"`, add one `spec-repair.json.items[]` entry with:
     - `title`: copied from the triage item.
     - `target`: copied from the triage item.
     - `decision`: `applied`.
     - `rationale`: how the spec was changed.
     - `evidence`: concrete evidence for the applied change, such as the `spec.json` field path now covering it.
     - `changedFields`: array of `spec.json` field paths changed for this triage item. This must be non-empty.
   - `spec-repair.json` shape:
     ```json
     {
       "version": 1,
       "phase": "spec-repair",
       "sourceReview": "spec-triage.json",
       "summary": "short summary of applied repair changes",
       "items": [
         {
           "title": "copied triage item title",
           "target": "copied triage item target",
           "decision": "applied",
           "rationale": "how the spec was changed",
           "evidence": "spec.json requirements[0].desc now names the required helper",
           "changedFields": ["requirements[0].desc"]
         }
       ]
     }
     ```
   - Do not run another `spec-review` loop from this step. The downstream `spec-gate` step remains the blocking validation step, so this repair must be small, auditable, and limited to triage `apply` items.
   - Do not render or edit `spec.md` in this step. The approval prompt renders the human-readable `spec.md` view from the repaired `spec.json`.
   - **On complete**: run the exact handoff `sealCommand` once after both declared payloads are complete.
