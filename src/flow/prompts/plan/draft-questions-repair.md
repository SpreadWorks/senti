   - Repair the draft after `draft-questions-triage` classifies draft question review findings.
   - Read `specs/<spec-id>/draft-questions-triage.json` first. Treat only `items[]` entries with `decision: "apply"` as the repair input.
   - Do not re-triage review findings in this step. Do not decide that an `apply` item is invalid, already resolved, or non-blocking; if the triage artifact is wrong or missing, stop and surface that artifact problem instead of silently changing the decision.
   - Always write `specs/<spec-id>/draft-questions-repair.json` before completing this step. This file is the audit log for actual `draft.json` mutations applied from triage decisions.
   - If `draft-questions-triage.json` is missing, invalid, or contains no `decision: "apply"` items, do not rewrite the draft. Write `draft-questions-repair.json` with an empty `items[]`, a concise `summary`, and run `sdd-forge flow set step draft-questions-repair done`.
   - Apply the triaged findings once. Update `draft.json` so each `decision: "apply"` item is resolved in the smallest appropriate field.
   - Keep repair strictly limited to resolving triage `apply` items. Do not add a new requirement, scope item, task, integration path, or design decision unless it is the smallest direct correction required by that triage item and supported by the repair `evidence`.
   - Preserve existing user decisions and request-derived policy. If a blocking fix would reverse a user decision or require a new answer, ask the user via Choice Format before writing it.
   - For every triage item with `decision: "apply"`, add one `draft-questions-repair.json.items[]` entry with:
     - `title`: copied from the triage item.
     - `target`: copied from the triage item.
     - `rationale`: how the draft was changed.
     - `evidence`: concrete evidence for the applied change, such as the `draft.json` field path now covering it.
     - `changedFieldPaths`: array of `draft.json` field paths changed for this triage item.
   - `draft-questions-repair.json` shape:
     ```json
     {
       "version": 1,
       "phase": "draft-questions-repair",
       "sourceTriage": "draft-questions-triage.json",
       "summary": "short summary of applied repair changes",
       "items": [
         {
           "title": "copied triage item title",
           "target": "copied triage item target",
           "rationale": "how the draft was changed",
           "evidence": "draft.json qa[0].question is now self-contained",
           "changedFieldPaths": ["qa[0].question"]
         }
       ]
     }
     ```
   - Do not run another draft review loop from this step. The downstream `draft-refine` step remains responsible for user question handling.
   - **On complete**: `sdd-forge flow set step draft-questions-repair done`
