# Spec Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Call out the second-field name divergence for the shared helper
**Target:** R4
**Improvement:** Note that spec-review's normalization (normalizeSpecReviewResponseShape, review.js:2374-2384) fills blockingFindings + nonBlockingImprovements, while test-review needs blockingFindings + advisoryFindings. A centralized helper must therefore be parameterized by the field-name pair rather than hardcoding spec-review's names.
**Why non-blocking:** The differing field names are discoverable directly from the schemas (TEST_REVIEW_RESPONSE_SCHEMA vs SPEC_REVIEW_RESPONSE_SCHEMA), so an implementer can derive the parameterization without the spec spelling it out; it does not block implementation or testing.

### 2. Clarify how R2 'fail validation' surfaces given the existing catch block
**Target:** R2
**Improvement:** Clarify that 'surface as validation failure' means parseTestReviewFindings still throws on invalid JSON / non-array / malformed items; the caller (review.js:1945-1958) then maps that throw to a parser_error TOOLING_FAILURE artifact rather than a hard process error. This keeps R2 consistent with the existing error-handling contract.
**Why non-blocking:** The throw-on-invalid behavior is preserved by leaving validateSchema after normalization, and the downstream TOOLING_FAILURE mapping is existing behavior outside this change's scope; tests can still assert the throw at the parser boundary, so implementation and testing are not blocked.
