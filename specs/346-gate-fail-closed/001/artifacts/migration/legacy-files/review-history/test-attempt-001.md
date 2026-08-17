# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/346-gate-fail-closed/test-coverage.json`

## Blocking Findings

### 1. R1 coverage does not exercise preset-chain validation path
**Target:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js R1 test
**Issue:** The test constructs GatePrerequisiteFailure directly and asserts its serialization. It does not exercise full preset-chain validation before semantic context resolution, does not prove validation happens only once, does not verify warning de-duplication across an invocation, and does not check the five semantic gate retry limit remains unchanged.
**Required change:** Add a spec-local test that invokes the gate path with a preset chain containing a missing preset and asserts the typed prerequisite failure occurs before evaluation/semantic resolution, emits no duplicate warning in that invocation, and preserves maxSemanticGateRetries at five.
**Why blocking:** R1 is marked covered, but the executable test can pass without the required production behavior existing.

### 2. R2 coverage bypasses required evaluation production behavior
**Target:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js R2 test
**Issue:** The test directly instantiates RequiredGateEvaluationFailure and checks only result is not pass and next is not approval. It does not exercise required agent evaluation, guardrail evaluation, or schema validation paths, does not cover evaluation failure distinctly, and does not assert the gate is not marked done.
**Required change:** Add tests through the production gate evaluation path for required agent, guardrail, and schema-validation unavailable/failure modes, including unset config, spawn failure, evaluation failure, invalid output, and schema failure; assert each returns blocking non-PASS and does not mark the gate done or advance approval.
**Why blocking:** The current test would pass if production required evaluations still fail open, because it only validates a manually constructed failure object.

### 3. R3 flow error envelope and semantic artifact retention are untested
**Target:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js R3 test
**Issue:** The test only checks failureKind and failureCode on a manually created gate result. It does not cover flow error envelopes using errors[0].code, and does not verify semantic findings retain artifacts.evaluations and artifacts.reasons.
**Required change:** Add spec-local coverage for the actual flow error envelope shape and for semantic finding artifacts retaining evaluations and reasons while gate failures persist failureKind and failureCode.
**Why blocking:** R3 requires mechanically distinguishable persisted classifications across gate artifacts, flow envelopes, and semantic findings; the current test covers only one helper serialization case.

### 4. R4 coverage omits production result semantics and registry transitions
**Target:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js R4 test
**Issue:** The test calls retainConfiguredEvaluationOutcome directly with two synthetic arrays. It does not exercise configured required agents through the gate, foreign/optional policies, normal gate result/evaluations/reasons artifacts, or PASS registry transitions.
**Required change:** Add a gate-level test where configured required agents return schema-conforming PASS and FAIL evaluations, asserting existing PASS/FAIL semantics, foreign/optional policy handling, normal artifacts, and PASS registry transition behavior.
**Why blocking:** R4 is marked covered, but the test can pass while production routing loses required semantics or registry behavior.

### 5. R5 test encodes an implementation-only sentinel instead of CLI isolation
**Target:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js R5 test
**Issue:** The test asserts RequiredGateEvaluationFailure.publicCliBypass is false, a static property on a helper class. That does not prove production public CLI routes cannot bypass required evaluations or that fixture/evaluation substitutes are isolated from production routing.
**Required change:** Replace or supplement this with a public CLI route test that attempts to use test evaluation controls/substitutes and asserts production routing still performs required evaluations or rejects the substitute path.
**Why blocking:** This is a static anti-pattern that would pass without exercising production CLI behavior and may encode an incorrect implementation premise.

### 6. R6 coverage misses reuse-without-provider and mismatch rejection requirements
**Target:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js R6 test
**Issue:** The test calls canonicalizeFinalizedFlowReviewArtifact directly and checks selected returned fields. It does not simulate post-hook lock failure, does not prove the finalized provider artifact is reused as canonical evidence without invoking the provider again, and does not reject mismatched tree or target state. The negative case changes taskId, not explicit phase/tree/state evidence.
**Required change:** Add a flow-level test for post-hook lock failure with an existing finalized review provider artifact, asserting canonical evidence registration for phase/null target/current tree/current state fingerprint without another provider call, plus rejection cases for phase, tree, and target-state mismatch.
**Why blocking:** R6's core behavioral guarantee is provider reuse and strict artifact matching; the current helper-level test can pass while production re-invokes the provider or accepts stale evidence.


## Advisory Findings

No advisory findings.