# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-agent-timeout-settlement/test-coverage.json`

## Blocking Findings

### 1. R6 regression coverage is largely absent
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js
**Issue:** The coverage artifact marks R6 covered, but the only R6 test verifies a single successful stdout string result. It does not prove unchanged command/argument dispatch, agent.timeout resolution, JSON result handling, callbacks, retry, stdin fallback, logging, metrics, cache behavior, schema cleanup, or non-timeout failure behavior through the supervisor path.
**Required change:** Add spec-local regression tests, or expand existing ones, to exercise each R6 behavior through Agent.call with the supervisor path.
**Why blocking:** R6 is a must requirement and has no corresponding executable coverage for most of its required behaviors; the artifact's covered status contradicts the actual tests.

### 2. R3 timeout error contract is incomplete
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js
**Issue:** The R3 test checks code, timeoutMs, graceMs, and killed, but it does not assert that the error is an AgentTimeoutError, does not check the final termination signal/action, does not cover a non-zero post-deadline close, and does not verify settlement within timeout plus grace plus a fixed margin. Spawn error is covered under R5, but pre-deadline non-timeout failure behavior is not covered here or elsewhere.
**Required change:** Add R3 assertions/tests for AgentTimeoutError identity, final termination signal/action, post-deadline non-zero close, bounded settlement timing, and pre-deadline non-timeout failure behavior.
**Why blocking:** R3 is a must requirement whose acceptance contract is only partially tested, leaving critical timeout semantics and error shape unverified.

### 3. R2 cleanup and arbitration guarantees are not actually exercised
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js
**Issue:** The R2 test only counts a single promise settlement, which JavaScript promises already guarantee. It does not statically exercise close/error/timeout/grace/forced-termination/tree-dead arbitration, listener cleanup, timer cleanup, or the requirement that grace expiry is not treated as successful cleanup observation.
**Required change:** Add tests or instrumentation that can observe supervisor terminal-path cleanup and arbitration outcomes, including listener/timer removal and delayed settlement until the forced-termination/tree-dead observation path completes.
**Why blocking:** The current test would pass without proving the production supervisor's R2 behavior, so the must requirement lacks meaningful coverage.

### 4. R1 managed-tree and platform-specific termination behavior is undercovered
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js
**Issue:** The R1 test only asserts that a SIGTERM-ignoring process eventually rejects with AGENT_TIMEOUT. It does not verify detached POSIX process-group spawning, group-directed SIGTERM/SIGKILL, atomic timeout ownership, bounded grace escalation, or the win32 taskkill-compatible behavior required by R1.
**Required change:** Add observable tests or platform-gated stubs/spies proving POSIX detached process-group signaling and win32 taskkill-compatible forced termination, including timeout ownership/escalation behavior.
**Why blocking:** R1 is a must requirement and the current test can pass with a simpler direct-child kill implementation that does not satisfy the managed-tree contract.

### 5. R4 does not verify direct-child close and full process-tree death semantics
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js
**Issue:** The R4 test checks one recorded descendant PID after rejection, but it does not record or verify the direct child PID, does not verify that settlement waited for the direct child's close event, does not prove POSIX process-group signal-0 probing returns ESRCH, and has no win32 taskkill completion coverage. It also records only one descendant, so additional leaked descendants would not be detected.
**Required change:** Extend R4 tests to record and assert direct-child and descendant process death, verify settlement occurs only after child close and tree-dead observation, and cover the win32 taskkill completion path with platform-gated tests or stubs.
**Why blocking:** R4 is a must requirement; the existing test checks one symptom but misses the required cleanup observation and no-live-PID guarantees.

### 6. R5 timeout-immediately-before-exit scenario is missing
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js
**Issue:** R5 requires reproducing a timeout immediately before exit. The closest race test exits after 80ms with a 50ms timeout while ignoring SIGTERM, but it only counts promise settlement and does not assert that the deadline fired immediately before exit or that the result is an AgentTimeoutError.
**Required change:** Add a dedicated R5/R3 scenario where the child exits immediately after the timeout deadline and assert it rejects as AgentTimeoutError rather than succeeding or surfacing a normal close result.
**Why blocking:** R5 is a must requirement and the required race scenario is not meaningfully covered by the current test design.

### 7. Timeout rejection assertion uses message regex that contradicts the likely error contract
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js
**Issue:** The R4 test uses assert.rejects(..., /AGENT_TIMEOUT/), which matches the error message rather than error.code. R3 requires code AGENT_TIMEOUT, but does not require the message to contain that string, so a correct AgentTimeoutError implementation could fail this test.
**Required change:** Change the R4 rejection predicate to assert error?.code === "AGENT_TIMEOUT" instead of matching the message regex.
**Why blocking:** This test encodes an implementation premise not required by the API contract and may reject a correct implementation.


## Advisory Findings

### 1. Spec command IDs use stale number
**Target:** specs/316-agent-timeout-settlement/tests/agent-timeout-settlement.test.js
**Improvement:** Rename commandId values and temp-dir prefix from spec.411/senti-411 to spec.316/senti-316 for consistency with the spec path.
**Why non-blocking:** This is naming drift only; it does not affect executable behavior or requirement coverage.
