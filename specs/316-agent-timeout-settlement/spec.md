# Feature Specification: 316-agent-timeout-settlement

**Feature Branch**: `feature/316-agent-timeout-settlement`
**Created**: 2026-07-11
**Status**: Draft
**Input**: GitHub Issue #411

## Goal
Ensure an Agent.call subprocess that ignores SIGTERM after its configured timeout settles in a bounded time, releases all lifecycle resources, and leaves no direct child or descendant process alive.

## Background
F-005 identifies a liveness failure in Agent._callOnce: timeout sends SIGTERM once and the caller remains dependent on close or error. A process that ignores SIGTERM can therefore keep the call pending. Separate timeout, close, and error handlers also make terminal races and incomplete cleanup possible. This change replaces only child-process lifecycle ownership while retaining the caller-visible Agent.call contract.

## Scope
- src/lib/agent.js timeout lifecycle ownership
- ChildProcessSupervisor and AgentTimeoutError classes
- automated unit, agent, and spec-local regression coverage for timeout races and process cleanup
- required generated documentation synchronization after source changes

## Out of Scope
- unrelated audit findings
- new public agent configuration fields
- npm publishing, dist-tags, and releases

## Constraints
- Use only Node.js built-in modules and add no dependencies.
- Represent ChildProcessSupervisor and AgentTimeoutError as classes with constructor-enforced invariants; do not use object-literal tagged unions for their meaningful state.
- Preserve the existing Agent.call public contract for command construction, successful responses, callbacks, retry, caching, metrics, logging, temporary schema cleanup, non-timeout failures, and agent.timeout configuration.
- The alpha policy applies: do not add compatibility paths for superseded timeout lifecycle ownership.
- Do not add a user-facing timeout or grace-period configuration surface in this issue.
- Run senti upgrade only if src/skills, src/presets, or templates are changed; this issue is not expected to change them.
- Synchronize generated docs after source changes because docs freshness was stale before implementation.

## Design Principles
- ChildProcessSupervisor has sole ownership of timeout escalation, terminal settlement, listener removal, and timer removal for one child process lifecycle.
- Agent retains invocation building, provider parsing, retries, callbacks, logging, caching, metric collection, and temporary schema-file lifecycle.
- Terminal ownership is settle-once: a pre-deadline close/error preserves the existing result, while the deadline atomically claims the lifecycle and every later close/error resolves as one AgentTimeoutError.
- Termination must be bounded and observable: the deadline sends SIGTERM to the managed process tree, grace expiry initiates forced tree termination, and rejection occurs only after direct-child close plus a platform-specific tree-dead condition within a fixed cleanup margin.

## Overview
### Modules
- src/lib/agent.js owns Agent.call invocation setup and will host the ChildProcessSupervisor and AgentTimeoutError classes.
- tests/unit/lib/agent.test.js and related agent tests cover Agent.call invocation, retry, timeout, and failure contracts.
- tests/agent/ provides real-agent regression coverage; specs/316-agent-timeout-settlement/tests/ provides required spec-local requirement coverage.

### Data Flow
- Agent._callOnce builds and spawns the provider command, then delegates child lifecycle observation to ChildProcessSupervisor.
- Agent spawns a managed process tree: a detached process group on POSIX, and a direct child whose tree can be terminated with taskkill /T on win32.
- At timeout, ChildProcessSupervisor claims the lifecycle, signals the process tree with SIGTERM where supported, starts a bounded grace timer, and force-terminates the full tree with POSIX process-group SIGKILL or win32 taskkill /T /F.
- A post-deadline close never restores success or an ordinary exit error; settlement waits for direct-child close and the platform tree-dead condition, then removes listeners and timers before returning one AgentTimeoutError.

### Decisions
- [VERIFY] The draft policy that agent.js has only a SIGTERM timeout and independently clears it in close/error handlers matches source.
- [VERIFY] Existing agent.timeout remains the public deadline source and is resolved from seconds to milliseconds before _callOnce.
- Adopt a class-owned supervisor because the replacement affects one cohesive child-process lifecycle and needs constructor-enforced ownership of timers, listeners, and settlement.
- The missing temporary F-005 report is not a test dependency; traceability is provided by Issue #411, source references, spec-local tests, and issue-log evidence.
- Use platform process-tree termination without new dependencies: create and signal a detached process group on POSIX; on win32 send the initial child SIGTERM and use taskkill /PID <pid> /T /F for forced tree cleanup.
- Once the configured deadline fires, timeout ownership overrides every later close code or signal; the caller receives AgentTimeoutError only after direct close and observable process-tree cleanup.

## Clarifications (Q&A)
- Q: Does the new grace period create a public configuration option?
  - A: No. agent.timeout remains the public deadline; the bounded grace period is an internal supervisor invariant for this issue.
- Q: Which component owns existing Agent.call behavior outside child lifecycle termination?
  - A: Agent retains invocation construction, provider parsing, retries, callbacks, logging, caching, metrics, and temporary schema-file cleanup; ChildProcessSupervisor owns only child lifecycle termination and settlement.
- Q: What replaces the unavailable temporary F-005 report for verification?
  - A: The linked Issue, source verification decisions, spec-local tests, shared regressions, and issue-log evidence provide durable traceability.

## Alternatives Considered
- Keep timeout handling as separate callbacks in Agent._callOnce. — Rejected because the Issue requires settle-once terminal ownership and reliable cleanup across close/error/timeout races, which scattered callbacks cannot make explicit.
- Expose grace period as a new agent configuration field. — Rejected because Issue #411 requires bounded recovery but does not request a public configuration change; an internal invariant preserves the existing configuration surface.
- Treat SIGTERM as the final timeout action. — Rejected because a SIGTERM-ignoring child causes the liveness failure named by F-005.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-11T14:47:23.692Z
- Notes: User approved Wave 1 specifications for Issues #410, #411, and #412 together by selecting option 1 on 2026-07-11.

## Requirements
- R1 [must]: Add ChildProcessSupervisor and AgentTimeoutError in src/lib/agent.js. Spawn provider commands as managed trees: a detached process group on POSIX and a win32 child compatible with taskkill /T. At the resolved agent.timeout deadline, atomically claim timeout ownership and send SIGTERM to the POSIX group or direct win32 child; after one bounded internal grace period, send SIGKILL to the POSIX group or run taskkill /PID <pid> /T /F on win32.
- R2 [must]: ChildProcessSupervisor shall arbitrate close, error, timeout, grace expiry, forced termination completion, and process-tree-dead observation so Agent._callOnce observes exactly one terminal result and every terminal path removes all registered listeners and timers. Grace expiry initiates forced termination but is not itself a successful cleanup observation.
- R3 [must]: A pre-deadline close or spawn error shall retain existing success or non-timeout error behavior. Once the deadline fires, any later close, including exit 0 or non-zero during grace, shall reject as AgentTimeoutError after cleanup. The error shall expose code AGENT_TIMEOUT, timeoutMs, graceMs, the final termination signal/action, and killed=true, and shall settle within timeout plus grace plus a fixed cleanup/test margin.
- R4 [must]: Timeout termination shall not settle until the direct child has emitted close and the managed tree is observably dead: POSIX process-group signal-0 probing returns ESRCH, or win32 taskkill /T /F has completed and the direct child has closed. No recorded direct or descendant PID may remain alive after the returned timeout failure.
- R5 [must]: Automated tests shall reproduce a SIGTERM-ignoring child, a timeout immediately before exit, spawn error, and descendant-process termination; spec-local files shall cover R1 through R4 with // spec: R<N> headers.
- R6 [must]: Regression tests shall prove unchanged Agent.call command/argument dispatch, agent.timeout resolution, success text and JSON results, callbacks, retry, stdin fallback, logging, metrics, cache behavior, schema cleanup, and non-timeout failure behavior through the supervisor path.
- R7 [should]: Synchronize generated project documentation after the source update and record the result in the flow evidence.

## Acceptance Criteria
- A SIGTERM-ignoring fixture tree receives SIGTERM at the configured deadline, receives POSIX process-group SIGKILL or win32 taskkill /T /F after grace, rejects with AgentTimeoutError, and settles within timeout plus grace plus cleanup margin.
- A close/error/timeout race fixture produces exactly one observed resolution or rejection and leaves no active supervisor timer or child event listener; forced termination dispatch alone cannot complete the timeout before direct close and tree-dead observation.
- A fixture that exits immediately before its deadline returns its normal result without a later timeout rejection.
- A fixture that closes with exit 0 or non-zero after the deadline but before grace expiry rejects once as AgentTimeoutError with code, timing, killed, and final-action fields rather than returning success or an ordinary exit error.
- A spawn-error fixture rejects once with the existing formatted spawn-error contract and leaves no timer or listener behind.
- A timed-out fixture that launches a descendant has neither recorded PID alive after settlement.
- Agent.call regression tests verify unchanged command dispatch, configured timeout conversion, success text and JSON parsing, callbacks, retry, stdin fallback, logger/metric/cache behavior, schema cleanup, and non-timeout errors.
- Spec-local tests under specs/316-agent-timeout-settlement/tests/ cover R1 through R4 with requirement headers, and shared tests cover the existing Agent contract.
- Documentation synchronization completes after source changes, or the flow records a concrete environment failure and guarded recovery command.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Model child process supervision
  - Add the class-owned timeout, escalation, settlement, and cleanup behavior for one spawned child process.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Integrate supervised invocation
  - Route Agent._callOnce through ChildProcessSupervisor without changing existing Agent.call behavior outside timeout termination.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Prove timeout lifecycle behavior
  - Add spec-local and shared automated coverage for the F-005 failure reproduction and all timeout acceptance paths.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Synchronize generated documentation
  - Refresh generated documentation for the updated agent subprocess behavior.
  - see `tasks/T-4.md` for full spec
