   <!-- include("/flow/prompts/partials/worker-artifact-handoff.md") -->
   - Repair the draft after `draft-questions-triage` classifies draft question review findings.
   - Read `draft.json`, `draft-review-questions.json`, and `draft-questions-triage.json` only from their handoff `inputs[].document` snapshots. Treat only triage `items[]` entries with `decision: "apply"` as the repair input.
   - Do not re-triage review findings in this step. Do not decide that an `apply` item is invalid, already resolved, or non-blocking; if the triage artifact is wrong or missing, stop and surface that artifact problem instead of silently changing the decision.
   - Write only `draft-questions-repair.json` to its exact handoff `payloadPath`; never write `draft.json`. The parent dispatcher applies accepted operations to the immutable canonical snapshot, records the audit, validates the resulting DraftLifecycle, and publishes the resulting canonical draft.
   - If an immutable input is missing, invalid, or does not match the current phase, stop without writing or sealing. If there are no `decision: "apply"` items, write an empty `operations[]`; the parent preserves the canonical draft unchanged for downstream validation. The draft schema has no approval field. After coverage completes, the Definition-owned parent completion connector records completion from eligible canonical facts; `draft-gate` only validates the result.
   - Return only `replace-value` operation proposals. Each operation must copy an apply triage item's exact `title` and `target`, use one of that item's `allowedFieldPaths`, name the current value's SHA-256 `expectedDigest` (`sha256(JSON.stringify(value))`), and include a replacement plus a reason. Cover each `requiredFieldPaths` entry when possible. Unknown, stale, or out-of-scope proposals are ignored and audited by the parent.
   - Keep repair strictly limited to resolving triage `apply` items. Do not add a new requirement, scope item, task, integration path, or design decision unless it is the smallest direct correction required by that triage item and supported by the repair `evidence`.
   - Preserve existing user decisions and request-derived policy. This worker must never ask the user. If a change would reverse a user decision or require a new answer, the triage item must be `requires_user_decision`, not `apply`; stop and surface an invalid triage artifact if such an item reaches repair.
   - When existing evidence already answers a triaged QA entry, update that entry to `answered` with the evidence and rationale. When the entry is redundant or belongs to project/spec-writing policy, update it to `dropped` with a concrete reason. Keep `decisionMap.requiresUserJudgment` synchronized with the remaining unresolved QA ids.
   - `draft-questions-repair.json` shape:
     ```json
     {
       "version": 1,
       "baseRevision": "sha256:<exact handoff inputRevision>",
       "operations": [
         {
           "title": "copied triage item title", "target": "copied triage item target",
           "kind": "replace-value", "path": "questionLedger.questions[0].question",
           "expectedDigest": "sha256 hex digest of the immutable target value",
           "replacement": "self-contained question text", "reason": "bounded repair"
         }
       ]
     }
     ```
   - Do not run another draft review loop from this step. The parent dispatcher handles any genuine unresolved question before the downstream `draft-refine` worker can start.
   - **On complete**: run the exact handoff `sealCommand` once after the one declared payload is complete.
