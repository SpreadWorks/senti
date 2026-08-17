# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Blocking deferred findings no longer produce a blocked verdict
**Finding key:** blocking-deferred-verdict-user-decision
**Failure mode:** spec_behavior_contradiction
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** The updated R8 test now asserts that a deferred finding with finalDisposition="blocking" yields verdict="user_decision_required" while also adding a hard blocker. A finding explicitly classified as blocking is tied to blocking authority and should not be routed as a user decision outcome.
**Suggestion:** In the R8 unresolved deferred findings branch, restore the assertion that blocking deferred dispositions produce verdict="blocked" and verify the corresponding hardBlockers entry remains present.
**Disposition:** must-fix
**Rationale:** The typed disposition policy requires mandatory or blocking guardrail findings to be must-fix/blocking. Treating finalDisposition="blocking" as user_decision_required weakens that mandatory authority and contradicts the blocking guardrail behavior under test.

### 2. Review-gate coverage also normalizes blocking disposition to user decision
**Finding key:** blocking-deferred-verdict-review-gate
**Failure mode:** spec_behavior_contradiction
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** The new R7 test case asserts artifact.verdict="user_decision_required" for deferredFindingDispositions("blocking") even though it verifies hardBlockers[0].kind="blocking_deferred_finding".
**Suggestion:** Change the R7 blocking deferred disposition assertion to expect verdict="blocked" and keep the hard-blocker authority assertion.
**Disposition:** must-fix
**Rationale:** A blocking deferred disposition is mandatory repair/blocking authority. The policy cannot resolve it correctly if the acceptance-review contract records a hard blocker but exposes a non-blocking user decision verdict.

### 3. Fixture guardrail findings do not use guardrail id as failureMode
**Finding key:** deferred-source-failuremode-not-guardrail-id
**Failure mode:** spec_behavior_contradiction
**File:** tests/helpers/acceptance-review-fixture.js
**Requirement:** R9
**Issue:** deferredSourceEvidence() emits advisory findings with guardrail_id set to finding.sourceFindingId but failureMode hard-coded to "missing_acceptance_requirement". For a blocking guardrail finding, the policy requires failureMode to be the exact guardrail id so authority can be resolved.
**Suggestion:** In deferredSourceEvidence(), set failureMode to the guardrail identifier used for the fixture finding, or stop marking the fixture finding as a guardrail-authoritative must-fix if it is meant to exercise the generic missing_acceptance_requirement path.
**Disposition:** must-fix
**Rationale:** The requested guardrail explicitly says blocking guardrail findings must use the exact guardrail id as failureMode. The helper creates reusable acceptance-review evidence, so this mismatch can make multiple requirement tests validate the wrong authority path.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
