# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/338-active-flow-registry-race/test-coverage.json`

## Blocking Findings

### 1. Missing document-replacement prohibition coverage
**Target:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js:164
**Issue:** R2 requires proving the acceptance-decision success path does not call an active-flow document-replacement operation, but the test only guards removeActiveFlow and parkActiveFlow. A replacement/write-through operation that rewrites registry documents could still be introduced without this test detecting it.
**Required change:** Add a spec-local assertion or stub that fails if the acceptance-decision success path invokes the relevant registry document-replacement API.
**Why blocking:** R2 has no corresponding test coverage for one of its explicit prohibited operation classes.

### 2. flow resume --parked behavior is not exercised
**Target:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js:259
**Issue:** R5 requires preserving existing `flow resume --parked` behavior, but the test calls `FlowManager.resumeParkedFlow()` directly. This bypasses the command path and would pass even if the CLI resume behavior regressed.
**Required change:** Add spec-local coverage that exercises the actual `flow resume --parked` command path, or the same command-level entrypoint used by existing resume tests.
**Why blocking:** The requirement coverage artifact marks R5 covered, but the executable test does not exercise the required API surface.


## Advisory Findings

No advisory findings.