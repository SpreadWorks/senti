# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/296-review-gate-defer/test-coverage.json`

## Blocking Findings

### 1. R1 covers only spec review exhaustion
**Target:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Issue:** R1 requires retry-exhaustion behavior for draft, spec, test, and impl review phases, including flow-findings recording, source step completion, and a successful deferred result. The test exercises only checkReviewRetryBelowMax(ctx, "spec").
**Required change:** Add spec-local executable coverage for the draft, test, and impl review phases, asserting deferred success, source review step done, and flow-findings recording for each relevant phase.
**Why blocking:** The coverage artifact marks R1 covered, but three required review phases have no corresponding spec-local test coverage.

### 2. R2 does not exercise gate exhaustion behavior
**Target:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Issue:** R2 requires gate retry exhaustion for draft, spec, task-impl, and integration phases to record flow-findings, mark the source gate step done, and return successful deferred results instead of ESCALATE_RETRY_EXHAUSTED. The test only calls classifyGateRetryExhaustionSource for one integration artifact and checks classification.
**Required change:** Add executable gate retry-exhaustion tests for draft, spec, task-impl, and integration that verify deferred success, source gate step completion, and flow-findings persistence.
**Why blocking:** Classification-only coverage can pass without the required gate retry-exhaustion behavior being implemented.

### 3. R4 structured non-semantic prechecks are undercovered
**Target:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Issue:** R4 lists several non-semantic failure sources that must be classified before semantic retry accounting. The test covers only coverage.validation.ok=false and does not cover toolingFailure, command non-zero exit, invalid source schema, failed test evidence, no-progress guard, flow-state corruption, malformed artifact failures, or generated header origin/failureKind cases.
**Required change:** Add spec-local tests for the listed structured non-semantic failure sources, asserting they are not deferred as semantic findings.
**Why blocking:** A critical non-semantic/semantic boundary has no regression coverage for most required failure kinds.

### 4. R5 is covered only by prompt text checks
**Target:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Issue:** R5 requires bounded flow-level repair across separate senti flow run review --phase test invocations, retry budget consumption, exhaustion delegation to acceptance-review, and TOOLING_FAILURE staying non-semantic. The test only checks strings in the test-review prompt.
**Required change:** Add an executable test-review flow scenario that simulates separate invocations, verifies reviewRetry budget consumption, verifies semantic exhaustion delegation, and verifies TOOLING_FAILURE remains a separate failure path.
**Why blocking:** The current test would pass without exercising the required production behavior.

### 5. R6 omits required deferred finding fields
**Target:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Issue:** R6 requires flow-findings entries to include findingId, sourceStep, sourceArtifact, sourceFindingId, retryExhausted=true, attempts, round, completionKind=deferred, and finalDisposition=null. The test does not assert findingId, retryExhausted, attempts, or round.
**Required change:** Extend the R6 assertions to verify findingId, retryExhausted=true, attempts, and round in the persisted flow-findings entry.
**Why blocking:** Required persisted schema fields could be absent while the test still passes.

### 6. R7 is covered only by prompt text checks
**Target:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Issue:** R7 requires acceptance-review to read deferred findings from flow-findings.json and source artifacts, include them in decisions, and mirror finalDisposition before final-regression proceeds. The test only checks that the acceptance-review prompt mentions flow-findings.json and finalDisposition.
**Required change:** Add executable acceptance-review coverage that provides deferred flow-findings and source artifacts, verifies decision impact, verifies finalDisposition mirroring, and verifies final-regression is gated on that mirroring.
**Why blocking:** The current test can pass without acceptance-review consuming or updating deferred findings.

### 7. R9 uses text existence instead of behavior-level regression coverage
**Target:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Issue:** R9 requires behavior-level regression coverage proving retry-limit parity for review, gate, test-review, acceptance-review deferred input, and structured non-semantic precheck blocking. The test only checks that a shared test file exists and contains certain substrings.
**Required change:** Replace or supplement the substring check with executable behavior-level regression assertions for review, gate, test-review, acceptance-review deferred input, and structured non-semantic precheck blocking.
**Why blocking:** This static anti-pattern would pass without exercising production behavior, contradicting the requirement for behavior-level regression coverage.


## Advisory Findings

No advisory findings.