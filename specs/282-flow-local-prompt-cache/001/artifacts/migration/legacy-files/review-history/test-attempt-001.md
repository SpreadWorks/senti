# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/282-flow-local-prompt-cache/test-coverage.json`

## Blocking Findings

### 1. R2 lacks digest and deterministic structured-field coverage
**Target:** specs/282-flow-local-prompt-cache/tests/agent-prompt-cache.test.js R2
**Issue:** The R2 test only verifies that mutating a provider invocation shape causes a miss. It does not assert that the cache key is a sha256 digest over the required fields, nor that structured fields such as jsonSchema and fmtFallback are serialized deterministically.
**Required change:** Add a spec-local test that inspects or derives the saved cache key and verifies it is a sha256 digest computed from the required identity fields using deterministic serialization for structured fields.
**Why blocking:** R2 is a must requirement and the coverage artifact marks it covered, but the executable tests do not cover the required sha256/deterministic serialization behavior.

### 2. R3 does not cover all required cache-miss identity fields
**Target:** specs/282-flow-local-prompt-cache/tests/agent-prompt-cache.test.js R3
**Issue:** The R3 test covers changed provider/userPrompt and partially covers commandId through profile switching, but it does not independently cover changed profileKey, resolved profile invocation identity, systemPrompt, jsonSchema, or fmtFallback as cache misses.
**Required change:** Add the smallest set of calls that prove each R3 identity field change, especially profileKey, resolved invocation identity, systemPrompt, jsonSchema, and fmtFallback, causes a provider invocation instead of a cache hit.
**Why blocking:** R3 is a must requirement requiring every listed field to be treated as cache identity; missing fields could be ignored by the implementation while these tests still pass.

### 3. R6 does not prove flow-local isolation within the same project
**Target:** specs/282-flow-local-prompt-cache/tests/agent-prompt-cache.test.js R6
**Issue:** The R6 test proves caching within one active flow, misses across different temp project roots, and disabled caching with no active flow. It does not test switching to another active flow/current spec within the same root, where accidental reuse of a spec-local artifact is most likely.
**Required change:** Add a same-root second-flow/current-spec case that repeats the same Agent.call identity and verifies the provider is invoked for the second flow rather than reusing the first flow's cached response.
**Why blocking:** R6 requires another flow not to reuse cached responses. Cross-root isolation alone does not cover the current active flow/current spec-local artifact boundary.


## Advisory Findings

No advisory findings.