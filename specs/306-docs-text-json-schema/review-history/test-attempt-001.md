# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/306-docs-text-json-schema/test-coverage.json`

## Blocking Findings

### 1. R1 schema constraint is under-tested
**Target:** specs/306-docs-text-json-schema/tests/docs-text-json-schema.test.js R1 test
**Issue:** The test only asserts that agent.call receives a jsonSchema with type "object". A schema with only { type: "object" } would pass while failing the requirement to constrain the response to directive id keys mapped to markdown text strings.
**Required change:** Assert the schema constrains directive id entries to string values, for example by checking a known directive id property or additionalProperties/patternProperties has type "string" and that non-string/object-shaped values would be rejected by the intended schema shape.
**Why blocking:** This leaves the core R1 acceptance requirement without executable coverage and would allow an implementation that passes the test without enforcing the required JSON response contract.

### 2. R6 regression coverage omits several required retained behaviors
**Target:** specs/306-docs-text-json-schema/tests/docs-text-json-schema.test.js R6 test
**Issue:** The R6 test covers a successful batch write with an existing data block and schema presence, but it does not cover per-directive mode, user override precedence, generated markdown writes beyond the returned text, or successful prompt cache reuse.
**Required change:** Add spec-local assertions or tests for the missing R6 behaviors: per-directive mode remains unchanged, user overrides still take precedence, generated markdown is written as expected, and a successful JSON response is reusable from prompt cache.
**Why blocking:** The coverage artifact marks all of R6 as covered, but multiple explicitly listed public behaviors have no corresponding test coverage.


## Advisory Findings

### 1. R2 provider coverage could be future-proofed
**Target:** specs/306-docs-text-json-schema/tests/docs-text-json-schema.test.js R2 test
**Improvement:** Instead of checking only claude/sonnet and codex/gpt-5.4, derive or enumerate all docs.text-reachable built-in providers and assert each exposes jsonSchemaFlag and jsonSchemaMode.
**Why non-blocking:** The requirement explicitly calls out those two providers and the current test covers them, but broader enumeration would better protect against future default-provider additions.
