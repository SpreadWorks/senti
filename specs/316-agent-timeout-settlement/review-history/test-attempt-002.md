# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/316-agent-timeout-settlement/test-coverage.json`

## Blocking Findings

### 1. R6 regression coverage is substantially incomplete
**Target:** tests/agent-timeout-settlement.test.js R6
**Issue:** The R6 test only covers argument substitution, a simple stdout result, one stdout callback, stdin via `cat`, and a non-timeout exit error. It does not provide executable regression coverage for agent.timeout resolution, JSON results, retry behavior, logging, metrics, cache behavior, schema cleanup, or the broader callback surface through the supervisor path.
**Required change:** Add spec-local R6 tests or assertions that exercise the missing Agent.call regressions through the new supervisor path, or split them into focused tests with `// spec: R6` coverage.
**Why blocking:** R6 explicitly requires automated regression proof for these behaviors, and the coverage artifact marks R6 covered despite missing required cases.

### 2. Win32 timeout supervision is not exercised
**Target:** tests/agent-timeout-settlement.test.js R1/R4
**Issue:** On Windows, R1 only checks `ChildProcessSupervisor.terminationPlanForTest({ platform: "win32", pid: 42 })`. R4 has no Windows assertion that `taskkill /T /F` completed or that descendant process termination was observed through the required Windows cleanup path.
**Required change:** Add an executable Windows-path test, or platform-injected supervisor test, proving timeout escalation runs `taskkill /PID <pid> /T /F`, waits for taskkill completion and direct child close, and leaves no recorded descendant PID alive.
**Why blocking:** R1 and R4 require win32-compatible managed-tree termination behavior; a static plan helper can pass without exercising production timeout cleanup.

### 3. Timeout timing test can encode an impossible margin premise
**Target:** tests/agent-timeout-settlement.test.js R3
**Issue:** The test asserts `timed.elapsed <= timed.error.timeoutMs + timed.error.graceMs + timed.error.cleanupMarginMs`, but `cleanupMarginMs` is read from the thrown error instead of being a fixed test-side allowance. An implementation could make the test pass by inflating the error's margin value.
**Required change:** Use a fixed spec-local cleanup margin constant in the test and assert the error exposes only the required timeout metadata independently.
**Why blocking:** R3 requires settlement within timeout plus grace plus a fixed cleanup/test margin; taking the margin from production error metadata lets production define its own passing threshold.

### 4. R5 coverage artifact overstates required scenario coverage
**Target:** tests/agent-timeout-settlement.test.js / coverage artifact R5
**Issue:** R5 requires automated tests to reproduce a SIGTERM-ignoring child, a timeout immediately before exit, spawn error, and descendant-process termination. The file has those scenarios spread across R1, R3, R4, and R5, but only one test is named R5 and the artifact reports only aggregate file coverage without mapping R5 to each required scenario.
**Required change:** Make the R5 coverage explicit by naming or adding spec-local assertions/tests for each required scenario under R5, or update the coverage artifact to map those concrete tests to R5.
**Why blocking:** The requirement coverage artifact claims R5 is covered, but the actual R5-design evidence does not directly account for all R5-mandated scenarios.


## Advisory Findings

No advisory findings.