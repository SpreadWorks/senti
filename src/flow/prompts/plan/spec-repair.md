   <!-- include("/flow/prompts/partials/worker-artifact-handoff.md") -->
   - Repair the existing spec after `spec-triage` classifies blocking review findings.
   - Read `spec.json`, `spec-review.json`, and `spec-triage.json` only from their handoff `inputs[].document` snapshots. `spec.json` is immutable input context. Treat only triage `items[]` entries with `decision: "apply"` as the repair input.
   - Do not re-triage review findings in this step. Do not decide that an `apply` item is invalid, already resolved, or non-blocking; if the triage artifact is wrong or missing, stop and surface that artifact problem instead of silently changing the decision.
   - Write only `spec-repair.json` to its exact handoff `payloadPath`. Never write `spec.json`; the CLI alone applies accepted operations to the immutable snapshot, validates it, and atomically publishes the resulting canonical spec plus an audit.
   - If an immutable input is missing or invalid, stop without writing or sealing. If there are no triage `apply` items, write an empty `operations[]`.
   - Return only constrained operation proposals. Each proposal must use an apply item's exact `findingId`, the same canonical location as an `allowedTargets` permission, and one of that permission's `operationKinds`. Cover every `requiredTargets` entry exactly once. `kind` is one of `replace-field`, `replace-entity-field`, `add-array-element`, `replace-array-element`, or `delete-array-element`. `expectedDigest` is the lowercase SHA-256 hex digest of the UTF-8 bytes produced by `JSON.stringify(immutableTargetValue)` for every replacement, and by `JSON.stringify(immutableArrayElement)` for array replacement/deletion; it is `null` only for `add-array-element`. For duplicate no-ID array values, add `position` to the operation target, using its zero-based immutable-base position; this position narrows the authorized collection and does not expand triage authority. `scopeExpansions` is a top-level proposal list only: it is never applied by this command.
   - Preserve every field outside accepted operations exactly, including every task `test_strategy`. Do not add arbitrary objects, replace the whole spec, mutate a task id, or choose a target not declared by triage.
   - `spec-repair.json` shape:
     ```json
     {
       "version": 1,
       "baseRevision": "sha256:<exact handoff inputRevision>",
       "scopeExpansions": [],
       "operations": [
         {
           "findingId": "spec-review-blocking-1",
           "target": { "entity": "requirement", "id": "R1", "field": "desc" },
           "kind": "replace-entity-field",
           "expectedDigest": "sha256 hex digest of the immutable requirement description",
           "replacement": "repaired requirement description",
           "reason": "why this direct correction resolves the finding"
         }
       ]
     }
     ```
   - This worker writes the v1 proposal only. The CLI owns the distinct v2 `spec-repair.json` audit: it records accepted/discarded normalized operations, attempts, scope proposals, result revision, and validation outcome. Never write or imitate that audit.
   - Do not run another `spec-review` loop from this step. The downstream `spec-gate` step remains the blocking validation step, so this repair must be small, auditable, and limited to triage `apply` items.
   - Do not render or edit `spec.md` in this step. The approval prompt renders the human-readable `spec.md` view from the repaired `spec.json`.
   - **On complete**: run the exact handoff `sealCommand` once after the one declared payload is complete.
