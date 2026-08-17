# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-agent-timeout-settlement/test-coverage.json`

## Blocking Findings

### 1. Regression artifacts can satisfy R6 without exercising production behavior
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js:121
**Issue:** R6 requires regression proof for logging, metrics, cache behavior, and schema cleanup through the supervisor path, but the test delegates those assertions to `agent._regressionArtifactsForTest()`. An implementation can make that test helper return `{ loggerEvents: 2, metricEvents: 1, cacheHit: true, schemaFileRemoved: true }` without producing logs, metrics, cache behavior, or schema cleanup in production code.
**Required change:** Assert the real observable production artifacts for logging, metrics, cache behavior, and schema cleanup, or drive the existing public/test fixture hooks that are directly populated by the production supervisor path instead of a synthetic aggregate helper.
**Why blocking:** This is a static anti-pattern that would pass without exercising required production behavior for part of R6.

### 2. Supervisor internals can satisfy timeout requirements without proving Agent._callOnce behavior
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js:52
**Issue:** R1-R4 assertions rely heavily on `agent._lastSupervisorForTest` fields such as `signals`, `settlementCount`, `timerCount`, `listenerCount`, `treeDeadObserved`, and `graceExpirySettled`. These fields can be set by instrumentation after the fact and do not by themselves prove that `Agent._callOnce` observed exactly one terminal result, that listeners/timers were actually removed, or that cleanup ordering was enforced by production behavior.
**Required change:** Replace the synthetic snapshot-only assertions for terminal arbitration and cleanup with observable checks tied to the actual child process, emitted close/error/timeout paths, active listener/timer state, and the returned/rejected `Agent.call` result.
**Why blocking:** R2 and related R3/R4 coverage would pass if implementation only populated test-only snapshot fields while production terminal arbitration or cleanup was broken.

### 3. Win32 process-tree behavior is covered only by injected helper, not provider spawning
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js:96
**Issue:** The win32-specific test calls `ChildProcessSupervisor.runWithInjectedPlatformForTest()` directly with fake callbacks and does not exercise `Agent.call` spawning a provider command as a win32-compatible child or timeout cleanup through the supervisor path.
**Required change:** Add or adjust win32 coverage so the production provider-spawn path is exercised under platform injection or an equivalent test seam, including direct child close and taskkill completion.
**Why blocking:** R1 and R4 require provider commands to be spawned and cleaned up as managed trees on win32; the current test can pass with a standalone helper while the Agent spawn path remains incorrect.


## Advisory Findings

### 1. R5 spawn-error test naming is misleading
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js:84
**Improvement:** Rename the test to state that spawn errors retain non-timeout behavior, or add a short assertion message clarifying that this is the R5 spawn-error scenario inventory plus R3 behavior preservation.
**Why non-blocking:** The executable assertion is still meaningful, but the current name says it is mapped to a timeout scenario while the predicate requires a non-timeout error.
