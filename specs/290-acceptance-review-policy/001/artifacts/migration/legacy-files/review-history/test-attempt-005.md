# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/290-acceptance-review-policy/test-coverage.json`

## Blocking Findings

### 1. R10 acceptance-review run is not actually exercised
**Target:** specs/290-acceptance-review-policy/tests/decision-routing.test.js
**Issue:** The R10 test pre-writes acceptance-review.json and acceptanceReview state before running `senti flow run acceptance-review`, so the assertions can pass even if the command never writes the schema-validated artifact, never records proposals from its own output, and never applies amend_required routing from production acceptance-review behavior.
**Required change:** Set up the flow without pre-populated acceptanceReview state/artifact for the R10 run, or invoke the production acceptance-review artifact handling path with controlled output, then assert the artifact/state are produced by that command.
**Why blocking:** R10 requires behavior of `senti flow run acceptance-review`; the current test can pass from fixture state and does not exercise the production behavior it is meant to guard.

### 2. R5 writer schema validation is not tested against invalid output
**Target:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js
**Issue:** The writer test only passes a valid artifact to `writeAcceptanceReviewArtifact` and then validates the file afterward. It would still pass if the writer persisted invalid artifacts without schema validation.
**Required change:** Add the smallest negative writer case that passes an artifact missing a required R5 field and asserts `writeAcceptanceReviewArtifact` rejects instead of writing it.
**Why blocking:** R5 specifically requires a schema-validated artifact. Without a negative writer test, the production writer could omit validation entirely and this suite would still pass.

### 3. R15 hook promotion guard is only tested as pure lifecycle resolution
**Target:** specs/290-acceptance-review-policy/tests/completion-guard.test.js
**Issue:** The hook-promotion portion of R15 calls `resolveLifecycle` directly and checks returned actions, but it does not exercise the state mutation path that applies lifecycle actions or hook promotion. A hook/application layer could still advance final-regression despite this test passing.
**Required change:** Add a spec-local test that applies the production completion or hook lifecycle path to saved flow state with unresolved acceptance-review artifacts and asserts final-regression is not promoted.
**Why blocking:** R15 explicitly guards against manual completion or hook promotion advancing final-regression. Manual completion is covered, but hook promotion is not covered by an executable production-state regression.


## Advisory Findings

### 1. Acceptance-review envelope shape could be asserted more tightly
**Target:** specs/290-acceptance-review-policy/tests/next-action-contract.test.js
**Improvement:** For R4, assert the full acceptance-review next-action key set, allowing `failurePolicy` as the only additive key, to mirror the migration parity checks for unaffected steps.
**Why non-blocking:** The test already covers the required snake_case fields and failurePolicy value, so this is a contract-strengthening improvement rather than missing coverage.
