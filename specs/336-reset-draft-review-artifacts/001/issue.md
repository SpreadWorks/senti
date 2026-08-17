## Summary

After `draft review` generates triage/repair artifacts, a subsequent `rewind` followed by a PASS review can leave stale artifacts from the invalidated attempt in place.

On the PASS path, the lifecycle calls `writeEmptyDraftReviewRouteArtifacts()`, but that helper only writes empty triage/repair artifacts when the target files do **not** already exist. If a previous FAIL/ADVISORY attempt already created those files, the PASS attempt can complete while the durable current artifacts still describe outdated findings.

## Expected Behavior

A PASS after `rewind` should always leave the current draft-review route artifacts in the canonical empty state for the current attempt, without surfacing findings from invalidated attempts.

## Current Behavior

A PASS after `rewind` can preserve old triage/repair artifacts from a previous attempt, making the current artifact state inconsistent with the current review outcome.

## Evidence

- `src/flow/definition.js` marks review, triage, and repair as done on PASS and calls the empty-artifact helper.
- `writeEmptyDraftReviewRouteArtifacts()` suppresses both writes behind `!fs.existsSync(...)` guards.
- `src/flow/lib/run-reopen-draft.js` resets the target steps during rewind while retaining stale planning artifacts.

## Impact

The workflow can report a clean PASS for the current attempt while the canonical triage/repair artifacts still contain findings from an invalidated attempt.

## Scope

Fix only the draft-review artifact lifecycle. Do not change the transition guard tracked in Issue #443.

## Acceptance Criteria

- A PASS after `rewind` writes the canonical empty triage and repair artifacts for the current attempt.
- Findings from invalidated attempts do not remain in the current artifacts.
- Rewind audit/history is preserved; only the current artifact view is replaced or versioned correctly.
- Focused tests cover FAIL/ADVISORY -> rewind -> PASS across each draft-review route.

<details>
<summary>ja</summary>

rewind 後の draft review PASS で古い triage・repair artifact が残る

## Summary

After `draft review` generates triage/repair artifacts, a subsequent `rewind` followed by a PASS review can leave stale artifacts from the invalidated attempt in place.

On the PASS path, the lifecycle calls `writeEmptyDraftReviewRouteArtifacts()`, but that helper only writes empty triage/repair artifacts when the target files do **not** already exist. If a previous FAIL/ADVISORY attempt already created those files, the PASS attempt can complete while the durable current artifacts still describe outdated findings.

## Expected Behavior

A PASS after `rewind` should always leave the current draft-review route artifacts in the canonical empty state for the current attempt, without surfacing findings from invalidated attempts.

## Current Behavior

A PASS after `rewind` can preserve old triage/repair artifacts from a previous attempt, making the current artifact state inconsistent with the current review outcome.

## Evidence

- `src/flow/definition.js` marks review, triage, and repair as done on PASS and calls the empty-artifact helper.
- `writeEmptyDraftReviewRouteArtifacts()` suppresses both writes behind `!fs.existsSync(...)` guards.
- `src/flow/lib/run-reopen-draft.js` resets the target steps during rewind while retaining stale planning artifacts.

## Impact

The workflow can report a clean PASS for the current attempt while the canonical triage/repair artifacts still contain findings from an invalidated attempt.

## Scope

Fix only the draft-review artifact lifecycle. Do not change the transition guard tracked in Issue #443.

## Acceptance Criteria

- A PASS after `rewind` writes the canonical empty triage and repair artifacts for the current attempt.
- Findings from invalidated attempts do not remain in the current artifacts.
- Rewind audit/history is preserved; only the current artifact view is replaced or versioned correctly.
- Focused tests cover FAIL/ADVISORY -> rewind -> PASS across each draft-review route.

</details>