# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-agent-timeout-settlement/test-coverage.json`

## Blocking Findings

### 1. Regression tests bypass Agent.call for JSON success behavior
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js:102
**Issue:** The R6 JSON result check calls `agent._callOnceForTest({ text: "json-ok", usage: null })` with a fabricated result object instead of running `Agent.call` through the provider process and supervisor path. This can pass even if command dispatch, stdout capture, JSON result parsing, or supervisor integration is broken.
**Required change:** Change the JSON success assertion to invoke `agent.call(...)` against the configured JSON-emitting provider and assert the returned parsed result.
**Why blocking:** R6 explicitly requires unchanged success text and JSON results through the supervisor path; the current test does not exercise production behavior for JSON output.

### 2. Retry/cache/logging/metrics/schema regression test relies on synthetic helper evidence
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js:107
**Issue:** `_exerciseRegressionSurfacesForTest` can return booleans/counters without proving the real `Agent.call` retry, callback, logging, metrics, cache, and schema cleanup behavior still works through the supervisor path.
**Required change:** Assert these R6 surfaces via real `Agent.call` executions and observable production side effects, or make the helper demonstrably execute the production call path rather than returning precomputed evidence.
**Why blocking:** A test-only evidence bundle is a static anti-pattern that could pass without exercising the required production behavior.

### 3. POSIX descendant termination test does not guarantee descendants are in the managed tree
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js:30
**Issue:** `ignoringTree` spawns descendants without keeping the parent alive after `SIGKILL`; on POSIX, killing the process group can leave orphaned grandchildren running in the same process group. The test then expects every PID to be gone immediately after timeout settlement, which may contradict the platform process model unless the fixture ensures descendants are actually terminated or reaped by the supervisor's supported mechanism.
**Required change:** Use a fixture that reliably keeps the recorded descendants within the supervisor's killable managed tree and verifies the intended POSIX process-group semantics without depending on orphan cleanup behavior.
**Why blocking:** R4 requires proving no recorded descendant remains alive after timeout failure; this fixture encodes an unreliable implementation premise for descendant death.


## Advisory Findings

### 1. R1 win32 coverage is mostly helper-level
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js:90
**Improvement:** Add a higher-level win32-oriented test seam around the supervisor spawn configuration if the implementation supports it, so taskkill compatibility is covered closer to the production path.
**Why non-blocking:** The current tests do check the expected taskkill arguments and completion ordering through injected supervisor helpers, so this is extra confidence rather than missing coverage.
