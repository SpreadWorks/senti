# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/308-docs-enrich-preset-root/test-coverage.json`

## Blocking Findings

### 1. R2 does not exercise docs enrich behavior
**Target:** specs/308-docs-enrich-preset-root/tests/enrich-preset-root.test.js
**Issue:** The R2 test calls resolveChaptersOrder directly and then checks enrich.js with a regex. It never invokes docs enrich against a project whose .senti/config.json type references a registry preset, and it never asserts that valid registry entries avoid Preset not found warnings.
**Required change:** Add an executable spec-local regression that runs the docs enrich path for the fixture project and asserts registry preset chapters resolve without Preset not found warnings.
**Why blocking:** R2 is an acceptance requirement about docs enrich behavior and warning output, but the current test can pass without exercising that production behavior.

### 2. R3 fallback behavior is not covered
**Target:** specs/308-docs-enrich-preset-root/tests/enrich-preset-root.test.js
**Issue:** The R3 test only checks source text for init/readme/enrich resolver calls. It does not verify plugin registry loading remains unchanged or that genuinely unknown presets still use the existing builtin fallback behavior.
**Required change:** Add the smallest executable regression covering the unchanged unknown-preset fallback behavior, and registry loading if it is affected by the bugfix surface.
**Why blocking:** R3 explicitly requires unchanged behavior for fallback and registry loading, but the current coverage artifact marks it covered without tests for those behaviors.

### 3. Source regex tests can pass without production behavior
**Target:** specs/308-docs-enrich-preset-root/tests/enrich-preset-root.test.js
**Issue:** The tests assert implementation by matching source text, including calls that could appear in dead code, comments, or otherwise not affect runtime behavior. This is used as the primary coverage for R1 and part of R2/R3.
**Required change:** Replace or supplement the regex assertions with runtime tests that observe docs enrich using the project root when resolving ctx.type preset chapters.
**Why blocking:** This is a static anti-pattern that can pass without exercising the production behavior required by the spec.


## Advisory Findings

No advisory findings.