# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/290-acceptance-review-policy/test-coverage.json`

## Blocking Findings

### 1. Acceptance-review insertion test encodes an incorrect final-regression premise
**Target:** specs/290-acceptance-review-policy/tests/next-action-contract.test.js, test "R14: acceptance-review insertion preserves final-regression as the next mechanical check"
**Issue:** The test name and R14 requirement say final-regression must remain the next mechanical check after acceptance-review, but the assertions only inspect acceptance-review context kinds from `flow get next-action`. They never complete or pass acceptance-review and never assert that final-regression is promoted next.
**Required change:** Change this test, or add a focused spec-local test, to exercise the acceptance-review pass path and assert final-regression becomes the next in-progress/next-action step after acceptance-review.
**Why blocking:** R14's final-regression ordering/promotion behavior has no corresponding executable coverage in this test; the current assertions could pass even if acceptance-review promoted finalize or stopped the flow instead of final-regression.


## Advisory Findings

### 1. R5 writer validation is only checked on valid input
**Target:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js, test "R5: artifact writer persists schema-valid output and only includes existing report refs"
**Improvement:** Add a small negative case showing `writeAcceptanceReviewArtifact` rejects or fails invalid artifacts if the intended contract is that the writer itself performs schema validation.
**Why non-blocking:** The schema shape and persisted valid output are covered, so this is an extra guard around where validation happens rather than missing requirement coverage.
