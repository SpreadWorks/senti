# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/319-requirement-gate-context/test-coverage.json`

## Blocking Findings

### 1. R2 source-reference assertions are not executable as written
**Target:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js R2 test
**Issue:** The test builds each expected-reference regex with `ref.replace(/[\[\]]/g, "\\{{PROMPT}}")`, which creates a pattern for a placeholder string rather than escaped square brackets. It will not correctly assert references like `[REQ:R1]` and may fail before exercising production context selection.
**Required change:** Replace the placeholder escaping with a valid literal-reference matcher, for example by escaping regex metacharacters or using string inclusion checks for each expected reference.
**Why blocking:** A test that is not executable or cannot exercise the intended production behavior is a concrete static anti-pattern.

### 2. R1 constructor coverage omits immutability and required rejection cases
**Target:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js R1 test
**Issue:** The R1 test checks a few empty/unknown values but does not test that RequirementContextEntry, RequirementGateContext, and RequirementObligation are immutable, does not cover constructor rejection of non-positive caps, and does not cover rejection of non-deterministic input collections.
**Required change:** Add spec-local assertions for immutability of all three value types and for the missing constructor rejection cases: non-positive caps and non-deterministic input collections.
**Why blocking:** R1 explicitly requires these behaviors, and the coverage artifact marks R1 covered even though those required cases have no corresponding test coverage.

### 3. R4 batch-limit and cache mechanism coverage is missing
**Target:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js R4 test
**Issue:** The R4 test verifies byte-identical prompts and the 900000-character ceiling, but it does not verify that rendered requirement context plus mapped diff count toward the unchanged 120000-character RequirementGateBatch limit, nor that the existing agent cache mechanism uses the same cache identity.
**Required change:** Add coverage that constructs enough rendered context and mapped diff to exercise the 120000-character batch accounting, and verify the existing cache path/key behavior for identical spec, file-map, diff, and task state.
**Why blocking:** R4 contains explicit acceptance requirements with no corresponding spec-local regression coverage, while the coverage artifact reports R4 as covered.

### 4. R9 unchanged behavior coverage is too narrow
**Target:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js R9 test
**Issue:** The R9 test only checks parseImplRequirementEvaluation output shape. It does not cover unchanged semantic PASS/FAIL counter transitions, retry memory, agent cache mechanism, persisted impl-gate-result schema, task/integration routing, no-related-diff behavior, or file-map reconciliation behavior.
**Required change:** Add focused regression coverage for the listed unchanged R9 behaviors, or split them into existing shared tests that are actually referenced by this spec-local suite.
**Why blocking:** R9 is a preservation requirement for multiple existing behaviors, and most of those behaviors have no corresponding test coverage despite the artifact marking R9 covered.

### 5. R10 guard mismatch immutability is not tested
**Target:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js R10 test
**Issue:** The R10 test inspects `FlowCommand.prototype.run.toString()` and only checks that `targetMismatchEnvelopeForInput` appears before `execute(ctx)`. It does not exercise mismatched run, Issue, or spec guards, does not assert ACTIVE_FLOW_MISMATCH, does not prove spec/context/file-map construction is skipped, and does not verify zero agent/cache access, byte-identical artifacts, or no state mutation.
**Required change:** Replace or supplement the source-order assertion with executable guard-mismatch tests for run, Issue, and spec mismatches that assert ACTIVE_FLOW_MISMATCH, unchanged state/artifacts, and zero agent stub invocations before any spec/context/file-map work.
**Why blocking:** R10’s required guard behavior and immutability guarantees have no real regression coverage, and the current source-string assertion could pass without exercising production behavior.


## Advisory Findings

### 1. Boundary cases for exact ID matching could be clearer
**Target:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js R2 test
**Improvement:** Add a nearby non-match such as `R11` or `XR1` acceptance/source text to prove exact-boundary matching does not accidentally include partial IDs.
**Why non-blocking:** The current R2 test has some unrelated R10 exclusion coverage, so this is a useful precision improvement rather than a separate blocker.
