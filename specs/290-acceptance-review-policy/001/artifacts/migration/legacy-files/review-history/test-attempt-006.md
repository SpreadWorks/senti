# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/290-acceptance-review-policy/test-coverage.json`

## Blocking Findings

### 1. Reset assertions can pass without exercising reset behavior
**Target:** specs/290-acceptance-review-policy/tests/decision-routing.test.js
**Issue:** R10, R11, and R12 require resetting completed leaves through acceptance-review, or from repairTargetStep through acceptance-review. The shared setup initializes nearly every step as pending and only marks acceptance-review in_progress, so the reset assertions would pass even if the implementation never reset already-completed downstream steps.
**Required change:** Set representative pre-reset steps in the affected range to done before invoking the decision/result path, then assert those steps are reset to pending and the intended restart step is in_progress where applicable.
**Why blocking:** This is a static anti-pattern that would pass without exercising the production reset behavior required by R10, R11, and R12.

### 2. R10 public run command path is not covered
**Target:** specs/290-acceptance-review-policy/tests/decision-routing.test.js R10 test
**Issue:** R10 specifically requires behavior from `senti flow run acceptance-review`, but the test calls `applyAcceptanceReviewResult` directly. An implementation could leave the CLI run command unwired or incorrectly wired while this test still passes.
**Required change:** Add spec-local coverage through the production `flow run acceptance-review` command path or its command handler, with the smallest test seam needed to avoid invoking real AI, and assert the recorded verdict/proposals, reset behavior, approval skip, and spec.json non-mutation through that path.
**Why blocking:** The acceptance requirement names a public command behavior, and there is no corresponding executable coverage for that public path.

### 3. Hard blockers are not tested as pass blockers
**Target:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js R9
**Issue:** R9 requires verdict pass to require zero hardBlockers, but the R9 test only proves that low goalSatisfactionScore cannot be offset by other scores. It never supplies hardBlockers with otherwise passing scores.
**Required change:** Add a R9 assertion that `deriveAcceptanceReviewVerdict(validArtifact({ hardBlockers: [...] }))` cannot return `pass` when goal and score thresholds are otherwise satisfied.
**Why blocking:** A critical pass condition from R9 has no spec-local regression test, so an implementation could ignore hardBlockers and still pass the current tests.

### 4. reportRefs absence rule is only partially covered
**Target:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js R5
**Issue:** R5 says reportRefs are used only when report.json already exists. The writer test verifies auto-omission when the input has `reportRefs: undefined`, but it does not catch an implementation that blindly persists caller-supplied reportRefs even when report.json is absent.
**Required change:** Add a R5 case where no report.json exists and the input artifact includes reportRefs, then assert the writer strips them or rejects the artifact according to the intended contract.
**Why blocking:** The requirement's `used only when report.json already exists` constraint has no coverage against the most direct violating implementation.


## Advisory Findings

No advisory findings.