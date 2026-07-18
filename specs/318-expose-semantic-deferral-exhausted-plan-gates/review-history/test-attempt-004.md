# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-expose-semantic-deferral-exhausted-plan-gates/test-coverage.json`

## Blocking Findings

### 1. R1 bounded-read requirement can pass without using the bounded reader
**Target:** tests/plan-gate-semantic-deferral.test.js: R1 test
**Issue:** The oversized-artifact case only checks that recovery is false and state/source remain unchanged. An implementation could use an unbounded fs.readFileSync, parse the entire oversized file, then reject it by size or schema and still satisfy this test. That does not exercise the required contract that inspection reads at most 1 MiB through the existing readBoundedSourceArtifact limit.
**Required change:** Add a spec-local assertion or fixture that fails if more than the bounded limit is read, or otherwise directly observes that the existing bounded-source path is used for exhausted draft/spec gate inspection.
**Why blocking:** R1 explicitly requires bounded reading through readBoundedSourceArtifact. Current coverage would pass while violating that critical resource-safety behavior.

### 2. R3 does not prove each durable semantic finding is persisted
**Target:** tests/plan-gate-semantic-deferral.test.js: R3 test and semanticArtifact fixture
**Issue:** The semantic artifact fixture contains only one failing evaluation, and R3 only asserts flow-findings.json has one entry. An implementation that persists only the first durable semantic finding would pass, despite R3 requiring each durable semantic finding to be persisted.
**Required change:** Use an artifact with at least two durable semantic findings and assert both are persisted with the expected source metadata.
**Why blocking:** R3's per-finding persistence requirement has no corresponding regression coverage for multiple findings.

### 3. R5 coverage artifact overstates coverage for no-progress and missing-findings classifier results
**Target:** tests/plan-gate-semantic-deferral.test.js: R5 test
**Issue:** R5 claims coverage for no-progress guard and missing findings, but the test fixtures are likely classified as semantic findings because they still include failing semantic evaluations. For example `{ guardCode: "NO_PROGRESS_SINCE_LAST_FAIL", evaluations }` and `{}` do not clearly contradict semantic eligibility unless the classifier is documented to prioritize those fields. The test may therefore encode an incorrect premise and fail to cover the named non-deferable results.
**Required change:** Construct no-progress and missing-findings artifacts in the actual durable-source schema that unambiguously classify to those non-semantic results, and assert recovery remains unavailable.
**Why blocking:** R5 requires every classifier result except semantic_findings to remain non-recoverable. The current test design may pass or fail based on fixture-shape accidents instead of exercising those classifier outcomes.


## Advisory Findings

No advisory findings.