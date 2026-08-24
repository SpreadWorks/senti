   <!-- include("/flow/prompts/partials/worker-artifact-handoff.md") -->
   - Repair the draft after `draft-questions-triage` classifies draft question review findings.
   - Read `draft.json`, `draft-review-questions.json`, and `draft-questions-triage.json` only from their handoff `inputs[].document` snapshots. Treat only triage `items[]` entries with `decision: "apply"` as the repair input.
   - Do not re-triage review findings in this step. Do not decide that an `apply` item is invalid, already resolved, or non-blocking; if the triage artifact is wrong or missing, stop and surface that artifact problem instead of silently changing the decision.
   - Write `draft-questions-repair.json` and the complete resulting `draft.json` only to their exact handoff `payloadPath` values. The repair artifact is the audit log for actual draft mutations applied from triage decisions.
   - If an immutable input is missing, invalid, or does not match the current phase, stop without writing or sealing. If it is valid and contains no `decision: "apply"` items, preserve the draft snapshot unchanged in the declared `draft.json` payload and write `draft-questions-repair.json` with an empty `items[]` and a concise `summary`.
   - Apply the triaged findings once. Update `draft.json` so each `decision: "apply"` item is resolved in the smallest appropriate field.
   - Keep repair strictly limited to resolving triage `apply` items. Do not add a new requirement, scope item, task, integration path, or design decision unless it is the smallest direct correction required by that triage item and supported by the repair `evidence`.
   - Preserve existing user decisions and request-derived policy. This worker must never ask the user. If a change would reverse a user decision or require a new answer, the triage item must be `requires_user_decision`, not `apply`; stop and surface an invalid triage artifact if such an item reaches repair.
   - When existing evidence already answers a triaged QA entry, update that entry to `answered` with the evidence and rationale. When the entry is redundant or belongs to project/spec-writing policy, update it to `dropped` with a concrete reason. Keep `decisionMap.requiresUserJudgment` synchronized with the remaining unresolved QA ids.
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
           "evidence": "draft.json questionLedger.questions[0].question is now self-contained",
           "changedFieldPaths": ["questionLedger.questions[0].question"]
         }
       ]
     }
     ```
   - Do not run another draft review loop from this step. The parent dispatcher handles any genuine unresolved question before the downstream `draft-refine` worker can start.
   - **On complete**: run the exact handoff `sealCommand` once after both declared payloads are complete.
