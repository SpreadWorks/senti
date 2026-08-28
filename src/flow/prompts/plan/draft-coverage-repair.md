   <!-- include("/flow/prompts/partials/worker-artifact-handoff.md") -->
   - Repair the draft after `draft-coverage-triage` classifies draft coverage review findings.
   - Read `draft.json`, `draft-review-coverage.json`, and `draft-coverage-triage.json` only from their handoff `inputs[].document` snapshots. Treat only triage `items[]` entries with `decision: "apply"` as the repair input.
   - Do not re-triage review findings in this step. Do not decide that an `apply` item is invalid, already resolved, or non-blocking; if the triage artifact is wrong or missing, stop and surface that artifact problem instead of silently changing the decision.
   - Write only `draft-coverage-repair.json` to its exact handoff `payloadPath`; never write `draft.json`. The parent dispatcher applies accepted operations to its immutable canonical snapshot and publishes the derived draft plus an audit.
   - If the guarded canonical input is missing, invalid, or does not match the current phase, stop without writing an artifact or completing the step. If it is valid and contains no `decision: "apply"` items, write an empty `operations[]`. The draft schema has no approval field. After this worker is done, a Definition-owned parent completion connector records completion only when the canonical review, triage, repair audit, and draft facts are all eligible; `draft-gate` then validates the result read-only.
   - Return only bounded `replace-value` operations that copy an apply triage item's exact `title` and `target`, use a declared `allowedFieldPaths` value, and bind the old value with its SHA-256 `expectedDigest`. The parent ignores and audits unknown, stale, or out-of-scope operations without failing the Flow.
   - Keep repair strictly limited to resolving triage `apply` items. Do not add a new requirement, scope item, task, integration path, or design decision unless it is the smallest direct correction required by that triage item and supported by the repair `evidence`.
   - Preserve existing user decisions and request-derived policy. This non-interactive worker must never ask the user. If an `apply` item would reverse a user decision or require a new answer, stop and surface the invalid triage artifact; genuine new user input must use a definition-owned dispatcher boundary after a governed draft reopen.
   - `draft-coverage-repair.json` shape:
     ```json
     {
       "version": 1,
       "baseRevision": "sha256:<exact handoff inputRevision>",
       "operations": [
         {
           "title": "copied triage item title", "target": "copied triage item target",
           "kind": "replace-value", "path": "analysis.validation",
           "expectedDigest": "sha256 hex digest of the immutable target value",
           "replacement": "Verification covers the required behavior.", "reason": "bounded coverage repair"
         }
       ]
     }
     ```
   - Do not run another draft review loop from this step. The downstream `draft-gate` step remains the blocking validation step.
   - **On complete**: run the exact handoff `sealCommand` once after the one declared payload is complete.
