# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/305-reduce-flow-ai-calls/test-coverage.json`

## Blocking Findings

### 1. R5 context.search AI fallback condition is not specifically tested
**Target:** specs/305-reduce-flow-ai-calls/tests/research-artifacts.test.js R5 test
**Issue:** The test only requires contextSearch.aiFallbackCondition to be a non-empty string. It would pass even if the artifact omits the required rule that AI keyword selection runs only when deterministic search is insufficient and fallback is explicitly allowed.
**Required change:** Assert that the context.search policy encodes both deterministic-search insufficiency and explicit fallback allowance for AI keyword selection.
**Why blocking:** R5 contains a concrete acceptance condition with no corresponding spec-local coverage, so an invalid policy could pass the tests.

### 2. R6 docs fallback and differential policies are not covered
**Target:** specs/305-reduce-flow-ai-calls/tests/research-artifacts.test.js R6 test
**Issue:** The test checks deterministic steps, AI-capable steps, separation policy, and quality verification, but does not validate warning or follow-up artifact options or differential run conditions.
**Required change:** Add assertions for warning/follow-up artifact options and differential run conditions in docs-staticization-policy.json.
**Why blocking:** R6 explicitly requires these policy elements, and the current test would pass without them.

### 3. R3 review manifest contract arrays may be empty
**Target:** specs/305-reduce-flow-ai-calls/tests/research-artifacts.test.js R3 test
**Issue:** producerInputs, fields, and auditFields are only checked for array type. Empty arrays would pass even though R3 requires concrete producer inputs, JSON fields, and audit fields for spec-review and impl-review.
**Required change:** Require producerInputs, fields, and auditFields to be non-empty for both specReview and implReview.
**Why blocking:** The test has a static anti-pattern that can pass without validating the required manifest contract contents.

### 4. R7 normalization and aggregation arrays may be empty
**Target:** specs/305-reduce-flow-ai-calls/tests/research-artifacts.test.js R7 test
**Issue:** jsonNormalizerRules, findingDeduplicationKeys, and severityMergeRules are only checked for array type. Empty arrays would pass even though R7 requires keys, schema normalization rules, and severity merge rules.
**Required change:** Require those arrays to be non-empty and assert coverage for AI fallback or hard-fail boundaries where the artifact represents them.
**Why blocking:** The test can pass without exercising required production behavior design for normalization, de-duplication, and severity merging.


## Advisory Findings

### 1. R4 audit field assertion could be stronger
**Target:** specs/305-reduce-flow-ai-calls/tests/research-artifacts.test.js R4 test
**Improvement:** Require auditFields to be non-empty, matching the pattern expected for an evidence-producing prototype.
**Why non-blocking:** The test already covers the required matrix field names, fallback condition, and behavior verification, so this is a strengthening rather than a missing acceptance requirement.
