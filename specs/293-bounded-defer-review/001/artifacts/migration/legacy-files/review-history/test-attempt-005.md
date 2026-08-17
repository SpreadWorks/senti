# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/293-bounded-defer-review/test-coverage.json`

## Blocking Findings

### 1. R5 test can pass with fabricated classifications
**Target:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs: acceptance-review reads carried findings and persists final dispositions
**Issue:** The test builds an acceptance-review artifact from only flow-findings input and then accepts any allowed finalDisposition value. It does not provide or assert review evidence that determines whether each carried finding should be fixed, not_needed, false_positive, pre_existing, still_open, or blocking, so an implementation could assign a constant default classification to every deferred finding and still pass.
**Required change:** Add at least one spec-local test case with deferred findings plus explicit acceptance-review evidence that forces specific expected finalDisposition values, and assert those exact classifications are persisted for the carried finding IDs.
**Why blocking:** R5 requires acceptance-review to write final classifications for each carried finding. The current test checks enum shape only, not classification behavior, so it would pass without exercising the required production logic.

### 2. R7 missing first-round automatic routing coverage
**Target:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs: R7 second non-pass acceptance round stops automatic routing and blocks risk acceptance with mechanical blockers
**Issue:** The test only covers the second non-pass round stopping automatic routing and mechanical blockers preventing risk acceptance. It does not cover the complementary requirement that automatic acceptance-review repair routing is allowed before the limit is reached.
**Required change:** Add a spec-local assertion for a first non-pass acceptance-review result that routes automatically to the artifact's allowed targetStep before the second-round stop condition applies.
**Why blocking:** R7 is specifically a bounded automatic repair policy. Without first-round routing coverage, an implementation that always stops automatic routing, even on the first non-pass verdict, could satisfy this test while violating the requirement.

### 3. R6 does not verify persisted targetStep allowlist
**Target:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs: R6 non-pass acceptance-review requires allowlisted nextAction and targetStep
**Issue:** The test rejects one invalid targetStep and accepts one valid targetStep, but it does not prove that the full allowed targetStep set is exactly limited to spec, test, implement, test-execute, impl-review, and impl-gate. An implementation could allow additional unsupported routing targets beyond the single rejected example and still pass.
**Required change:** Add table-driven assertions that each allowed targetStep is accepted for a non-pass artifact and that at least one representative disallowed step outside the set remains rejected, or otherwise assert the exported allowlist exactly matches the required set.
**Why blocking:** R6 requires targetStep to be limited to a concrete allowlist. The current test does not fully constrain that API contract.


## Advisory Findings

### 1. R3 mechanical blockers could use integration-level assertions
**Target:** specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs: R3 mechanical gate retry exhaustion cases remain blocking
**Improvement:** The mechanical blocker cases exercise classifyGateRetryExhaustionSource directly. Adding one end-to-end check through checkRetryBelowMax for an invalid schema or failed evidence artifact would give stronger confidence that the retry path preserves the blocking classification.
**Why non-blocking:** The current tests do cover the classifier contract and a missing-artifact blocking path, so this is a coverage-strength improvement rather than a hard gap.
