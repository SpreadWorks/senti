   - Repair the draft after `draft-coverage-triage` classifies draft coverage review findings.
   - Read `draft-coverage-triage.json` from the active Flow's configured spec directory first. Treat only `items[]` entries with `decision: "apply"` as the repair input.
   - Do not re-triage review findings in this step. Do not decide that an `apply` item is invalid, already resolved, or non-blocking; if the triage artifact is wrong or missing, stop and surface that artifact problem instead of silently changing the decision.
   - Always write `draft-coverage-repair.json` in that directory before completing this step. This file is the audit log for actual `draft.json` mutations applied from triage decisions.
   - If `draft-coverage-triage.json` is missing, invalid, or contains no `decision: "apply"` items, do not rewrite unrelated draft content. Write `draft-coverage-repair.json` with an empty `items[]`, a concise `summary`, then set `draft.json.approval.approved` to true and `draft.json.approval.confirmedAt` to the repair time when there is no `requires_user_decision` item.
   - Apply the triaged findings once. Update `draft.json` so each `decision: "apply"` item is resolved in the smallest appropriate field.
   - Keep repair strictly limited to resolving triage `apply` items. Do not add a new requirement, scope item, task, integration path, or design decision unless it is the smallest direct correction required by that triage item and supported by the repair `evidence`.
   - Preserve existing user decisions and request-derived policy. If a blocking fix would reverse a user decision or require a new answer, ask the user via Choice Format before writing it.
   - If there is no unresolved `requires_user_decision` item after repair, set `draft.json.approval.approved` to true and `draft.json.approval.confirmedAt` to the repair time before `draft-gate`.
   - For every triage item with `decision: "apply"`, add one `draft-coverage-repair.json.items[]` entry with:
     - `title`: copied from the triage item.
     - `target`: copied from the triage item.
     - `rationale`: how the draft was changed.
     - `evidence`: concrete evidence for the applied change, such as the `draft.json` field path now covering it.
     - `changedFieldPaths`: array of `draft.json` field paths changed for this triage item.
   - `draft-coverage-repair.json` shape:
     ```json
     {
       "version": 1,
       "phase": "draft-coverage-repair",
       "sourceTriage": "draft-coverage-triage.json",
       "summary": "short summary of applied repair changes",
       "items": [
         {
           "title": "copied triage item title",
           "target": "copied triage item target",
           "rationale": "how the draft was changed",
           "evidence": "draft.json approval.approved is now true",
           "changedFieldPaths": ["approval.approved", "approval.confirmedAt"]
         }
       ]
     }
     ```
   - Do not run another draft review loop from this step. The downstream `draft-gate` step remains the blocking validation step.
   - **On complete**: `senti flow set step draft-coverage-repair done`
