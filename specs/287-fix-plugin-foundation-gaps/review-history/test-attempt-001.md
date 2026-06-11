# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/287-fix-plugin-foundation-gaps/test-coverage.json`

## Blocking Findings

### 1. R2 coverage omits required hard-fail cases
**Target:** specs/287-fix-plugin-foundation-gaps/tests/plugin-foundation-gaps.test.js R2 test and coverage artifact
**Issue:** The R2 test covers disabled plugin, missing installed plugin, unresolved module, and className mismatch, but does not cover invalid register(api) export, invalid hook class, or mismatched command, hook, and priority metadata. The coverage artifact marks R2 fully covered despite those missing cases.
**Required change:** Add spec-local assertions for invalid register export, invalid hook class, and mismatched command, hook, and priority metadata, or split them into separate R2 tests with requirement headers.
**Why blocking:** R2 is a must requirement with explicit failure modes; several acceptance cases have no corresponding spec-local test coverage and the coverage artifact overstates coverage.

### 2. R1 does not prove rejection happens before dynamic import
**Target:** specs/287-fix-plugin-foundation-gaps/tests/plugin-foundation-gaps.test.js R1 test
**Issue:** The R1 test asserts rejection for a hook module containing a core-internal import, but the hook module has no evaluation side effect, so the test could still pass if production dynamically imports the module before rejecting it.
**Required change:** Make the forbidden hook module produce a detectable side effect on evaluation and assert that the side effect did not occur when discovery rejects it.
**Why blocking:** The requirement specifically requires rejection before dynamic import; the current test can pass without exercising that timing guarantee.

### 3. R1 lacks coverage for allowed relative plugin imports
**Target:** specs/287-fix-plugin-foundation-gaps/tests/plugin-foundation-gaps.test.js R1 coverage
**Issue:** R1 requires relative imports that stay within the plugin package to remain allowed, but the spec-local tests only cover rejection of core-internal imports.
**Required change:** Add a spec-local R1 assertion using a hook module with a relative in-package import and verify discovery accepts/registers it.
**Why blocking:** A must requirement includes an allowed-path behavior with no corresponding spec-local test coverage.


## Advisory Findings

No advisory findings.