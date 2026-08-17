# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/290-acceptance-review-policy/test-coverage.json`

## Blocking Findings

### 1. Acceptance-review artifact writing is not exercised
**Target:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js / R5
**Issue:** R5 requires acceptance-review to write a schema-validated artifact, including conditional reportRefs behavior when report.json exists. The tests only validate an in-memory fixture against the schema and never run the acceptance-review command or assert that an artifact is written and validated by production code.
**Required change:** Add a spec-local test that runs or directly invokes the acceptance-review artifact-writing path, asserts the written artifact validates against the schema, and covers reportRefs being emitted only when report.json exists.
**Why blocking:** A schema-only fixture test can pass even if production never writes the required artifact or handles reportRefs incorrectly.

### 2. Mechanical blocker classification is not covered
**Target:** specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js / R8
**Issue:** R8 requires missing tests, failed tests, missing required artifacts, invalid schemas, and missing required tests to be classified as mechanicalBlockers. The test pre-populates one missing_tests blocker and only verifies that any existing mechanicalBlocker forces a blocked verdict.
**Required change:** Add tests that exercise the production classification path for each required blocker category and assert both the mechanicalBlockers entry and verdict blocked.
**Why blocking:** The current test would pass if classification were never implemented and callers merely supplied mechanicalBlockers manually.

### 3. Decision-routing fixtures contradict the acceptance-review artifact contract
**Target:** specs/290-acceptance-review-policy/tests/decision-routing.test.js / R10 R11 R12
**Issue:** The artifact() helper omits many fields required by R5, R6, and R7, including scores, thresholds, attempt, complete finding fields, and complete requirementAmendmentProposal fields. If production correctly schema-validates acceptance-review artifacts, these routing tests are based on invalid artifacts.
**Required change:** Replace the minimal artifact() fixture with a schema-valid acceptance-review artifact builder, then override only verdict-specific fields needed by each routing scenario.
**Why blocking:** Tests that depend on invalid artifacts can fail for fixture reasons or force implementation to accept artifacts that contradict the required schema.

### 4. Acceptance-decision routing lacks required choice coverage
**Target:** specs/290-acceptance-review-policy/tests/decision-routing.test.js / R10 R11 R12
**Issue:** R11 requires amend_and_retry, abort, accept_risk_and_continue risk recording, and rejection of accept_risk_and_continue when mechanicalBlockers exist. The tests cover only accept_risk_and_continue without blockers. R12 requires abort behavior for blocked verdicts, but only repair_and_reevaluate is covered. R10 also does not assert that routine approval is skipped unless user_decision_required was recorded.
**Required change:** Add focused tests for amend_and_retry, abort, accept_risk_and_continue risk logging, mechanical-blocker rejection, blocked abort handling, and the no-routine-approval condition for amend_required.
**Why blocking:** Several mandatory decision branches have no executable coverage, so an implementation could omit them while the spec-local tests still pass.

### 5. Completion guard covers only missing artifacts
**Target:** specs/290-acceptance-review-policy/tests/completion-guard.test.js / R15
**Issue:** R15 requires preventing final-regression advancement for missing, blocked, amend_required, and user_decision_required acceptance-review states, across manual completion and hook promotion. The current test only covers manual completion with a missing artifact.
**Required change:** Add tests for blocked, amend_required, and user_decision_required artifacts, plus the hook-promotion path, asserting final-regression is not advanced.
**Why blocking:** The current guard test can pass while unresolved acceptance-review verdicts or hook promotion still advance final-regression.

### 6. Migration parity coverage is materially incomplete
**Target:** specs/290-acceptance-review-policy/tests/definition-policy.test.js and next-action-contract.test.js / R14
**Issue:** R14 covers broad migration parity, including review/gate artifact meanings, retro artifact meaning, flow state promotion, retry metrics, plugin hooks, and side effects. The current R14 assertions only check part of leaf ordering, final-regression action, finalize-commit approval, and acceptance-review context kinds.
**Required change:** Add spec-local parity tests or update the coverage artifact to point to existing executable shared tests that cover the omitted R14 parity areas.
**Why blocking:** The coverage artifact marks R14 covered, but the actual tests do not cover several required parity guarantees.


## Advisory Findings

No advisory findings.