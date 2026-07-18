# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/319-requirement-gate-context/test-coverage.json`

## Blocking Findings

### 1. R11 end-to-end coverage is not actually present
**Target:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Issue:** The artifact marks R11 covered for shared unit/end-to-end coverage, but the executable tests are almost entirely direct unit tests of exported helpers. The semantic PASS/FAIL cases for R6, R7, and R8 use evaluateWithPromptAwareStub(), which manually builds a RequirementGateBatch, calls a local prompt-aware stub, and parses the JSON. That bypasses RunGateCommand, gate planning, agent/cache integration, persisted artifacts, routing, and counter transitions for those requirement-context evaluations.
**Required change:** Add at least one spec-local end-to-end test that drives the production gate path for requirement-context evaluation and covers the required R11 behaviors that are currently only simulated by the local stub, especially missing changed behavior FAIL and the R6/R7 prompt/evaluation paths.
**Why blocking:** R11 explicitly requires shared unit/end-to-end coverage. The current tests can pass while the production gate orchestration is broken because the main semantic cases never execute it.

### 2. R4 batch limit test encodes an inconsistent overflow premise
**Target:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Issue:** The R4 test constructs a RequirementGateBatch with diff = 'x'.repeat(119000) and maxChars = 120000, then asserts promptCharCount equals context length plus diff length and overflow equals promptCharCount > 120000. With the provided context, contextA.toPromptText() is likely far below 1000 characters, so promptCharCount is likely under 120000 and the test does not prove that rendered context plus mapped diff are enforced against the unchanged 120000-character batch limit.
**Required change:** Use a diff size derived from contextA.toPromptText().length that deterministically crosses 120000, or assert both below-limit and above-limit cases explicitly.
**Why blocking:** R4 requires counting rendered requirement context and mapped diff toward the batch limit. The current test can pass without exercising the over-limit behavior it claims to cover.

### 3. R6 absent-evidence check can pass from unrelated prompt text
**Target:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Issue:** The missingEvidenceContext case decides pass/fail by checking whether the prompt contains '[EVIDENCE:R6]'. Because '[EVIDENCE:R6]' may appear in prompt instructions, examples, or section labels even when no mapped diff evidence exists, the test can report pass for absent evidence or fail for the wrong reason. It does not statically ensure that required regression evidence is absent from the rendered authoritative context and mapped implementation evidence.
**Required change:** Assert the exact rendered context/diff evidence content for the missing-evidence case, and make the stub decision depend on production evidence content rather than the mere presence of the '[EVIDENCE:R6]' token.
**Why blocking:** R6 requires FAIL when required regression evidence is absent. This test has a static anti-pattern that can pass or fail based on prompt boilerplate instead of exercising the production evidence condition.


## Advisory Findings

### 1. Boundary coverage could be clearer
**Target:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Improvement:** Add focused cases for R1 versus R10/R11-style ID boundaries in acceptance criteria and linked sources, plus a source linked only by exact backtick identifier without an explicit requirement ID.
**Why non-blocking:** The current source-selection test has useful exclusion coverage, but more explicit boundary cases would make the intended matching rules easier to diagnose.
