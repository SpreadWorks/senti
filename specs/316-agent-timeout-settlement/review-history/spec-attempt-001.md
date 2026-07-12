# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Descendant termination has no concrete target
**Target:** R1/R4 and Overview > Data Flow
**Issue:** Verified src/lib/agent.js currently spawns the provider as a normal child and the timeout calls child.kill("SIGTERM"), which targets only the direct child. The spec requires no descendant process alive after timeout, but R1 only specifies SIGTERM/SIGKILL for the direct child and does not define process-group creation, descendant PID tracking, recursive termination, or platform behavior.
**Required change:** Add a spec-level requirement or decision that defines how descendants are made killable and terminated before timeout settlement, such as supervised process-group signaling or explicit descendant PID tracking, including any supported-platform limits.
**Why blocking:** An implementation can satisfy the direct-child SIGTERM/SIGKILL wording while leaving grandchildren alive, so R4 and the descendant acceptance test fail and can leak test fixture processes.

### 2. Grace expiry is treated as terminal before death is observable
**Target:** Design Principles, R2, R4
**Issue:** The spec says grace expiry may be a terminal event and that Agent._callOnce settles with AgentTimeoutError after escalation, but R4 requires no direct child or descendant alive after the returned timeout failure settles. Sending SIGKILL is asynchronous, and existing Agent._callOnce uses close as the observable lifecycle endpoint for a spawned child.
**Required change:** Specify that grace expiry initiates SIGKILL but timeout rejection occurs only after an observable direct-child/process-tree-dead cleanup point within the timeout-plus-grace-plus-margin budget, or explicitly relax the after-settlement no-live-process guarantee.
**Why blocking:** If the supervisor rejects immediately when the grace timer fires, Agent.call can return while the child or descendants are still alive; if it waits for close/exit, tests and implementation timing differ from the stated terminal race model.

### 3. Close after timeout has no caller-visible error contract
**Target:** R2/R3 and Acceptance Criteria
**Issue:** Existing _callOnce resolves success on code 0 with no signal and formats non-zero/signal closes as ordinary Agent.call errors. The spec covers a close immediately before the deadline and a child that survives SIGTERM until SIGKILL, but it does not define the common path where the deadline fires, SIGTERM is sent, and the child exits during grace before SIGKILL, including exit 0 or a non-zero handler exit.
**Required change:** Add the expected result for any close observed after the timeout deadline fires but before grace expiry, including whether timeout ownership overrides close as AgentTimeoutError or whether existing close error/success behavior is preserved, and which error fields/messages are required.
**Why blocking:** Two implementations can both fit parts of the spec while exposing different Agent.call behavior: one may return success or exit=7 from the close handler, another may reject AgentTimeoutError. Regression and acceptance tests cannot be designed reliably without this rule.


## Non-blocking Improvements

### 1. List direct Agent references
**Target:** Codebase Context (related files)
**Improvement:** Add src/lib/agent.js, tests/unit/lib/agent.test.js, tests/unit/lib/agent-with-logger.test.js, and the recent specs/315-spawn-enoent-diagnostics agent test as related context for the retained Agent.call contract.
**Why non-blocking:** The spec body already names the main module and required retained behaviors, so implementation is not blocked; the related-file list would just make discovery faster.
