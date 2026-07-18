# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/319-gate-schema-failure-isolation/test-coverage.json`

## Blocking Findings

### 1. R5 phase propagation is not covered
**Target:** specs/319-gate-schema-failure-isolation/tests/gate-schema-failure-isolation.test.js:118
**Issue:** The R5 test only checks that GateOutputProtocolFailure stores a non-empty phase and rejects an empty phase. It does not exercise explicit and inferred draft, spec, task-impl, and integration phase resolution before gate execution, nor propagation to error envelopes, runtime diagnostics, issue-log evidence, and registry onError handling. It also does not cover secondary diagnostic failures preserving the original tooling error.
**Required change:** Add spec-local tests that drive the gate path for explicit and inferred draft/spec/task-impl/integration phases and assert the same effective phase reaches the required error envelope, diagnostics/evidence, issue-log, and registry onError surfaces while secondary diagnostic errors do not replace the original tooling error.
**Why blocking:** R5 is a must requirement and the current executable test has no corresponding coverage for the required production behavior.

### 2. R6 test passes without exercising semantic state isolation
**Target:** specs/319-gate-schema-failure-isolation/tests/gate-schema-failure-isolation.test.js:133
**Issue:** The test creates a local state object but never passes it into the production gate/error handling path. The final deepEqual only proves an unreferenced local object was not mutated, so it would pass even if protocol failures updated semantic artifacts, gateRetry, counters, task completion, routing, or lifecycle state in production.
**Required change:** Route the protocol/schema failure through the production code path that owns semantic artifacts, baselines, memory, counters, task completion, routing, and lifecycle state, then assert those stores remain unchanged.
**Why blocking:** This is a static anti-pattern that can pass without exercising production behavior for a must requirement.

### 3. R7 semantic PASS/FAIL preservation is under-covered
**Target:** specs/319-gate-schema-failure-isolation/tests/gate-schema-failure-isolation.test.js:153
**Issue:** The R7 test only calls updateGateRetryCounter for one explicit integration phase and checks two metric entries. It does not cover existing result artifacts, passed-guardrail memory, task completion, side effects, task/integration routing, or both explicit and inferred phase inputs.
**Required change:** Add tests that execute valid semantic PASS and FAIL through the production gate post-result lifecycle for explicit and inferred phase inputs and assert existing artifacts, retry behavior, passed-guardrail memory, task completion, side effects, and routing are preserved.
**Why blocking:** R7 is marked covered, but required acceptance behavior has no corresponding spec-local test coverage beyond retry metric accounting.

### 4. R3 freshness failure paths are not covered
**Target:** specs/319-gate-schema-failure-isolation/tests/gate-schema-failure-isolation.test.js:77
**Issue:** The R3 test covers a successful cache-bypassed repair call, but not the requirement that a cache replay must not count as a fresh repair attempt and that inability to guarantee freshness stops before repair.
**Required change:** Add tests where repair freshness is unavailable or the repair response is a cache replay, asserting no extra fresh attempt is counted beyond the allowed limit and the flow stops as required.
**Why blocking:** R3 includes mandatory freshness-isolation behavior that is not covered by the current test.

### 5. R4 failure-class matrix is incomplete
**Target:** specs/319-gate-schema-failure-isolation/tests/gate-schema-failure-isolation.test.js:99
**Issue:** The R4 test only covers invalid fresh repair output. It does not cover parse failure, initial schema-validation failure, or freshness-unavailable repair as distinct tooling/provider failures with typed durable evidence containing original error, effective phase, attempt count, per-attempt cache/freshness outcome, and final classification.
**Required change:** Add separate tests for parse failure, schema-validation failure, and freshness-unavailable repair that assert the required non-ESCALATE_RETRY_EXHAUSTED failure code and durable evidence fields.
**Why blocking:** R4 is a must requirement and several required failure classes lack regression coverage.

### 6. R8 mismatch coverage only checks one mismatch type
**Target:** specs/319-gate-schema-failure-isolation/tests/gate-schema-failure-isolation.test.js:183
**Issue:** The R8 test exercises a run ID mismatch, but does not cover Issue mismatch or spec guard mismatch. The requirement explicitly covers all three and requires the same early return before command loading, hooks, cache, persistence, issue-log changes, artifacts, and state mutation.
**Required change:** Add equivalent early-exit tests for issue mismatch and spec guard mismatch, asserting ACTIVE_FLOW_MISMATCH and no command/pre/cache/state/artifact side effects.
**Why blocking:** Two required mismatch classes have no corresponding spec-local test coverage.


## Advisory Findings

### 1. R1 could add invalid-value parser examples
**Target:** specs/319-gate-schema-failure-isolation/tests/gate-schema-failure-isolation.test.js:55
**Improvement:** Add table cases for prefixed, suffixed, explanatory, empty, and unknown requirementRef values against the parser in addition to checking the provider schema enum and one explanatory invalid value.
**Why non-blocking:** The schema enum and parser invalid-value evidence are already partially covered; the extra cases would make the boundary intent clearer.
