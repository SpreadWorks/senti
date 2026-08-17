# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Producer aggregation no longer reaches acceptance review
**Finding key:** synthetic-fixture-breaks-producer-aggregation
**Failure mode:** missing_acceptance_requirement
**File:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js
**Requirement:** R5
**Issue:** The migrated R6 assertion builds a new `acceptanceFixture` from copied `artifact.entries` instead of running acceptance review against the producer fixture's `specDir` where `deferExhaustedSemanticFindings` wrote the real `flow-findings.json`. This no longer proves acceptance-review consumes the producer aggregation artifact; it only proves a synthetic helper can recreate similar entries.
**Suggestion:** Run `buildAcceptanceReviewContext`/`artifactFromAcceptanceJudgments` or `runAcceptanceReviewFixture` against the original producer fixture root/state/spec directory, or extend the helper to wrap the existing producer fixture without rewriting `flow-findings.json`, so the test reads the actual aggregation output.
**Disposition:** must-fix
**Rationale:** R5 explicitly requires preserving spec 295 producer aggregation. Disconnecting the acceptance assertion from the artifact produced earlier in the test weakens a mandatory regression check.

### 2. Retry exhaustion mirror test uses a fresh artifact
**Finding key:** synthetic-fixture-breaks-retry-exhaustion-persistence
**Failure mode:** missing_acceptance_requirement
**File:** specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js
**Requirement:** R6
**Issue:** The migrated R7 test reads a retry-exhaustion entry from `producerFixture`, then creates an independent `acceptanceFixture` and verifies mirroring on that new fixture's `flow-findings.json`. The assertion no longer proves that acceptance-review persists finalDisposition back into the retry-exhaustion artifact created by `checkReviewRetryBelowMax`.
**Suggestion:** Run the acceptance-review context and writer against `producerFixture.root`/`producerFixture.specDir` and assert `readFlowFindingsArtifact(producerFixture.specDir)` contains the mirrored finalDisposition after persistence.
**Disposition:** must-fix
**Rationale:** R6 requires retry exhaustion persistence and mirror behavior. Verifying a copied finding in a separate fixture does not cover the mandatory producer-to-acceptance persistence path.

### 3. Post-hook handoff is no longer exercised end to end
**Finding key:** synthetic-fixture-breaks-post-hook-handoff
**Failure mode:** missing_acceptance_requirement
**File:** specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js
**Requirement:** R8
**Issue:** Both migrated R8 tests create deferred findings through the post-hook path, then copy the entry fields into a new `acceptanceFixture`. Acceptance review is not run against the post-hook fixture that originally wrote `flow-findings.json`, so the test no longer verifies that the post-hook output is actually handed off to acceptance-review.
**Suggestion:** Build and apply the acceptance-review artifact using the original `producerFixture` root/state/spec directory after preparing the current acceptance evidence there, or provide a helper path that layers current context evidence onto the existing post-hook fixture without replacing the source artifact.
**Disposition:** must-fix
**Rationale:** R8 requires preserving spec 310 test-review handoff and flow transition behavior. Copying fields into a synthetic fixture bypasses the handoff contract that the target regression is meant to protect.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
