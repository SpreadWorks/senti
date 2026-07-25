# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/346-gate-fail-closed/test-coverage.json`

## Blocking Findings

### 1. R2 coverage misses required-agent failure modes
**Target:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js R2 test
**Issue:** The R2 test covers an unset required agent and an agent spawn failure, but it does not cover required-agent evaluation failure, invalid output, or schema failure. The requirement explicitly applies each failure class to every required agent evaluation as well as guardrail evaluation and schema validation.
**Required change:** Add spec-local assertions for requiredAgent evaluation failure, invalid output, and schema failure producing blocking non-PASS outcomes without gateDone or approval advancement.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage for several required-agent fail-closed cases.

### 2. R6 stale-artifact rejection is not actually exercised for tree or state
**Target:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js R6 test
**Issue:** The providerArtifact only includes phase/verdict/findings/finalized, so it carries no treeSha, taskId, or targetStateDigest to compare against the current state. The stale tree and stale target-state cases therefore cannot validate the required behavior of rejecting artifacts whose tree or target state does not match.
**Required change:** Construct the finalized provider artifact with matching treeSha, taskId:null, and targetStateDigest, then assert recovery rejects artifacts whose embedded treeSha or targetStateDigest differs from the current state.
**Why blocking:** The test has a static anti-pattern that can pass without exercising production behavior required by R6.


## Advisory Findings

No advisory findings.