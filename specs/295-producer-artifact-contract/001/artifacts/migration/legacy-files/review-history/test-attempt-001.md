# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/295-producer-artifact-contract/test-coverage.json`

## Blocking Findings

### 1. Static source-text assertions do not exercise the required behavior
**Target:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js
**Issue:** Every test verifies implementation by reading source files and matching names, tokens, or ordering in text. These tests can pass if the expected strings are present while normalize/validate/repair/revalidate behavior, retry isolation, deferred findings, and implement readiness checks are not actually executed or correct.
**Required change:** Replace or augment the source-text assertions with executable spec-local tests that import/call the artifact completion contract and relevant flow entry points or adapters using fixtures, then assert returned success/failure classes, retry counter preservation, deferred finding artifacts, and implement completion envelopes from actual behavior.
**Why blocking:** R1-R7 are behavioral requirements. The current tests have a static anti-pattern that would pass without exercising production behavior, so the acceptance requirements lack reliable regression coverage.

### 2. R2 ordering check encodes a brittle implementation premise
**Target:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js R2 test
**Issue:** The R2 test uses string index ordering in src/flow/lib/run-gate.js to infer that draft/spec completion happens before semantic guardrail judgment. This can pass or fail based on helper definitions, imports, comments, or unrelated text order rather than runtime call order.
**Required change:** Use an executable test with a fixture or stubbed guardrail path that observes artifact completion failure preventing semantic guardrail evaluation, and success allowing guardrail evaluation afterward.
**Why blocking:** R2 specifically requires mechanical checks before semantic judgment. The current test does not verify the runtime ordering that protects the semantic guardrail decision.

### 3. R5 retry isolation is not behaviorally verified
**Target:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js R5 test
**Issue:** The R5 test only checks for words such as semantic, mechanical, protocol, tooling, and retry in run-gate.js. It does not verify that mechanical validation, deterministic repair, provider/tooling/protocol, or AI output schema failures preserve reviewRetry/gateRetry while AI semantic FAIL consumes them.
**Required change:** Add executable cases for at least one semantic FAIL and one non-semantic failure path, asserting the persisted retry counters or returned envelope state after each path.
**Why blocking:** R5 is a critical retry-accounting requirement, and the current test could pass with misleading comments or dead code while retries are still consumed incorrectly.

### 4. R6 deferral behavior is not covered for exhausted semantic retries
**Target:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js R6 test
**Issue:** The R6 test checks only for symbol names and string mentions. It does not execute exhausted retry scenarios for draft-gate, spec-review, spec-gate, impl-review, task-impl, or integration, nor does it verify flow-findings.json contents, continued step behavior, acceptance-review context, or blocking[] versus blockingFindings[] source handling.
**Required change:** Add executable fixture tests that simulate exhausted semantic FAIL retries for representative review and gate phases, then assert deferred findings are appended with preserved or stable sourceFindingId values and that the phase does not stop solely due to exhaustion.
**Why blocking:** R6 requires durable cross-phase behavior and source-shape compatibility. Static string checks do not provide corresponding regression coverage.


## Advisory Findings

### 1. R7 surface test is overly coupled to literal text
**Target:** specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js R7 test
**Improvement:** Prefer exercising the retained public surfaces through command-level fixtures or exported adapters instead of requiring literal phrases such as gate --phase draft to appear in selected source files.
**Why non-blocking:** This is already covered by the broader blocking issue about static-only tests, but making R7 command-oriented would reduce false failures from harmless refactors.
